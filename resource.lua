dofile(fb_env.doc_root.."\\common.lua")

-- get parameter
id = tonumber(get_var("id") or '0')
pid = math.floor(tonumber(get_var("pid") or '0'))
path = get_var("path")
res = get_var("res")

local db = sqlite3.open(fb_env.db_file_name)
for dir, fname in db:urows("SELECT directory_path, filename_ext FROM "..fb_env.db_track_table.." as t"..
		" LEFT JOIN "..fb_env.db_path_table.." as p ON (t.pid=p.id)"..
		" WHERE "..((id > 0 and "t.id="..id) or
			(pid > 0 and "t.pid="..pid.." LIMIT 0,1") or
			(path and "relative_path='"..path:gsub('\'', '\'\'').."'"))) do
	if res then
		local ext = res:match(".*%.(.*)")
		-- check file extension
		res_path = ext and table.index(CONF.res_fmt, ext:lower()) and
			fb_util.path_canonical(dir..'\\'..res)
		res_ext = ext
	else
		track_path = dir..'\\'..fname
	end
end
db:close()

if track_path and track_path ~= '' then
	local w = tonumber(get_var('w') or '0')
	if w < 100 then
		w = 100
	else
		w = 0
	end
	local fcache = (pid > 0 or path) and CONF.albumart_cache and
		CONF.albumart_cache..'\\'..pid
	local fsend = fcache and fcache..(w > 0 and 'w'..w or '')
	if fsend and fb_util.file_exists(fsend) then
		fb_stream.stream_file(fsend)
	else
		local send = -1
		if fsend then
			if not fb_util.file_exists(fcache) then
				local ftmp = CONF.albumart_cache..'\\tmp'..pid..fb_util.random()
				fb_stream.extract_albumart(track_path, ftmp)
				if fb_util.file_exists(ftmp) then
					fb_util.move_file(ftmp, fcache)
				end
			end
			if fb_util.file_exists(fcache) and fcache ~= fsend then
				cmd = 'G:\\Share\\foo_mg_www\\tmp\\ImageMagic\\convert.exe '..
					'"'..fcache..'" -resize '..w..'x'..w..' "'..fsend..'"'
				os.execute(cmd:utf8_to_ansi())
			end
			if fb_util.file_exists(fsend) then
				send = fb_stream.stream_file(fsend)
			end
		else
			send = fb_stream.stream_albumart(track_path)
		end
		if send < 0 and not get_var("nofallback") then
			fb_stream.stream_file(CONF.def_albumart)
		end
	end
elseif res_path and fb_util.file_exists(res_path) then
	if res_ext == 'txt' then
		local file = io.open(res_path:utf8_to_ansi(), 'r')
		local content = file:read('*all')
		file:close()
		if not content:is_utf8() then
			content = content:ansi_to_utf8()
		end
		print('HTTP/1.0 200 OK\r\n',
			'Content-Type: text/html;charset=utf-8\r\n',
			'Content-Length: ', content:len(), '\r\n',
			'\r\n', content)
	else
		fb_stream.stream_file(res_path)
	end
end
