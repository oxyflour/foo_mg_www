dofile(fb_env.doc_root.."\\common.lua")
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
			local v = get_var('word'..f) or word
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

local begin = tonumber(get_var("begin") or '0')
local count = tonumber(get_var("count") or '1e9')
inf = {
	name = get_var('name'),
	fields = get_var("fields") or "folder,title,artist,album",
	word = get_var("word"),
	path = get_var("path"),
	flist = get_var("flist"),
	tlist = get_var("tlist"),
	ls = {},
	begin = begin,
	total = 0
}
local db = sqlite3.open(fb_env.db_file_name)
if inf.flist or inf.tlist or inf.word then
	local cond = inf.flist and "id IN ("..num_escape(inf.flist)..")" or
		(inf.word and parse_search({
			folder = "relative_path"
		}, inf.fields, inf.word, inf.path))
	inf.flist = ''
	if cond then
		local ls = {}
		local sql = string.format([[SELECT id, relative_path||'\' FROM %s WHERE %s]],
			fb_env.db_path_table, cond)
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
			WHERE %s ORDER BY pid, album, tracknumber]], fb_env.db_track_table, fb_env.db_path_table, cond)
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
end
db:close()

if get_var("tojson") then
	cjson.encode_sparse_array(true)
	print("HTTP/1.0 200 OK\r\n",
		"Content-Type: text/json;charset=utf-8\r\n",
		"\r\n",
		cjson.encode(inf))
else
	inf.name = inf.name or "Browse All"
	inf.url = "browse.lua"
	for i, o in ipairs(inf.ls) do
		if o.typ == "folder" then
			o.url = "browse2.lua?path="..o.path:url_encode()
		elseif o.typ == "track" then
			o.url = request_info.uri.."?flist="..inf.flist.."&tlist="..inf.tlist..
				(inf.word and "&word="..inf.word or '').."&play="..o.id
		end
	end
	(assert(loadfile(fb_env.doc_root.."\\view.lua")))(inf)
end
