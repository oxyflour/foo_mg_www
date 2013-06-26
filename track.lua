dofile(fb_env.doc_root.."\\common.lua")
function opt_find(opts, item, sep)
	return (sep..opts..sep):find(sep..item..sep)
end
request_info.http_headers_lower = {}
for v, k in pairs(request_info.http_headers) do
	request_info.http_headers_lower[v:lower()] = k
end

-- get parameter
support = get_var("support") or (function(ua)
	if ua:find("MSIE") then
		return "mp3"
	else
		return "mp3,wav"
	end
end)(request_info.http_headers_lower["user-agent"] or "")
id = tonumber(get_var("id")) + 0

path = nil
subsong = 0
-- query track path
local db = sqlite3.open(fb_env.db_file_name)
for d, f, s in db:urows("SELECT directory_path, filename_ext, subsong FROM "..fb_env.db_track_table.." as t"..
		" LEFT JOIN "..fb_env.db_path_table.." as p ON (t.pid=p.id)"..
		" WHERE t.id="..id.." LIMIT 0,1") do
	path, subsong = d..'\\'..f, s
end
db:close()

-- decode and stream the track
if path and path ~= '' and subsong >= 0 then
	local fmt = path:match(".*%.(.*)")
	if fmt and subsong == 0 and opt_find(support, fmt, ',') and
			not opt_find(support, 'force', ',') then
		send = fb_stream.stream_file(path)					-- no decoding
	elseif  opt_find(support, "wav", ',') then
		send = fb_stream.stream_wav(path, subsong, 0, 16)	-- 16bit wave
	else
		send = fb_stream.stream_mp3(path, subsong, 0, 2)	-- vbr mp3, quality 2, [320kbps]
	end

	if send < 0 then
		print("HTTP/1.0 500 OK\r\n\r\n")
	end
end
