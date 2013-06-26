dofile(fb_env.doc_root.."\\common.lua")

-- get parameter
id = tonumber(get_var("id") or '')
pid = tonumber(get_var("pid") or '')
res = get_var("res")

local db = sqlite3.open(fb_env.db_file_name)
for dir, fname in db:urows("SELECT directory_path, filename_ext FROM "..fb_env.db_track_table.." as t"..
		" LEFT JOIN "..fb_env.db_path_table.." as p ON (t.pid=p.id)"..
		" WHERE "..((id and id > 0 and "t.id="..id) or (pid and pid > 0 and "t.pid="..math.floor(pid).." LIMIT 0,1"))) do
	if res then
		local ext = res:match(".*%.(.*)")
		-- check file extension
		res_path = ext and table.index(CONF.res_fmt, ext:lower()) and
			fb_util.path_canonical(dir..'\\'..res)
	else
		track_path = dir..'\\'..fname
	end
end
db:close()

if track_path and track_path ~= '' then
	if fb_stream.stream_albumart(track_path) < 0 and
			not get_var("nofallback") then
		fb_stream.stream_file(CONF.def_albumart)
	end
elseif res_path and fb_util.file_exists(res_path) then
	fb_stream.stream_file(res_path)
end
