dofile(fb_env.doc_root.."\\common.lua")
function get_path(path)
	if not path or path == '' then path = '\\' end
	if path:sub(1, 1) ~= '\\' then path = '\\'..path end
	if path:sub(-1) ~= '\\' then path = path..'\\' end
	local s, n = path:gsub('\\', '')
	return path, n
end
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
	return s and 'ORDER BY '..s or ''
end
function scan_res(ls, path, sub)
	local p = sub and fb_util.path_canonical(path..sub..'\\') or path
	local l = fb_util.list_dir(p.."*")
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

local path, n = get_path(get_var("path"))
local begin = tonumber(get_var("begin") or '0')
local count = tonumber(get_var("count") or '1e9')
local sort = get_var("sort") or ''
inf = {
	name = path:match('.*\\([^\\]+)\\') or 'root',
	path = path:sub(2),
	parent = path:len() > 1 and {
		path = path:sub(2):match('(.*\\)[^\\]+\\'),
		name = path:match('.*\\([^\\]+)\\[^\\]+\\')
	} or nil,
	id = nil,	-- only folder with tracks will have an id
	ls = {},	-- the item index is the key (starting from 1)
	total = 0
}

local db = sqlite3.open(fb_env.db_file_name)
local tls = { }
local sql = string.format([[SELECT
	i,
	SUBSTR(d, 1, e) AS s,
	SUBSTR(d, r, e-r+1) AS p,
	LENGTH(d)
FROM (SELECT *,
		id AS i,
		directory_path||'\' AS d,
		CAST(SUBSTR(path_index, 1, 3) AS INTEGER) AS r,
		MAX(CAST(SUBSTR(path_index, %d, 3) AS INTEGER),
			CAST(SUBSTR(path_index, %d, 3) AS INTEGER))+1 AS e
	FROM %s)
WHERE SUBSTR(d, r, %d)='%s' GROUP BY p %s]],
	n*3-2, n*3+1, fb_env.db_path_table, path:utf8_len(), path:gsub('\'', '\'\''), parse_sort(sort, sort_fields))
for id, dir, sub, len in db:urows(sql) do
	if sub == path then
		inf['id'], tls[id] = id, dir
	else
		inf.total = table.inspart(inf.ls, {
			typ = "folder",
			name = sub:match('.*\\([^\\]+)\\'),
			path = sub:sub(2),
			id = dir:utf8_len() == len and id or nil
		}, inf.total, begin, count)
	end
end

for pid, dir in pairs(tls) do
	local fname = dir.."\\"..CONF.ext_fname
	local extra = fb_util.file_exists(fname) and {} or nil
	if extra then
		(loadfile(fname:utf8_to_ansi(), 't', extra) or function()
			fb_util.log("load extra failed, file: \n", fname)
		end)()
	end
	local sql = string.format([[SELECT id, title, tracknumber, artist, album, album_artist, length, length_seconds
		FROM %s WHERE pid=%d ORDER BY album, tracknumber]], fb_env.db_track_table, pid)
	for id, title, num, artist, album, album_artist, length, seconds in db:urows(sql) do
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
			id = id
		}, inf.total, begin, count)
	end
	-- try get resource list
	inf.res = scan_res(inf.res, dir, extra and extra.res_path)
	if dir:lower():match('disc%s*%d+\\$') or dir:lower():match('cd%s*%d+\\$') then
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
			o.url = request_info.uri.."?path="..o.path:url_encode()
		elseif o.typ == "track" then
			o.url = request_info.uri.."?path="..inf.path:url_encode().."&play="..o.id
		end
	end
	(assert(loadfile(fb_env.doc_root.."\\view.lua")))(inf)
end
