dofile(fb_env.doc_root.."\\common.lua")
function opt_find(opts, item, sep)
	return (sep..opts..sep):find(sep..item..sep)
end
local http_headers_lower = {}
for v, k in pairs(request_info.http_headers) do
	http_headers_lower[v:lower()] = k
end

-- get parameter
local support = get_var("support") or (function(ua)
	if ua:find("MSIE") then
		return "mp3"
	else
		return "mp3,wav"
	end
end)(http_headers_lower["user-agent"] or "")
local id = tonumber(get_var("id")) + 0
local path = nil
local subsong = 0

-- query track path
local db = sqlite3.open(fb_env.db_file_name)
local sql = string.format([[SELECT directory_path, filename_ext, subsong FROM %s as t
	LEFT JOIN %s as p ON (t.pid=p.id)
	WHERE t.id=%d LIMIT 0,1]], fb_env.db_track_table, fb_env.db_path_table, id)
for d, f, s in db:urows(sql) do
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
