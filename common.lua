CONF = {
	-- default albumart file
	def_albumart = fb_env.doc_root.."\\nocover.jpg",
	-- extra lua script name
	ext_fname = "mg.lua",
	-- resource types
	res_fmt = {"jpg", "bmp", "png", "txt"},
	-- also scan resource in these sub directorys
	res_sub = {"scans", "bk"}
}

string.url_encode = fb_util.url_encode
string.utf8_len = fb_util.utf8_len
string.utf8_to_ansi = fb_util.utf8_to_ansi
string.substr = function(s, b, c)
	return s:sub(b, c and b + c - 1)
end

table.each = function(ls, func)
	for i, v in pairs(ls) do
		local r = func(i, v)
		if r then
			return r
		end
	end
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
