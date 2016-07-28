dofile(fb_env.script_path:match('(.*\\).*')..'common.lua')

function query_path_info(path)
	path = path:gsub('/', '\\')

	local sql = string.format([[SELECT
		i,
		artist,
		title,
		album,
		codec,
		filename_ext,
		subsong,
		d,
		SUBSTR(d, 1, r)
	FROM (SELECT id AS i,
			directory_path AS d,
			CAST(SUBSTR(path_index, 1, 3) AS INTEGER) AS r
		FROM %s
		WHERE SUBSTR(relative_path, 1, %d)='%s'
		ORDER BY add_date DESC LIMIT 0,1)
	LEFT JOIN %s
		ON pid=i
	LIMIT 0,1]],
		fb_env.db_path_table, path:utf8_len(),
		path:gsub("'", "''"), fb_env.db_track_table)

	local path_info = { }

	local db = sqlite3.open(fb_env.db_file_name)
	for id, artist, title, album, codec, file, subsong, dir, root in db:urows(sql) do
		path_info.physical_dir = root..path
		path_info.latest_track_id = id
		path_info.latest_track_path = dir..file
	end
	db:close()

	return path_info
end

function create_albumart_thumb(track_path, thumb_path, thumb_size)
	local thumb_dir = thumb_path:match('(.*)\\.*$')
	if fb_util.file_stat(thumb_dir) == nil then
		fb_util.exec('cmd', string.format('/C mkdir "%s"', thumb_dir))
	end

	local cover_tmp = config.albumart_cache..os.tmpname()..fb_util.random()
	local thumb_tmp = config.albumart_cache..os.tmpname()..fb_util.random()

	local convert_arg = string.format('"%s" -thumbnail "%dx%d^" "%s"',
		cover_tmp, thumb_size, thumb_size, thumb_tmp)
	local cleanup_arg = string.format('/C move /Y "%s" "%s" && del "%s"',
		thumb_tmp, thumb_path, cover_tmp)

	return fb_stream.extract_albumart(track_path, cover_tmp) > 0 and
		fb_util.exec(config.image_magic_exe, convert_arg) == 0 and
		fb_util.exec('cmd', cleanup_arg) == 0
end

local virtual_path = request_info.get_virtual_path()
local path_mat, res_mat = virtual_path:match('/(.*/)~/(.*)$')
local path = path_mat or ''
local path_info = query_path_info(path)
local res = res_mat or virtual_path:match('~/(.*)$')
local name, ext = res:match('(.*)%.(.*)$')
local sent = -1

if res and res:lower() == 'cover.thumb.jpg' and config.albumart_cache then
	local cache_path = config.albumart_cache..'\\'..
		path:gsub('/', '\\')..path_info.latest_track_id..'.jpg'
	if fb_util.file_stat(cache_path) then
		sent = fb_stream.stream_file(cache_path)
	elseif create_albumart_thumb(path_info.latest_track_path, cache_path, 150) then
		sent = fb_stream.stream_file(cache_path)
	else
		sent = fb_stream.stream_file(config.def_albumart)
	end
elseif ext and config.allowed_resource[ext:lower()] then
	local file_path = fb_util.path_canonical(path_info.physical_dir..res)

	sent = fb_stream.stream_file(file_path)
end

if sent < 0 then
	print('HTTP/1.0 403 OK\r\n\r\n')
end