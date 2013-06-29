dofile(fb_env.doc_root.."\\common.lua")
local sort_fields = {
	folder = "relative_path",
	date = "add_date DESC"
}
function parse_sort(fields, avail_fields)
	local s = nil
	for f in fields:gmatch("[^,]+") do
		local k = avail_fields[f]
		if k then
			s = s and s..", "..k or k
		end
	end
	return s
end
function scan_res(ls, path, sub)
	local p = sub and fb_util.path_canonical(path..'\\'..sub) or path
	local l = fb_util.list_dir(p.."\\*")
	if l then
		ls = ls or {}
		for i, x in pairs(l) do
			local v, f, a = x[1], x[1]:lower(), x[2]
			if bit32.band(a, 32) ~= 0 and		-- is a file
					bit32.band(a, 2) == 0 then	-- not hidden
				local e = f:match(".*%.(.*)")
				if e and e ~= '' and table.index(CONF.res_fmt, e) then
					table.insert(ls, sub and sub..'\\'..v or v)
				end
			end
			if bit32.band(a, 16) ~= 0 and		-- is a folder
					bit32.band(a, 2) == 0 and	-- not hidden
					table.index(CONF.res_sub, f) then	-- should scan inside
				scan_res(ls, path, v)
			end
		end
	end
	return ls
end

-- id or path, either is ok
local path = get_var("path")
local pid = tonumber(get_var("id") or '')

local begin = tonumber(get_var("begin") or '0')
local count = tonumber(get_var("count") or '1e9')
local sort = get_var("sort") or "folder"
para = {
	ps = {},
	ns = {}
}
inf = {
	name = "root",
	path = nil,
	id = 0,
	parent = nil,
	ls = {},
	total = 0
}

if pid and pid > 0 then
	local i = math.floor(pid)
	local l = i == pid and "LENGTH(relative_path)" or math.ceil(pid*1000)%1000
	sql = "SELECT id, directory_path, relative_path, SUBSTR(relative_path, 1, l) as d"..
		" FROM (SELECT id as i, "..l.." as l, SUBSTR(relative_path, 1, "..l..") as r"..
			" FROM "..fb_env.db_path_table.." WHERE id="..i..")"..
		" LEFT JOIN "..fb_env.db_path_table.." ON d=r ORDER BY "..parse_sort(sort, sort_fields)
elseif path and path ~= '' then
	sql = "SELECT id, directory_path, relative_path, SUBSTR(relative_path, 1, "..path:utf8_len()..") as d"..
		" FROM "..fb_env.db_path_table.." WHERE d='"..path:gsub('\'', '\'\'').."' ORDER BY "..parse_sort(sort, sort_fields)
else
	sql = "SELECT id, NULL, relative_path, '', SUBSTR(relative_path, 1, INSTR(relative_path||'\\', '\\')) as g"..
		" FROM "..fb_env.db_path_table.." GROUP BY g ORDER BY "..parse_sort(sort, sort_fields)
end

local db = sqlite3.open(fb_env.db_file_name)
-- add folders to list
for id, dir, path, sub in db:urows(sql) do
	-- get self path and id
	if not inf.path then
		inf.path = sub
		inf.id = sub ~= '' and (id + sub:utf8_len()/1000) or nil
	end
	-- add tracks later 
	if sub == path then
		para.ps[id] = dir
	-- get child path and id
	elseif sub == '' or path:substr(sub:len()+1, 1) == '\\' then
		local b = sub == '' and 1 or sub:len() + 2				-- it should be the position after '\\' or 1
		local e = (path:find('\\', b) or (path:len() + 1)) - 1	-- position before next '\\' or path:len()
		local spath = path:sub(1, e)							-- path without '\\' at the end
		-- add to result if it is a subdirectory
		if b < e and not para.ns[spath] then
			para.ns[spath] = id
			inf.total = table.inspart(inf.ls, {
				typ = "folder",
				name = path:sub(b, e),
				path = spath,
				id = id + spath:utf8_len()/1000
			}, inf.total, begin, count)
		end
	end
end
-- get parent id and path if necessary
if inf.path and inf.path ~= '' then
	inf.name = inf.path:match(".*\\([^\\]+)") or inf.path
	local pos = inf.path:len() - inf.name:len() - 1
	local parent = pos >= 1 and inf.path:sub(1, pos) or ''
	inf.parent = {
		id = parent ~= '' and (math.floor(inf.id) + parent:utf8_len()/1000),
		path = parent,
		name = parent:match(".*\\([^\\]+)") or parent,
	}
end
-- add tracks to list
for pid, dir in pairs(para.ps) do
	-- if there is a mg.lua script in the folder, load and execute it
	local fname = dir.."\\"..CONF.ext_fname
	local extra = fb_util.file_exists(fname) and {} or nil
	if extra then
		(loadfile(fname:utf8_to_ansi(), 't', extra) or function()
			fb_util.log("load extra failed, file: \n", fname)
		end)()
	end
	-- query and add tracks
	for id, pid, title, num, artist, album, album_artist, length, seconds in
		db:urows("SELECT id, pid, title, tracknumber, artist, album, album_artist, length, length_seconds"..
			" FROM "..fb_env.db_track_table.." WHERE pid="..pid.." ORDER BY album, tracknumber") do
		inf.total = table.inspart(inf.ls, {
			typ = "track",
			name = title,
			num = num,
			artist = artist,
			album = album,
			album_artist = album_artist,
			length = length,
			seconds = seconds,
			inf = extra and extra.inf and (extra.inf[num] or extra.inf[title]),
			pid = pid,
			id = id
		}, inf.total, begin, count)
	end
	-- try get resource list
	inf.res = scan_res(inf.res, dir, extra and extra.res_path)
	if dir:lower():match('disc%d+$') or dir:lower():match('cd%d+$') then
		inf.res = scan_res(inf.res, dir, '..')
	end
	inf.extra = extra and extra.extra
end
db:close()

-- output as json
if get_var("tojson") then
	cjson.encode_sparse_array(true)
	print("HTTP/1.0 200 OK\r\n",
		"Content-Type: text/json;charset=utf-8\r\n",
		"\r\n",
		cjson.encode(inf))
-- display
else
	if inf.parent then
		inf.parent.url = request_info.uri..(inf.parent.id and "?id="..inf.parent.id or '')
		inf.url = inf.parent.url
	end
	for i, o in ipairs(inf.ls) do
		if o.typ == "folder" then
			o.url = request_info.uri.."?id="..o.id
		elseif o.typ == "track" then
			o.url = request_info.uri.."?id="..o.pid.."&play="..o.id
		end
	end
	(assert(loadfile(fb_env.doc_root.."\\view.lua")))(inf)
end
