config = {
	-- default albumart file
	def_albumart = fb_env.doc_root..'\\img\\nocover.jpg',
	-- albumart cache folder
	albumart_cache = fb_env.doc_root..'\\tmp',
	-- image magic convert.exe path
	image_magic_exe = fb_env.doc_root.."\\tmp\\ImageMagic\\convert.exe",
	-- allowed resource types
	allowed_resource = { jpg=1, bmp=1, png=1, txt=1, log=1 },
	-- also scan resource in these sub directorys
	scan_sub_directory = { scans=1, bk=1 },
}

string.md5 = fb_util.md5
string.url_encode = fb_util.url_encode
string.is_utf8 = fb_util.is_utf8
string.utf8_len = fb_util.utf8_len
string.utf8_sub = fb_util.utf8_sub
string.utf8_to_ansi = function(s)
	return fb_util.utf8_to_codepage(s, 0)
end
string.ansi_to_utf8 = function(s)
	return fb_util.codepage_to_utf8(s, 0)
end
string.sql_escape = function(s)
	return s and s:gsub('\'', '\'\'')
end
string.like_escape = function(s, c)
	return s and s:gsub('\'', '\'\''):gsub('[%%_%[%]'..c..']', c..'%1')
end

request_info.get_virtual_path = function()
	local script_name = fb_env.script_path:match('.*\\(.*)$')
	local path_begin, path_end = request_info.uri:find('/'..script_name..'/')
	if path_end and path_end > 0 then
		return request_info.uri:sub(path_end)
	end
end
