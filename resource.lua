dofile(fb_env.doc_root.."\\common.lua")
function opt_find(opts, item, sep)
	return (sep..opts..sep):find(sep..item..sep)
end
function get_path(path)
	if not path or path == '' then path = '\\' end
	if path:sub(1, 1) ~= '\\' then path = '\\'..path end
	if path:sub(-1) ~= '\\' then path = path..'\\' end
	local s, n = path:gsub('\\', '')
	return path, n
end
function get_size(width, size)
	local w = tonumber(width or '1000')
	local s = size
	if w <= 150 or s == 'small' then
		w, s = 150, 'small'
	elseif w <= 400 or s == 'medium' then
		w, s = 400, 'medium'
	else
		w, s = 0, nil
	end
	return {
		width = w,
		size = s
	}
end
function get_file(fname, hash)
	return {
		fname = fname,
		attr = fb_util.file_stat(fname),
		hash = hash
	}
end
function get_cover(browse_dir, track_file)
	local cover = get_file(browse_dir..'cover.jpg', browse_dir:md5())
	if cover.attr then return cover end

	local hash = track_file:match('(.*)\\.*'):md5()
	cover = get_file(CONF.albumart_cache..'\\'..hash, hash)
	if cover.attr then return cover end

	local ftmp = CONF.albumart_cache..os.tmpname()..fb_util.random()
	if fb_stream.extract_albumart(track_file, ftmp) > 0 then
		fb_util.exec('cmd', string.format('/C move /Y "%s" "%s"', ftmp, cover.fname))
	end
	return get_file(cover.fname, hash)
end
function get_thumb(cover, sz)
	local thumb = get_file(sz.size and string.format('%s\\%s_s%d_%s',
		CONF.albumart_cache, cover.hash, cover.attr.size, sz.size) or cover.fname)
	if thumb.attr then return thumb end

	local ftmp = CONF.albumart_cache..os.tmpname()..fb_util.random()
	if fb_util.exec(CONF.image_magic_exe, 
			string.format('"%s" -thumbnail "%dx%d^" "%s"', cover.fname, sz.width, sz.width, ftmp)) == 0 then
		fb_util.exec('cmd', string.format('/C move /Y "%s" "%s"', ftmp, thumb.fname))
	end
	return get_file(thumb.fname)
end
function get_utf8_text(fname)
	local file = io.open(fname:utf8_to_ansi(), 'r')
	local content = file:read('*all')
	file:close()
	local encodings = {nil, string.ansi_to_utf8, string.utf16_to_utf8}
	return table.each(encodings, function(i, v)
		local t = v and v(content) or content
		if t:sub(1, 50):is_utf8() then
			return content
		end
	end, content)
end

local id = tonumber(get_var("id") or '0')
local path, n = get_path(get_var("path"))
local res = get_var("res")

local db = sqlite3.open(fb_env.db_file_name)
local sql = id > 0 and
string.format([[SELECT
	artist,
	title,
	filename_ext,
	directory_path||'\',
	directory_path||'\',
	subsong
FROM %s AS tp
LEFT JOIN %s AS tt
	ON pid=tp.id
WHERE tt.id=%d ORDER BY add_date DESC LIMIT 0,1]], fb_env.db_path_table, fb_env.db_track_table, id) or
string.format([[SELECT
	artist,
	title,
	filename_ext,
	d,
	SUBSTR(d, 1, b+1) AS s,
	subsong
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
for artist, title, file, dir, path, subsong in db:urows(sql) do
	browse_dir = path
	track_artist = artist
	track_title = title
	track_file = dir..file
	track_sub = subsong
end
db:close()

if not res and id > 0 and track_file and track_file ~= '' and track_sub >= 0 then
	local ua = table.each(request_info.http_headers, function(i, v, d)
		d[i:lower()] = v
	end, {})["user-agent"]
	local support = get_var("support") or (function(ua)
		if ua:find("MSIE") then
			return "mp3"
		else
			return "mp3,wav"
		end
	end)(ua or "")

	local file_ext = track_file:match(".*%.(.*)")
	if file_ext and track_sub == 0 and opt_find(support, file_ext, ',') and
			not opt_find(support, 'force', ',') then
		send = fb_stream.stream_file(track_file)					-- no decoding
	elseif  opt_find(support, "wav", ',') then
		send = fb_stream.stream_wav(track_file, track_sub, 0, 16)	-- 16bit wave
	else
		send = fb_stream.stream_mp3(track_file, track_sub, 0, 2)	-- vbr mp3, quality 2, [320kbps]
	end

	if send < 0 then
		print("HTTP/1.0 500 OK\r\n\r\n")
	end
elseif res == 'lyric' and id > 0 and track_file and track_file ~= '' then
	local content = ''
	if table.set(_G, 'track_dir', track_file:match("(.*\\).*")) and
			table.set(_G, 'lyric_path', track_dir..track_title..'.lrc') and
			fb_util.file_stat(lyric_path) then
		content = get_utf8_text(lyric_path)
	end
	if content == '' and CONF.lyric_dir and
			table.set(_G, 'lyric_path', CONF.lyric_dir..'\\'..track_artist..' - '..track_title..'.lrc') and
			fb_util.file_stat(lyric_path) then
		content = get_utf8_text(lyric_path)
	end
	print('HTTP/1.1 200 OK\r\n',
		'Content-Type: text/plain;charset=utf-8\r\n',
		'Content-Length: ', content:len(), '\r\n',
		'\r\n', content)
elseif res == 'albumart' and track_file and track_file ~= '' then
	local send = -1
	if id > 0 then -- do not use cache for tracks
		send = fb_stream.stream_albumart(track_file)
	else -- only use cache for folders
		local fs, sz = {}, get_size(get_var('w'), get_var('s'))
		if CONF.albumart_cache and
				table.set(fs, 'cover', get_cover(browse_dir, track_file)).attr and
				table.set(fs, 'thumb', get_thumb(fs.cover, sz)).attr then
			send = fb_stream.stream_file(fs.thumb.fname)
		elseif fs.cover and fs.cover.attr then
			send = fb_stream.stream_file(fs.cover.fname)
		else
			send = fb_stream.stream_albumart(track_file)
		end
	end
	-- stream default if we failed
	if send < 0 and not get_var("nofallback") then
		fb_stream.stream_file(CONF.def_albumart)
	end
elseif res and browse_dir and browse_dir ~= '' and
		table.set(_G, 'file_ext', res:match(".*%.(.*)")) and 
		table.set(_G, 'file_ext', file_ext:lower()) and 
		table.index(CONF.res_fmt, file_ext) and
		table.set(_G, 'res_path', fb_util.path_canonical(browse_dir..res)) and
		fb_util.file_stat(res_path) then
	if file_ext == 'txt' or file_ext == 'log' then
		local content = get_utf8_text(res_path)
		print('HTTP/1.1 200 OK\r\n',
			'Content-Type: text/plain;charset=utf-8\r\n',
			'Content-Disposition: inline\r\n', -- always display in browser window
			'Content-Length: ', content:len(), '\r\n',
			'\r\n', content)
	else
		fb_stream.stream_file(res_path)
	end
end
