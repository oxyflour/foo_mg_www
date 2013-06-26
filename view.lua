local inf = ...
local playid = tonumber(get_var("play") or "")
local lastid = nil
local first = nil
local pnext = nil
print("HTTP/1.0 200 OK\r\n",
	"Content-Type: text/html;charset=utf-8\r\n",
	"\r\n")
print("<html><head><title>", inf.name, "</title><style>",
		"@-ms-viewport{width:device-width}",
		"body{color:#333;font-family:'WenQuanYi Micro Hei Mono', 'WenQuanYi Micro Hei', ",
			"'Microsoft Yahei Mono', 'Microsoft Yahei', sans-serif;}",
		"a{text-decoration:none;color:#333;}",
		"a:hover{text-decoration:underline;color:#22a;}",
		"ul{list-style:none;margin:0;}",
		"ul p{margin-left:-10px;color:#aaa;}",
		"ul p a{font-size:125%;font-weight:bold;color:#aaa;}",
		"li{padding:6px 0;}",
		"li.playing{font-weight:bold;}",
		"li .num{float:left;font-size:125%;margin-top:-1px;padding-right:8px;color:#aaa;}",
		"li .inf{margin-top:3px;font-size:80%;color:#888;}",
		"li.playing .num{color:#777;}",
	"</style></head><body>")

print("<form style='float:right' action='search.lua' method='GET'>",
		"<input name='word' value='", inf.word, "' /><input type='submit' value='Search' /></form>",
	"<h3>", inf.url and "<a href='"..inf.url.."'>"..
		"&lt;&lt; "..inf.name.."</a>" or inf.name, "</h3>",
	"<hr />")

print("<ul style='float:left;width:450px;padding:0 20px;'>")
for i, obj in ipairs(inf.ls) do
	if (obj.typ == "folder") then
		obj.bras = {}
		function add_braket(w) table.insert(obj.bras, w); return '' end
		obj.name = obj.name:gsub('%[[^%]]*%]', add_braket):gsub('%([^%)]*%)', add_braket):gsub('_', ' ');
		if obj.name == '' then obj.name = "no title" end
		print("<li>",
--			"<div style='position:absolute;margin-left:145px;margin-top:20px'>",
				"<a href='", obj.url, "'>", obj.name , "</a>",
				"<div class='inf'>", table.concat(obj.bras, ' '), "</div>",
--			"</div>",
--			"<img width=128 src='resource.lua?pid=", math.floor(obj.id), "' />",
		"</li>")
	elseif (obj.typ == "track") then
		first = first or obj.url
		if lastid and lastid == playid then pnext = obj.url end
		lastid = obj.id
		if current_album ~= obj.album then
			print("<p><a href='browse.lua?id=", obj.pid, "'>", obj.album,
				"</a> (", obj.album_artist, ")</p>")
			current_album = obj.album
		end
		print("<li", playid == obj.id and " class='playing'", ">", obj.num and "<span class='num'>", obj.num, "</span>",
			"<a href='", obj.url, "'>", obj.name, "</a>  [", obj.length, "]",
			"<div class='inf'>&lt;", obj.artist, "&gt; ", obj.extra, "</div></li>")
	elseif obj.name then
		print("<li>", obj.name, "</li>")
	end
end
print("</ul>")

print("<div style='float:left;width:0;margin-top:30px;'>")
if playid then
	print("<img width='320px' src='resource.lua?id=", playid, "'></img>",
		"<br /><br />",
		"<audio style='width:320px' autoplay controls src='track.lua?id=", playid, "' onended='goto_next()'>",
			"your browser too old?</audio>")
elseif inf.res then
	local cover = table.each(inf.res, function(i, v) return v:lower():find("cover%.jpg$") and v end)
	if cover then
		print("<img width='320px' src='resource.lua?pid=", inf.id, "&res=", cover:url_encode(), "'></img>")
	end
end
if inf.res then
	print("<div style='width:320px;margin-top:10px'>")
	for i, v in ipairs(inf.res) do
		print("[<a href='resource.lua?pid=", inf.id, "&res=", v:url_encode(), "' target='_blank'>", v, "</a>] ")
	end
	print("</div>")
end
print("</div>")

if (pnext or first) and not get_var("noloop") then
	print("<script>function goto_next() {",
			"location.href='", pnext or first, "';",
		"}</script>")
end
print("</body></html>")
