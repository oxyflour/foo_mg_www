$.fn.shiftUp = function() {
	var all = this;
	return this.each(function(i, e) {
		$(e).prev().not(all).before(e);
	});
}
$.fn.shiftDown = function() {
	var all = this;
	return $(this.get().reverse()).each(function(i, e) {
		$(e).next().not(all).after(e);
	});
}
$.fn.wait = function(when, done) {
	var e = this, t = 0, k = "jq.wait.timeout";
	function wait() {
		var r = when.apply ? when.apply(e, [t]) : (t ? 0 : when);
		if (!(r > 0) || (t+=r) > 10000)
			done && done.apply(e.data(k, 0), [t]);
		else
			e.data(k, setTimeout(wait, r));
	}
	if (e.data(k))
		clearTimeout(e.data(k));
	wait();
	return this;
}
$.fn.clearClass = function(cls) {
	return this.each(function(i, e) {
		var t = $(e), d = t.data("class-group");
		if (!d && t.attr("class-group")) {
			d = t.data("class-group", t.attr("class-group").split(",")).data("class-group");
		}
		for (var i = 0; d && i < d.length; i ++) {
			if ((' '+d[i]+' ').indexOf(' '+cls+' ') >= 0)
				t.removeClass(d[i]);
		}
	});
}
$.fn.selfOrParent = function(s, f) {
	var e = this.filter(f);
	return e.length ? e : this.parentsUntil(s, f);
}
$.fn.fixScale = function() {
	var scale = window.innerWidth / document.documentElement.clientWidth;
	return this.css("-webkit-transform", "scale("+scale+")")
		.css("-ms-transform", "scale("+scale+")")
		.css("transform", "scale("+scale+")");
}
$.fn.dock = function (x, y) {
	var pW = document.documentElement.clientWidth, pH = document.documentElement.clientHeight, 
		rW = window.innerWidth, rH = window.innerHeight, s = rW / pW;
	return this.each(function(i, e) {
		/* it's useless when zooming
		var cssX = {}, cssY = {};
		if (x == 'left') cssX = {left:0, right:''};
		else if (x == 'right') cssX = {left:'', right:0};
		else cssX = {left:(rX - oX) + "px", right:''};
		if (y == 'top') cssY = {top:0, bottom:''};
		else if (y == 'bottom') cssY = {top:'', bottom:0};
		else cssY = {top:(rY - oY) + "px", bottom:''};
		return this.css($.extend(cssX, cssY));
		*/
		var o = $(e);
		var oX = (1 - s) / 2 * o.outerWidth(), oY = (1 - s) / 2 * o.outerHeight(),
			rX = (rW - o.outerWidth() * s) / 2, rY = (rH - o.outerHeight() * s) / 2,
			uX = rX, uY = rY,
			aX = x || o.attr("pg-dock-x"), aY = y || o.attr("pg-dock-y");
		if (aX == 'left') uX = 0; else if (aX == 'right') uX = 2*rX;
		if (aY == 'top') uY = 0; else if (aY == 'bottom') uY = 2*rY;
		o.css('left', (uX-oX)+'px').css('top', (uY-oY)+'px');
	});
}
$.fn.modal = function(setting) {
	var $this = this;
	if (!setting)
		setting = {};
	else if (typeof(setting) == typeof(""))
		setting = {mode:setting};
	function close() {
		$this.filter(".pg-modal-show").removeClass("pg-modal-show")
			.parent().filter(".pg-modal").fadeOut(setting['duration'], function() {
				if ($(this).hasClass("pg-modal-temp")) $(this).remove();
				if (setting.close && setting.close.apply)
					setting.close.apply(this);
			});
		if (!$(".pg-modal-show").length) {
			$(".pg-overlay").fadeOut(setting['duration'], function() {
					if (setting && setting.done && setting.done.apply)
						setting.done.apply(this);
				}).unbind("click", on_close)
				.unbind("touchmove", on_disable)
				.unbind("touchend", on_close);
			$(document).unbind("touchmove", on_touch);
		}
	}
	function on_disable(e) { e.preventDefault(); }
	function on_close(e) { close(); }
	function on_touch(e) { if (e.originalEvent.touches.length > 1) close(); }
	if (!$(".pg-overlay").length) {
		$('<style>'+
	'.pg-overlay { position: fixed; left: 0; top: 0; width: 100%; height: 100%; z-index: 199; background-color: #000; opacity: 0.5; }'+
	'.pg-modal { position: fixed; left: -9999px; top: -9999px; z-index: 200; overflow-x: hidden; overflow-y: auto; }'+
		'</style>').appendTo('head');
		$('<div class="pg-overlay"></div>').appendTo("body");
	}
	this.each(function(i, e) {
		var o = $(e), p = o.parent(), s = $.extend({}, setting),
			m = p.hasClass("pg-modal") ? p :
				$('<span class="pg-modal"></span>').append(o.remove()).appendTo("body");
		if (!p.length) m.addClass("pg-modal-temp");

		var ls = ["width", "height", "z-index", "alignX", "alignY", "no-overlay"];
		for (var i in ls) { var k = ls[i];
			if (o.attr("modal-" + k))
				s[k] = o.attr("modal-" + k)
		}
		if (s.width || !parseInt(m.css("width"))) {
			var w = s.width;
			if (w && w.substr && w.substr(0, 1) == "*")
				w = parseFloat(w.substr(1)) * document.documentElement.clientWidth;
			m.css('width', w || document.documentElement.clientWidth * 0.9);
		}
		if (s.height) m.css('height', s.height || 'auto');
		if (s.alignX) m.attr("pg-dock-x", s.alignX);
		if (s.alignY) m.attr("pg-dock-y", s.alignY);
		if (s['z-index']) m.css('z-index', s['z-index'] || 199);
		if (s['no-overlay']) setting['no-overlay'] = true;
		m.css('max-height', s["max-height"] || document.documentElement.clientHeight * 0.86);
	});
	if (setting.mode == 'open') {
		if (!setting["no-overlay"]) $(".pg-overlay").unbind("click", on_close).click(on_close)
			.unbind("touchmove", on_disable).bind("touchmove", on_disable)
			.unbind("touchend", on_close).bind("touchend", on_close)
//			.width((document.body || document.documentElement)['scrollWidth'])
//			.height((document.body || document.documentElement)['scrollHeight'])
			.fadeIn(setting.duration);
		$(document).unbind("touchmove", on_touch).bind("touchmove", on_touch);
		this.addClass("pg-modal-show");
		this.parent().fixScale().dock().fadeIn(setting.duration);
	}
	else if (setting.mode == 'close')
		close()
}
var string_utility = {
	get_brakets: function(str) {
		var rb = [], sb = [];
		var s = str.replace(/\(([^\(\)]+)\)/g, function(m, v) {
			rb.push(v); return ' ';
		}).replace(/\[([^\[\]]+)\]/g, function(m, v) {
			sb.push(v); return ' ';
		}).replace(/_/g, " ")
		.replace(/\s+/g, " ")
		.replace(/^\s/g, "")
		.replace(/\s$/g, "") || "No Title";
		return [s, rb, sb]
	},
	secToMmss: function(sec) {
		var m = Math.floor(sec / 60), s = Math.floor(sec) - m*60;
		return m + ':' + (s > 9 ? s : '0'+s);
	}
}

var item_callbacks = {
	folder: function(e) {
		var d = $(this).data('d');
		if (d) browse(d.path);
	},
	track: function(e) {
		if ($(this).hasClass("play") && !$(this).hasClass("selected"))
			pl_audio[0].paused ? pl_audio[0].play() : pl_audio[0].pause();
		else {
			play($(this).addClass("play").data("d"));
			playlist_manager.save('Default', $bw.elem.find('li.track:visible'), function(data) {
				navigate("list", data.url);
			});
		}
	},
	sep: function(e) {
		if ($(e.target).is('a')) {
			if (localStorage.getItem('conf.open_img_self') == "yes") {
				e.preventDefault();
				navigate('img', $(this).children('a').attr('href'));
			}
		}
		else {
			var d = $(this).data('d');
			if (d.path) {
				browse(d.path);
			}
			else {
				e.stopPropagation();
				$("body").clearClass("show-extra").addClass("show-head show-extra");
			}
		}
	},
	duration: function(e) {
		$(this).parents("li.track").toggleClass("selected");
		$bw.elem.find("li.selected").length > 0 ?
			$("body").addClass("show-foot show-select") :
			$("body").removeClass("show-foot show-select");
		e.stopPropagation();
	},
	res_img: function(e) {
		if ($(e.target).is('a'))
			$(e.target).addClass('visited').parent().siblings().find('a').removeClass('visited');
		if (localStorage.getItem('conf.open_img_self') == "yes") {
			e.preventDefault();
			navigate('img', $(this).children('a').attr('href'));
		}
	},
	res_text: function(e) {
		var d = $(this).data("d"),
			u = $conf.get_full_url('resource.lua?path='+encodeURIComponent(d.path)+'&res='+encodeURIComponent(d.res)),
			c = $bw.info.find('.content').text('loading...'),
			t = $bw.info.find('.name').text(d.res);
		$("body").clearClass("show-info").addClass("show-head show-info");
		$.ajax(u, {
		}).success(function(t) {
			c.text(t);
		}).error(function() {
			c.text("load failed");
		});
	},
	playlist: function(e) {
		function done(data) {
			$('body').removeClass('show-head');
			navigate('list', data.url);
		}
		var a = $('#playlist_action').val();
		if (a) {
			e.preventDefault();
			var ls = $bw.elem.find(a[1] == 'a' ? 'li.track:visible' : 'li.track.selected:visible'),
				save = a[0] == '=';
			var d = $(this).data('d');
			if (d.isempty || save) {
				playlist_manager.save(d.name, ls, done);
				d.isempty = false;
			}
			else
				playlist_manager.add(d.name, ls, done);
		}
	}
}

var audio_callbacks = {
	play: function(e) {
		var a = pl_audio[0], d = pl_audio.data("d");
		pl_albumart.attr("src", "resource.lua?id="+d.id+"&res=albumart");
		$("li[pl-id="+d.id+']').siblings().removeClass("play")
			.find('.duration .timer').remove();
		pl_info.find(".title").text(d.artist+' - '+d.name);
		pl_info.find(".info").text(d.album+' ['+d.num+']');
		if (a.timeout > 0) clearTimeout(a.timeout);
		a.timeout = setTimeout(audio_callbacks.playing, 100);
		pl_button.text('| |').attr('title', 'pause');
		document.title = d.name + ' <' + d.artist + '>';
	},
	pause: function(e) {
		var a = pl_audio[0], d = pl_audio.data("d");
		$("li[pl-id="+d.id+']').removeClass("playing").addClass("play paused")
			.find('.duration .timer').text('paused/');
		pl_info.find(".time").text("[paused]");
		pl_button.text('>|').attr('title', 'play');;
	},
	ended: function(e) {
		var a = pl_audio[0], d = pl_audio.data("d");
		$("li[pl-id="+d.id+']').parent().children().removeClass("paused playing");
		pl_info.find(".time").text("[ended]");
		if (localStorage.getItem('conf.play_loop') && localStorage.getItem('conf.play_next'))
			play('+');
		else if (localStorage.getItem('conf.play_next'))
			play('n');
		else if (localStorage.getItem('conf.play_loop'))
			play(d)
	},
	playing: function() {
		var a = pl_audio[0], d = pl_audio.data("d");
		pl_process.each(function(i, e) {
			$(e).css("border-left-width", (a.currentTime / d.seconds * $(e).parent().width()) + "px");
		});
		if (!a.ended && !a.paused) {
			a.timeout = setTimeout(audio_callbacks.playing,
				(Math.floor(a.currentTime) + 1.05 - a.currentTime) * 1000);
			var t = $("li[pl-id="+d.id+']:visible').removeClass("paused").addClass("play playing")
				.find(".duration");
			$("body>.side:visible").length ?
				t.find(".timer").remove() :
				$(t.find(".timer")[0] || $('<span class="timer"></span>').prependTo(t)[0])
					.text(string_utility.secToMmss(a.currentTime)+'/');
			pl_info.filter(":visible").find(".time")
				.text('['+string_utility.secToMmss(a.currentTime)+'/'+d.length+']');
		}
	}
}

function search(word, fields, path) {
	if (word) navigate("list", "browse.lua?tojson=1&word="+encodeURIComponent(word)+
		(fields ? '&fields='+encodeURIComponent(fields) : '')+
		(path ? '&path='+encodeURIComponent(path) : '')+
		'&name='+encodeURIComponent('Searching: '+word));
}
function browse(path) {
	var c = $bw.data('data') || {path:$bw.last_path};
	if (path == '..')
		path = c.parent ? c.parent.path : $bw.last_path;
	if (!path || path != c.path) {
		$bw.last_path = path;
		navigate('list', 'browse.lua?tojson=1' + (path ? '&path='+encodeURIComponent(path) : ''));
	}
}
function play(d) {
	if (typeof(d) == typeof('')) {
		var x = pl_audio.data("d"), l = pl_audio.data("l"), u = [];
		$ul.ieach(l && l.ls || {}, function(i, v, ls) {
			if (v.typ != "track") return;
			if (v.id == x.id) u.current = u.length;
			u.push(v);
		})
		if (!u.length) return;
		if (d == '+')
			play(u[u.current+1] || u[0]);
		else if (d == '-')
			play(u[u.current-1] || u[u.length - 1]);
		else if (d == 'n' && u[u.current+1])
			play(u[u.current+1])
	}
	else {
		pl_audio.data("d", d);
		var support = localStorage.getItem('conf.transcoding');
		pl_audio[0].src = "resource.lua?id="+d.id+
			(support ? "&support="+support : '');
//		pl_audio[0].load();
		pl_audio[0].play();
	}
}
function navigate(action, url) {
	var hash = action+'/'+url;
	function url_parse(u) {
		var f = u.search('\\?'),
			p = f >= 0 ? u.substr(0, f) : null,
			a = f >= 0 ? u.substr(f+1) : null,
			d = {};
		if (a) {
			var st = a.split('&');
			for (var i = 0; i < st.length; i ++) {
				var s = st[i],
					j = s.search('='),
					k = s.substr(0, j),
					v = s.substr(j+1);
				if (k && v) d[k] = v;
			}
		}
		return {
			page: p,
			dict: d
		}
	}
	function url_concat(d) {
		var s = '';
		for (var k in d) {
			if (k !== undefined && d[k] !== undefined) {
				var q = k+'='+d[k]
				s += s ? '&'+q : q;
			}
		}
		return s;
	}
	if (action == 'list' && !window.do_not_use_unicode_url) {
		var para = url_parse(url), direct = '';
		if (para.page == 'browse.lua' && para.dict.tojson) {
			var path = para.dict.path ? decodeURIComponent(para.dict.path).replace(/\\/g, '/') : '';
			para.dict.tojson = para.dict.path = undefined;
			redirect = para.page.replace(/\..*/g, '') + '/' + path + url_concat(para.dict);
		}
		if (redirect) {
			location.hash = redirect;
			return;
		}
	}
	if (location.hash.replace(/^#/, '') != hash)
		location.hash = hash;
}
function wait(show, delay) {
	$("#loading").wait(function(t) {
		return t ? 0 : delay;
	}, function(t) {
		this.show().modal(show ? 'open' : 'close');
	});
}

var playlist_manager = {
	save: function(name, ln, cb) {
		var tlist = '', nlist = '', ls = [], d = $bw.elem.data("data");
		name = name || d.name;
		ln.each(function(i, e) {
			var d = $(e).data("d");
			tlist = tlist ? (tlist+","+d.id) : d.id;
			ls.push(d);
		});
		$ul.ieach(d.ls, function(i, d) {
			if (d.typ != 'track') return;
			nlist = nlist ? (nlist+","+d.id) : d.id;
		});
		if (tlist != nlist) {
			$bw.reset(d.url);
			d = {
				name: name,
				url: "browse.lua?tojson=1&tlist="+tlist+"&name="+encodeURIComponent(name),
				ls: ls
			}
		}
		localStorage.setItem("playlist."+name, d.url);
		if (d.ls.length < d.total) $.getJSON($conf.get_full_url(d.url), function(data) {
			pl_audio.data("l", $.extend({}, d, data));
			if (cb) cb(pl_audio.data("l"));
		});
		else {
			pl_audio.data("l", d);
			if (cb) cb(pl_audio.data("l"));
		}
	},
	add: function(name, ln, cb) {
		var url = localStorage.getItem("playlist."+(name || ''));
		var tlist = '', nlist = '';
		if (url) $.getJSON($conf.get_full_url(url), function(data) {
			for (var i = 0; data.ls && i < data.ls.length; i ++) {
				var d = data.ls[i];
				nlist = nlist ? (nlist+','+d.id) : d.id;
			}
			if (!data.ls.length) data.ls = [];
			ln.each(function(i, e) {
				var d = $(e).data("d");
				tlist = tlist ? (tlist+","+d.id) : d.id;
				data.ls.push(d);
			});
			data.url = "browse.lua?tojson=1&tlist="+
				(nlist && tlist ? nlist+','+tlist : (nlist || tlist))+"&name="+
				encodeURIComponent(data.name);
			localStorage.setItem("playlist."+(name || ''), data.url);
			if (cb) cb(data);
		});
	}
}

var page_loader = {
	list: function(url) {
		$bw.open({url:url});
	},
	browse: function(path) {
		var exec = /(.*\/)(.*)/.exec(path) || [path, '', path];
		$bw.open({url: 'browse.lua?tojson=1' +
			(exec[1] ? '&path='+encodeURIComponent(decodeURI(exec[1]).replace(/\//g, '\\')) : '') + 
			(exec[2] ? '&'+exec[2] : '')});
	},
	img: function(url) {
		wait(true, 300);
		$("body>.img").width(0).height(0).attr("src", url).wait(function(t) {
			return this.prop("complete") && t ? 0 : 100;
		}, function(t) {
			wait(false);
			var i = this[0], w = $(window);
			i.naturalWidth / i.naturalHeight < w.width() / w.height() && w.width() < 720 ?
				this.width("100%").height("auto") : this.width("auto").height("100%");
		});
	}
};

$(document).bind('bw.loadbegin', function(e, d) {
});
$(document).bind('bw.browse', function(e, elem) {
	$("body").removeClass("show-head show-foot");

	var d = elem.data('data');
	$bw.title.text(d.parent ? "< "+d.name : d.name);
	d.res && d.res.length ? $bw.res.empty() : $bw.res.html('No resource under this folder');
	for (var i = 0; d.res && i < d.res.length; i ++) {
		(item_formatter.res({
			res: d.res[i],
			path: d.path,
			id: d.id
		})).appendTo($bw.res);
	}

	if (d.path && (!$bw.path.attr('bw-path') || $bw.path.attr('bw-path').indexOf(d.path) < 0)) {
		$bw.path.attr('bw-path', d.path).empty();
		$('<button bw-path="">root</button><span>&gt;</span>').click(function(e) { browse(); }).appendTo($bw.path);
		var st = d.path.split('\\'), path = "";
		for (var i = 0; i < st.length; i ++) {
			if (!st[i]) continue;
			var s = st[i];
			path += s + '\\';
			$ul.formatelem('<button bw-path="{{1}}" title="{{2}}">{{2}}</button><span>&gt;</span>', path, s).click(function(e) {
				browse($(this).attr('bw-path'));
			}).appendTo($bw.path);
		}
	}
	$bw.path.children().each(function(i, e) {
		var t = $(e);
		t.attr('bw-path') == d.path ?
			t.addClass('active') : t.removeClass('active');
	});

	$bw.sort.val($ul.storage('conf.sort.'+d.url));
});

$(document).ready(function(e) {
	window.pl_albumart = $('#pl_albumart, #pl_albumart2');
	window.pl_process = $('#pl_process, #pl_process2, #pl_process3');
	window.pl_audio = $('#pl_audio');
	window.pl_info = $('#pl_info, #pl_info2, #pl_info3');
	window.pl_list = $('#pl_list');
	window.pl_button = $('#pl_button, #pl_button2');
	pl_audio.bind("play", audio_callbacks.play)
		.bind("pause", audio_callbacks.pause)
		.bind("ended", audio_callbacks.ended);
	pl_process.bind('mouseup mousemove', function(e) {
		var p = $(this).parent();
		var d = pl_audio.data('d');
		if (d) {
			var s = (e.pageX - p.offset().left) / p.width() * d.seconds;
			if (e.type == 'mouseup')
				pl_audio[0].currentTime = s;
			else {
				var i = $(this).parent().find('.timeinc');
				if (!i.length)
					i = $('<span class="timeinc" style="position:absolute"></span>').insertBefore(this).hide();
				i.show().text(string_utility.secToMmss(s));
			}
		}
	}).bind('mouseleave', function(e) {
		$(this).parent().find('.timeinc').hide();
	});

	$bw.elem = $("body>.main");
	$bw.title = $('#bw_title');
	$bw.info = $("#bw_info");
	$bw.res = $("#bw_res");
	$bw.path = $("#bw_path");
	$bw.sort = $("#bw_sort");

	var href = location.href, hash = '#'+decodeURI('%E4%B8%AD%E5%9B%BD');
	history.replaceState(null, null, hash);
	if (location.hash != hash) window.do_not_use_unicode_url = true;
	history.replaceState(null, null, href);

	$(window).trigger("hashchange");
});
$(document).ajaxStart(function() {
	wait(true, 300);
}).ajaxComplete(function() {
	wait(false);
});
$(document).bind("touchstart mousedown", function(e) {
	if ($("body").hasClass("show-head") &&
			$('.head').is(':visible') &&
			$(e.target).parents(".head").length == 0) {
		$("body").removeClass("show-head")
	}
});
$(window).bind("hashchange", function(e) {
	var hash = location.hash.replace(/^#/, '') || "browse/",
		exec = /^([^\/]+)\/(.*)/.exec(hash);
	if (!exec) return;

	$(".pg-modal-pop").modal({mode: 'close', duration: 0});
	if (exec[1] == "img") {
		$("body").clearClass("img-view").addClass("img-view");
		$("meta[name=viewport]").attr("content",
			"width=device-width,minimum-scale=0.1,maximum-scale=10");
	}
	else {
		$("body").clearClass("list-view").addClass("list-view");
		$("meta[name=viewport]").attr("content",
			"width=device-width,minimum-scale=1,maximum-scale=1");
	}
	page_loader[exec[1]] && page_loader[exec[1]](exec[2]);
})
