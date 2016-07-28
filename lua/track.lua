dofile(fb_env.script_path:match('(.*\\).*')..'common.lua')

function get_default_support()
	local ua = ''
	for name, value in pairs(request_info.http_headers) do
		if name:lower() == 'user-agent' then
			ua = value
		end
	end

	if ua:find("MSIE") or ua:find('Trident') then
		return "mp3"
	elseif ua:find("Firefox") then
		return "mp3,wav"
	else
		return "mp3,wav"
	end
end

function get_supported_codecs()
	local support = get_var('support') or get_default_support()
	local codecs = { }
	for codec in support:gmatch('[^,]+') do
		codecs[codec] = 1
	end
	return codecs
end

function query_track_info(id)
	local sql = string.format([[SELECT
		artist,
		title,
		album,
		codec,
		filename_ext,
		subsong,
		directory_path,
		directory_path
	FROM %s AS tp
	LEFT JOIN %s AS tt
		ON pid=tp.id
	WHERE tt.id=%d ORDER BY add_date DESC LIMIT 0,1]],
		fb_env.db_path_table, fb_env.db_track_table, id)

	local track_info = { }

	local db = sqlite3.open(fb_env.db_file_name)
	for artist, title, album, codec, file, subsong, dir, root in db:urows(sql) do
		track_info.artist = artist
		track_info.title = title
		track_info.album = album
		track_info.codec = codec:lower()
		track_info.file = dir..file
		track_info.sub = subsong
	end
	db:close()

	return track_info
end

local virtual_path = request_info.get_virtual_path()
local name, ext = virtual_path:match('/(%d+)%.(.*)$')
local track_id = name or virtual_path:match('/(%d+)$')
local track_info = query_track_info(tonumber(track_id))
local sent = -1

local supported_codecs = { }
if ext then
	supported_codecs[ext] = 1
else
	supported_codecs = get_supported_codecs()
end

if supported_codecs.jpg then
	sent = fb_stream.stream_albumart(track_info.file)
elseif supported_codecs[track_info.codec] and track_info.sub == 0 then
	sent = fb_stream.stream_file(track_info.file)						-- no decoding
elseif supported_codecs.wav then
	sent = fb_stream.stream_wav(track_info.file, track_info.sub, 0, 16)	-- 16bit wave
else
	sent = fb_stream.stream_mp3(track_info.file, track_info.sub, 0, 2)	-- vbr mp3, quality 2, [320kbps]
end

if supported_codecs.jpg and sent < 0 then
	sent = fb_stream.stream_file(config.def_albumart)
end

if sent < 0 then
	print('HTTP/1.0 403 OK\r\n\r\n')
end