CONF = {
	-- default albumart file
	def_albumart = fb_env.doc_root.."\\nocover.jpg",
	-- albumart cache folder
	albumart_cache = fb_env.doc_root.."\\tmp\\cache",
	-- lyric search dir (saved as %artist% - %title%.lrc or %title%.lrc)
	lyric_dir = fb_env.doc_root.."\\tmp\\lyric",
	-- image magic convert.exe path
	image_magic_exe = fb_env.doc_root.."\\tmp\\ImageMagic\\convert.exe",
	-- extra lua script name
	ext_fname = "mg.lua",
	-- resource types
	res_fmt = {"jpg", "bmp", "png", "txt", "log"},
	-- also scan resource in these sub directorys
	res_sub = {"scans", "bk"}
}

string.md5 = fb_util.md5
string.url_encode = fb_util.url_encode
string.is_utf8 = fb_util.is_utf8
string.utf8_len = fb_util.utf8_len
-- 65001: utf-8, 0: system default.
-- see http://msdn.microsoft.com/en-us/library/windows/desktop/dd317756(v=vs.85).aspx
string.utf8_to_ansi = function(s)
	return fb_util.string_encode(s, 65001, 0)
end
string.ansi_to_utf8 = function(s)
	return fb_util.string_encode(s, 0, 65001)
end
string.utf16_to_utf8 = function(s)
	return fb_util.string_encode(s, 1200, 65001)
end

table.set = function(ls, key, val)
	ls[key] = val
	return val
end
table.each = function(ls, func, obj)
	for i, v in pairs(ls) do
		local r = func(i, v, obj)
		if r then
			return r
		end
	end
	return obj
end
table.index = function(ls, item)
	return table.each(ls, function(i, v)
		return v == item and i
	end)
end
table.inspart = function(ls, item, current, begin, count)
	current = current + 1
	if current > begin and current <= begin + count then
		ls[current] = item
	end
	return current
end
