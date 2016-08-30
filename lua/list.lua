dofile(fb_env.script_path:match('(.*\\).*')..'common.lua')

function parse_sort(fields, avail_fields)
	local str = nil
	for field in (fields or ''):gmatch("[^,]+") do
		local key = avail_fields[field]
		if key then
			str = str and str..", "..key or key
		end
	end
	return str and 'ORDER BY '..str or ''
end

function parse_search(fields, word, path, avail_fields)
	local str, esp = nil, '~'
	for field in fields:gmatch("[^,]+") do
		local key = avail_fields[field]
		if key then
			local val = get_var('word_'..field) or word
			for word in val:gmatch("[^|]+") do
				local query = string.format([[%s LIKE '%%%s%%' ESCAPE '%s']],
						key:sql_escape(), word:like_escape(esp), esp)
				str = str and str..' OR '..query or query
			end
		end
	end
	if str and path then
		str = string.format([[(%s) AND relative_path LIKE '%s%%' ESCAPE '%s']],
			str, path:like_escape(esp), esp)
	end
	return str
end

function query_path_items(path, begin, last, sort)
	path = path:gsub('/', '\\')

	local _, slashes = path:gsub('\\', '')
	local folder_sort_fields = {
		folder = "directory_path",
		folder_desc = "directory_path DESC",
		date = "add_date DESC",
		date_desc = "add_date"
	}

	local sql = string.format([[SELECT
		i,
		d,
		b,
		SUBSTR(b, 1, e-r) AS p
	FROM (SELECT *,
			id AS i,
			relative_path AS b,
			directory_path AS d,
			CAST(SUBSTR(path_index, 1, 3) AS INTEGER) AS r,
			MAX(CAST(SUBSTR(path_index, %d, 3) AS INTEGER),
				CAST(SUBSTR(path_index, %d, 3) AS INTEGER))+1 AS e
		FROM %s
		WHERE SUBSTR(relative_path, 1, %d)='%s')
	GROUP BY p %s]],
		slashes * 3 + 1, slashes * 3 + 4, fb_env.db_path_table,
		path:utf8_len(), path:gsub("'", "''"),
		parse_sort(sort, folder_sort_fields))

	local folders, list, total = { }, { }, 0

	local db = sqlite3.open(fb_env.db_file_name)
	for id, dir, pth, sub in db:urows(sql) do
		if sub == path then
			folders[id] = dir
		else
			total = total + 1
			if total > begin and total <= last + 1 then
				list[total] = {
					typ = "folder",
					name = ('\\'..sub):match('([^\\]+)\\$'),
					path = sub,
					latest_path = pth,
				}
			end
		end
	end
	for pid, dir in pairs(folders) do
		local sql = string.format([[SELECT
				id,
				title,
				tracknumber,
				artist,
				album,
				album_artist,
				length,
				length_seconds
			FROM %s WHERE pid=%d ORDER BY album, tracknumber]], fb_env.db_track_table, pid)
		for id, title, num, artist, album, album_artist, length, seconds in db:urows(sql) do
			total = total + 1
			if total > begin and total <= last + 1 then
				list[total] = {
					typ = "track",
					name = title,
					num = num,
					artist = artist,
					album = album,
					album_artist = album_artist,
					length = length,
					seconds = seconds,
					inf = extra and extra.inf and (extra.inf[num] or extra.inf[title]),
					id = id
				}
			end
		end
	end
	db:close()

	return {
		folders = folders,
		list = list,
		total = total,
	}
end

function search_path_items(params, path, begin, last, sort)
	path = path:gsub('/', '\\')
	params.search_fields = params.search_fields or 'folder,title,artist,album'

	local list, total = { }, 0
	local folder_ids, track_ids

	local db = sqlite3.open(fb_env.db_file_name)

	local folder_sort_fields = {
		flist = params.folder_ids and
			string.format("instr(',%s,', ','||id||',')", params.folder_ids:gsub('[^%d,]', '')),
		folder = "directory_path",
		folder_desc = "directory_path DESC",
		date = "add_date DESC",
		date_desc = "add_date"
	}
	local folder_search_fields = {
		folder = 'relative_path'
	}
	local folder_search_cond =
		(params.folder_ids and
			'id IN ('..params.folder_ids:gsub('[^%d,]', '')..')') or
		(params.search_word and parse_search(
			params.search_fields, params.search_word, path, folder_search_fields))
	if folder_search_cond then
		local sql = string.format([[SELECT
				id,
				relative_path
			FROM %s WHERE %s %s]],
			fb_env.db_path_table, folder_search_cond,
			parse_sort(sort, folder_sort_fields))
		for id, dir in db:urows(sql) do
			total = total + 1
			if total > begin and total <= last + 1 then
				list[total] = {
					typ = "folder",
					name = dir,
					path = dir,
					id = id,
					latest_path = dir,
				}
			end
			folder_ids = folder_ids and folder_ids..','..id or id
		end
	end

	local track_sort_fields = {
		tlist = params.track_ids and
			string.format("instr(',%s,', ','||t.id||',')", params.track_ids:gsub('[^%d,]', '')),
		path = 'pid',
		album = 'album',
		num = 'tracknumber'
	}
	local track_search_fields = {
		title = 'title',
		artist = 'artist',
		album = 'album',
	}
	local track_search_cond =
		(params.track_ids and
			't.id in ('..params.track_ids:gsub('[^%d,]', '')..')') or
		(params.search_word and parse_search(
			params.search_fields, params.search_word, path, track_search_fields))
	if track_search_cond then
		local sql = string.format([[SELECT
				t.id,
				pid,
				title,
				tracknumber,
				artist,
				album,
				album_artist,
				length,
				length_seconds,
				relative_path
			FROM %s as t LEFT JOIN %s as p ON p.id=t.pid WHERE %s %s]],
			fb_env.db_track_table, fb_env.db_path_table, track_search_cond,
			parse_sort(sort or 'path,album,num', track_sort_fields))
		for id, pid, title, num, artist, album,
			album_artist, length, seconds, path in db:urows(sql) do
			total = total + 1
			if total > begin and total <= last + 1 then
				list[total] = {
					typ = "track",
					name = title,
					num = num,
					artist = artist,
					album = album,
					album_artist = album_artist,
					length = length,
					seconds = seconds,
					path = path,
					id = id
				}
			end
			track_ids = track_ids and track_ids..','..id or id
		end
	end

	db:close()

	return {
		list = list,
		total = total,
		folder_ids = folder_ids,
		track_ids = track_ids,
	}
end

function scan_resource(root, path, output)
	local list = fb_util.list_dir(root..path.."*")
	if list then
		for _, pair in pairs(list) do
			local file, attr = pair[1], pair[2]
			if bit32.band(attr, 32) ~= 0 and		-- is a file
					bit32.band(attr, 2) == 0 then	-- not hidden
				local ext = file:match('%.([^%.]+)$')
				if ext and config.allowed_resource[ext:lower()] then
					table.insert(output, path..file)
				end
			end
			if bit32.band(attr, 16) ~= 0 and		-- is a folder
					bit32.band(attr, 2) == 0 and	-- not hidden
					config.scan_sub_directory[file:lower()] then
				scan_resource(root, path..file..'\\', output)
			end
		end
	end
end

local virtual_path = request_info.get_virtual_path()
local path_mat, file_mat = virtual_path:match('/(.*/)([^/]+)$')
local path = path_mat or ''
local file = file_mat or virtual_path:sub(2)
local sort, begin_index, last_index, ext_type = file:match('(.*)-(%d+)-(%d+)%.(%w+)')
local begin = tonumber(begin_index or '0')
local last = tonumber(last_index or '1e9')

local items
if get_var('word') or get_var('flist') or get_var('tlist') then
	items = search_path_items({
		search_word = get_var('word'),
		search_fields = get_var('fields'),
		folder_ids = get_var('flist'),
		track_ids = get_var('tlist'),
	}, path, begin, last, sort)
else
	items = query_path_items(path, begin, last, sort)
	local res = { }
	for pid, dir in pairs(items.folders) do
		scan_resource(dir, '', res)
	end
	items.res = res
end

local result = {
	ls = items.list,
	path = path:gsub('/', '\\'),
	name = path:match('([^/]+)/$') or 'root',
	begin = begin,
	total = items.total,

	flist = items.folder_ids,
	tlist = items.track_ids,

	res = items.res,
}

if ext_type:lower() == 'json' then
	cjson.encode_sparse_array(true, 0)
	print("HTTP/1.0 200 OK\r\n",
		"Content-Type: application/json\r\n",
		"Access-Control-Allow-Origin: *\r\n",
		"\r\n",
		cjson.encode(result))
elseif ext_type:lower() == 'zip' then
	local entries = { }
	local hasEntry = false
	for i, item in ipairs(items.list) do
		local name = string.format([[%s. %s - %s.*]],
			item.num, item.artist, item.name)
		if item.typ == 'track' then
			entries[name] = string.format([[/lua/track.lua/%s]], item.id)
			hasEntry = true
		end
	end
	if hasEntry then
		fb_stream.zip_urls(file, entries)
	end
else
	print('HTTP/1.0 403 OK\r\n\r\n')
end
