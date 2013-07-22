dofile(fb_env.doc_root.."\\common.lua")
function parse_search(avail_fields, fields, word)
	local s = nil
	for f in fields:gmatch("[^,]+") do
		local k = avail_fields[f]
		if k then
			for w in word:gmatch("%S+") do
				local q = k.." LIKE '%"..w:gsub("%+", " ").."%'"
				s = s and s.." OR "..q or q
			end
		end
	end
	return s
end

local begin = tonumber(get_var("begin") or '0')
local count = tonumber(get_var("count") or '1e9')
inf = {
	fields = get_var("fields") and get_var("fields"):gsub("'", "''") or "folder,title,artist,album",
	word = get_var("word") and get_var("word"):gsub("'", "''"),
	flist = get_var("flist") and get_var("flist"):gsub("[^%d,]", ""),
	tlist = get_var("tlist") and get_var("tlist"):gsub("[^%d,]", ""),
	ls = {},
	total = 0
}
local db = sqlite3.open(fb_env.db_file_name)
if inf.flist or inf.tlist or inf.word then
	local flist = inf.flist; inf.flist = ''
	local tlist = inf.tlist; inf.tlist = ''
	local cond = flist and "id IN ("..flist..")" or
		(inf.word and parse_search({folder = "relative_path"}, inf.fields, inf.word))
	if (cond) then
		for id, dir in db:urows("SELECT id, relative_path FROM "..fb_env.db_path_table..
				" WHERE "..cond) do
			inf.flist = inf.flist ~= '' and inf.flist..','..id or id
			inf.total = table.inspart(inf.ls, {
				typ = "folder",
				name = dir,
				path = dir,
				id = id
			}, inf.total, begin, count)
		end
	end
	local cond = tlist and "t.id IN ("..tlist..")" or
		(inf.word and parse_search({title = "title", artist = "artist", album = "album"}, inf.fields, inf.word))
	if (cond) then
		for id, pid, title, num, artist, album, album_artist, length, seconds, path in
			db:urows("SELECT t.id, pid, title, tracknumber, artist, album, album_artist, length, length_seconds, relative_path"..
				" FROM "..fb_env.db_track_table.." as t"..
				" LEFT JOIN "..fb_env.db_path_table.." as p ON p.id=t.pid"..
				" WHERE "..cond..
				" ORDER BY pid, album, tracknumber") do
			inf.tlist = inf.tlist ~= '' and inf.tlist..','..id or id
			inf.total = table.inspart(inf.ls, {
				typ = "track",
				name = title,
				num = num,
				artist = artist,
				album = album,
				album_artist = album_artist,
				length = length,
				seconds = seconds,
				pid = pid,
				path = path,
				id = id
			}, inf.total, begin, count)
		end
	end
end
db:close()

inf.name = get_var("name")
if inf.name then
end

if get_var("tojson") then
	cjson.encode_sparse_array(true)
	print("HTTP/1.0 200 OK\r\n",
		"Content-Type: text/json;charset=utf-8\r\n",
		"\r\n",
		cjson.encode(inf))
else
	inf.name = inf.name or "Browse Items"
	inf.url = "browse.lua"
	for i, o in ipairs(inf.ls) do
		if o.typ == "folder" then
			o.url = "browse.lua?id="..o.id
		elseif o.typ == "track" then
			o.url = request_info.uri.."?flist="..inf.flist.."&tlist="..inf.tlist..
				(inf.word and "&word="..inf.word or '').."&play="..o.id
		end
	end
	(assert(loadfile(fb_env.doc_root.."\\view.lua")))(inf)
end
