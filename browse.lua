dofile(fb_env.doc_root.."\\common.lua")
function get_path(path)
	if not path or path == '' then path = '\\' end
	if path:sub(1, 1) ~= '\\' then path = '\\'..path end
	if path:sub(-1) ~= '\\' then path = path..'\\' end
	local s, n = path:gsub('\\', '')
	return path, n
end
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
			local s = sub and sub..'\\'..v or v
			if bit32.band(a, 32) ~= 0 and		-- is a file
					bit32.band(a, 2) == 0 then	-- not hidden
				local e = f:match(".*%.(.*)")
				if e and e ~= '' and table.index(CONF.res_fmt, e) then
					table.insert(ls, s)
				end
			end
			if bit32.band(a, 16) ~= 0 and		-- is a folder
					bit32.band(a, 2) == 0 and	-- not hidden
					table.index(CONF.res_sub, f) then	-- should scan inside
				scan_res(ls, path, s)
			end
		end
	end
	return ls
end

function sql_escape(s)
	return s and s:gsub('\'', '\'\'')
end
function num_escape(s)
	return s and s:gsub('[^%d,]', '')
end
function like_escape(s, c)
	return s and s:gsub('\'', '\'\''):gsub('[%%_%[%]'..c..']', c..'%1')
end
function parse_search(avail_fields, fields, word, path)
	local s, c = nil, '~'
	for f in fields:gmatch("[^,]+") do
		local k = avail_fields[f]
		if k then
			local v = get_var('word_'..f) or word
			for w in v:gmatch("[^|]+") do
				local q = string.format([[%s LIKE '%%%s%%' ESCAPE '%s']], sql_escape(k), like_escape(w, c), c)
				s = s and s.." OR "..q or q
			end
		end
	end
	if s and path then
		s = string.format([[(%s) AND relative_path||'\' LIKE '%s%%' ESCAPE '%s']], s, like_escape(path, c), c)
	end
	return s
end

local path, n = get_path(get_var("path"))
local begin = tonumber(get_var("begin") or '0')
local count = tonumber(get_var("count") or '1e9')
local sort = get_var("sort") or ''
inf = {
	name = get_var('name') or path:match('.*\\([^\\]+)\\') or 'root',
	ls = {},	-- the item index is the key (starting from 1)
	begin = begin,
	total = 0,

	-- for browse only
	path = path:sub(2),
	parent = path:len() > 1 and {
		path = path:sub(2):match('(.*\\)[^\\]+\\'),
		name = path:match('.*\\([^\\]+)\\[^\\]+\\')
	} or nil,
	id = nil,	-- only folder with tracks will have an id

	-- for search only
	fields = get_var("fields"),
	word = get_var("word"),
	flist = get_var("flist"),
	tlist = get_var("tlist"),
}
local folder_sort_fields = {
	flist = inf.flist and string.format("instr(',%s,', ','||id||',')", num_escape(inf.flist)),
	folder = "directory_path",
	folder_desc = "directory_path DESC",
	date = "add_date DESC",
	date_desc = "add_date"
}
local track_sort_fields = {
	tlist = inf.tlist and string.format("instr(',%s,', ','||t.id||',')", num_escape(inf.tlist)),
	path = 'pid',
	album = 'album',
	num = 'tracknum'
}

local db = sqlite3.open(fb_env.db_file_name)
if inf.flist or inf.tlist or inf.word then -- search
	inf.fields = inf.fields or "folder,title,artist,album"
	local cond = inf.flist and "id IN ("..num_escape(inf.flist)..")" or
		(inf.word and parse_search({
			folder = "relative_path"
		}, inf.fields, inf.word, inf.path))
	inf.flist = ''
	if cond then
		local ls = {}
		local sql = string.format([[SELECT id, relative_path||'\' FROM %s WHERE %s %s]],
			fb_env.db_path_table, cond, parse_sort(sort, folder_sort_fields))
		for id, dir in db:urows(sql) do
			table.insert(ls, id)
			inf.total = table.inspart(inf.ls, {
				typ = "folder",
				name = dir,
				path = dir,
				id = id
			}, inf.total, begin, count)
		end
		inf.flist = table.concat(ls, ',')
	end

	local cond = inf.tlist and "t.id IN ("..num_escape(inf.tlist)..")" or
		(inf.word and parse_search({
			title = "title",
			artist = "artist",
			album = "album"
		}, inf.fields, inf.word, inf.path))
	inf.tlist = ''
	if cond then
		local ls = {}
		local sql = string.format([[SELECT t.id, pid, title, tracknumber, artist, album, album_artist,
				length, length_seconds, relative_path||'\'
			FROM %s as t
			LEFT JOIN %s as p ON p.id=t.pid
			WHERE %s %s]], fb_env.db_track_table, fb_env.db_path_table, cond,
			parse_sort(sort or 'pid,album,tracknumber', track_sort_fields))
		for id, pid, title, num, artist, album, album_artist, length, seconds, path in db:urows(sql) do
			table.insert(ls, id)
			inf.total = table.inspart(inf.ls, {
				typ = "track",
				name = title,
				num = num,
				artist = artist,
				album = album,
				album_artist = album_artist,
				length = length,
				seconds = seconds,
				path = path,
				id = id
			}, inf.total, begin, count)
		end
		inf.tlist = table.concat(ls, ',')
	end
else -- browse
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
		n*3-2, n*3+1, fb_env.db_path_table, path:utf8_len(), path:gsub('\'', '\'\''), parse_sort(sort, folder_sort_fields))
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
		local extra = fb_util.file_stat(fname) and {} or nil
		if extra then
--			local date = os.date('%Y-%m-%d %H:%M:%S', attr.modified)
--			(loadfile(fname:utf8_to_ansi(), 't', extra) or function()
--				fb_util.log("load extra failed, file: \n", fname)
--			end)()
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
		inf.parent.url = request_info.uri..(inf.parent.path and "?path="..inf.parent.path:url_encode() or '')
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
