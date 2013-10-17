dofile(fb_env.doc_root.."\\common.lua")
function get_path(path)
	if not path or path == '' then path = '\\' end
	if path:sub(1, 1) ~= '\\' then path = '\\'..path end
	if path:sub(-1) ~= '\\' then path = path..'\\' end
	local s, n = path:gsub('\\', '')
	return path, n
end
function create_cover(ftrack, pid, fcover)
	if fb_util.file_exists(fcover) then
		return true
	else
		local ftmp = CONF.albumart_cache..'\\tmp_cover'..pid..'x'..fb_util.random()
		if fb_stream.extract_albumart(track_file, ftmp) > 0 then
			fb_util.exec('cmd', string.format('/C move /Y "%s" "%s"', ftmp, fcover))
		end
		return fb_util.file_exists(fcover)
	end
end
function create_thumb(fcover, pid, w, fthumb)
	 if fcover == fthumb then
		 return true
	 else
		local ftmp = CONF.albumart_cache..'\\tmp_cache'..pid..'x'..fb_util.random()
		if fb_util.exec('G:\\Share\\foo_mg_www\\tmp\\ImageMagic\\convert.exe', 
				string.format('"%s" -thumbnail "%dx%d^" "%s"', fcover, w, w, ftmp)) == 0 then
			fb_util.exec('cmd', string.format('/C move /Y "%s" "%s"', ftmp, fthumb))
		end
		return fb_util.file_exists(fthumb)
	 end
end

-- get parameter
local id = tonumber(get_var("id") or '0')
local path, n = get_path(get_var("path"))
local res = get_var("res")

local db = sqlite3.open(fb_env.db_file_name)
local sql = id > 0 and
string.format([[SELECT
	filename_ext,
	directory_path||'\',
	directory_path||'\'
FROM %s AS tp
LEFT JOIN %s AS tt
	ON pid=tp.id
WHERE tt.id=%d ORDER BY add_date DESC LIMIT 0,1]], fb_env.db_path_table, fb_env.db_track_table, id) or
string.format([[SELECT
	filename_ext,
	d,
	SUBSTR(d, 1, b+1) AS s
FROM (SELECT *,
		id AS i,
		directory_path||'\' AS d,
		CAST(SUBSTR(path_index, 1, 3) AS INTEGER) AS r,
		CAST(SUBSTR(path_index, %d, 3) AS INTEGER) AS b
	FROM %s)
LEFT JOIN %s
	ON pid=i
WHERE SUBSTR(d, r, %d)='%s' ORDER BY add_date DESC LIMIT 0,1]],
	n*3-2, fb_env.db_path_table, fb_env.db_track_table, path:utf8_len(), path:gsub('\'', '\'\''))
for file, dir, path in db:urows(sql) do
	if res then
		local ext = res:match(".*%.(.*)")
		-- check file extension
		res_path = ext and table.index(CONF.res_fmt, ext:lower()) and
			fb_util.path_canonical(path..res)
		res_ext = ext
	else
		browse_path = path
		track_path = dir
		track_file = dir..file
	end
end
db:close()

if track_file and track_file ~= '' then
	local send = -1
	-- do not use cache for tracks
	if id > 0 then
		send = fb_stream.stream_albumart(track_file)
	-- only use cache for folders
	else
		local w = tonumber(get_var('w') or '0')
		local s = get_var('s')
		if w <= 150 or s == 'small' then
			w, s = 150, '_small'
		elseif w <= 400 or s == 'medium' then
			w, s = 400, '_medium'
		else
			w, s = 0, ''
		end

		local fcover, hash = browse_path..'cover.jpg', browse_path:md5()
		if not fb_util.file_exists(fcover) then
			hash = track_file:match('(.*)\\.*'):md5()
			fcover = CONF.albumart_cache and CONF.albumart_cache..'\\'..hash
		end
		local fthumb = fcover
		if s ~= '' and fcover then
			local attr = fb_util.file_stat(fcover)
			local name = hash..'_s'..(attr and attr.size or '')..s
			fthumb = CONF.albumart_cache and CONF.albumart_cache..'\\'..name
		end
		-- cache ready
		if fthumb and fb_util.file_exists(fthumb) then
			fb_stream.stream_file(fthumb)
		-- not cached now, but we can create it
		elseif fthumb then
			if create_cover(track_file, hash, fcover) and
					create_thumb(fcover, hash, w, fthumb) then
				send = fb_stream.stream_file(fthumb)
			end
		-- cache not ready
		else
			send = fb_stream.stream_albumart(track_file)
		end
	end
	-- stream default if we failed
	if send < 0 and not get_var("nofallback") then
		fb_stream.stream_file(CONF.def_albumart)
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
