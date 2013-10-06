var $conf = {
	host: '',
	get_full_url: function(url) {
		return $conf.host+url;
	},
	get_full_list_url: function(data) {
		return $conf.host+data.url+'&begin='+data.begin+'&count='+data.count+
			(data.sort ? '&sort='+data.sort : '');
	}
}
var $ul = new (function($) {
	var $t = this;
	this.ieach = function(list, func, para) {
		for (var i = 0; i < list.length; i ++) {
			var r = func(i, list[i], list, para);
			if (r !== undefined) return r;
		}
		return para;
	}
	this.each = function(list, func, para) {
		for (var i in list) {
			var r = func(i, list[i], list, para);
			if (r !== undefined) return r;
		}
		return para;
	}
	this.find = function(list, tofind) {
		return $t.each(list, function(index, item) {
			return item == tofind ? index : undefined;
		});
	}
	this.concat = function(list, sep) {
		return ($t.each(list, function(index, item, list, para) {
			para.s = (!para.s) ? item : para.s+sep+item;
		}, {})).s;
	}
	this.get = function(obj, list) {
		if (typeof(list) == typeof('')) list = list.split('//');
		return $t.each(list, function(index, item, list, para) {
			if (item[0] == ':') {
				var method = $t.get['func'+item] ||
					Function("o", "return "+item.substr(1)+"(o)");
				para.o = ($t.get['func'+item] = method)(para.o);
			}
			else if (para.o)
				para.o = para.o[item];
		}, {o:obj}).o;
	}
	this.format = function(str, obj) {
		var reg = /{{([^{}]+)}}/gm;
		return str.replace(reg, function(match, name) {
			return $t.get(obj, name);
		});
	}
	this.formatelem = function(str) {
		return $($t.format(str, arguments));
	}
	this.formatcat = function(list, str, sep) {
		return ($t.each(list, function(index, item, list, para) {
			var s = $t.format(str, [index, item]);
			if (s) para.s = (!para.s) ? s : para.s+sep+s;
		}, {})).s;
	}
	this.storage = function(key, value) {
		if (typeof(key) == typeof('')) {
			if (value === null)
				localStorage.removeItem(key);
			else if (value !== undefined)
				localStorage.setItem(key, value);
			else
				return localStorage.getItem(key);
		}
		else if (key.apply) {
			for (var i = 0; i < localStorage.length; i ++) {
				var k = localStorage.key(i);
				key(k, localStorage.getItem(k));
			}
		}
	}
})(jQuery);

var item_formatter = {
	def: function(d) {
		return $('<li>'+d.name+'</li>');
	},
	folder: function(d) {
		var v = string_utility.get_brakets(d.name),
			u = $conf.get_full_url('resource.lua?pid='+parseInt(d.id)+'&w=64'),
			b1 = $ul.formatcat(v[2], '[{{1}}]', ' ') || '',
			b2 = $ul.concat(v[1], ' ') || '';
		return $ul.formatelem('<li bw-id="{{1//id}}" class="folder">'+
				'<div class="albumart" style="background-image:url({{5}})" />'+
				'{{2//0}}<span class="inc">&gt;</span>'+
				'<div class="info">{{3}}&nbsp;{{4}}</div>'+
			'</li>', d, v, b1, b2, u)
			.data("d", d).click(item_callbacks.folder);
	},
	track: function(d) {
		var li = $ul.formatelem('<li pl-id="{{1//id}}" class="track"><span class="num">{{1//num}}</span>{{1//name}}'+
				'<span class="duration">{{1//length}}</span>'+
				'<div class="info">&lt;{{1//artist}}&gt;</div>'+
			'</li>', d).data("d", d)
			.click(item_callbacks.track);
		li.find(".duration").click(item_callbacks.duration);
		return li;
	},
	sep: function(d) {
		if (!d.album)
			return $();
		else return $ul.formatelem('<div class="sep" onmousedown="event.stopPropagation()" style="background-image:url({{2}}&nofallback=1)">'+
				'<a class="link" href="{{2}}" target="_blank">&raquo;</a>'+
				'<div class="bg"><span class="stress">{{1//album}}</span> ({{1//album_artist}})</div>'+
			'</div>', d, $conf.get_full_url('resource.lua?id='+d.id)).data("d", d)
			.click(item_callbacks.sep);
	},
	res: function(d) {
		var ext = d.res.substr(-4).toLowerCase(),
			url = $conf.get_full_url('resource.lua?path='+encodeURIComponent(d.path)+'&res='+encodeURIComponent(d.res));
		if (ext == ".jpg" || ext == ".bmp" || ext == ".png") {
			return $ul.formatelem('<li><a target="_blank" href="{{2}}">'+
					'[{{3}}]</a></li>', d, url, d.res.split('\\').pop())
				.click(item_callbacks.res_img);
		}
		else if (ext == ".txt") {
			return $ul.formatelem('<li>[{{1//res}}]</li>', d).data("d", d)
				.click(item_callbacks.res_text);
		}
		else {
			return $ul.formatelem('<li>[{{1//res}}]</li>', d).data("d", d);
		}
	},
	playlist: function(d) {
		return $ul.formatelem('<li><a href="#list/{{1//url}}">{{1//name}}</a></li>', d).data('d', d)
			.click(item_callbacks.playlist);
	}
}

var $bw = new (function($) {
	var $t = this;
	var cls = 'bw-class';
	var group_by = '{{pid}}-{{album}}';
	var max_elems = 2;
	// should be set
	this.elem = null;
	this.is_loading = false;
	function reset_elem(elem) {
		var list = elem.find('ul')
			.html('<div class="bw-loader">...</div>');
		return elem.data('data', null).data("list", list)
			.data('loader', list.find('div.bw-loader'));
	}
	function get_elem(url) {
		var elem = null, time = 0, oldest = null;
		$('.'+cls).each(function(i, e) {
			var q = $(e), t = q.attr('bw-timestamp');
			if (q.attr('bw-url') == url) {
				elem = q;
				return;
			}
			if (!time || t < time) {
				time = t;
				oldest = q;
			}
		});
		if (!elem) {
			if ($('.'+cls).length >= max_elems && oldest)
				oldest.remove();
			elem = $t.elem.clone().addClass('hidden')
				.insertAfter($t.elem).attr('bw-url', url);
			reset_elem(elem);
		}
		return elem.addClass(cls).attr('bw-timestamp', (new Date()).getTime());
	}
	function get_data(url, func) {
		if ($t.is_loading) return;
		$t.is_loading = true;
		$(document).trigger('bw.loadbegin', url);
		$.getJSON(url, function(data) {
			func(data);
		}).error(function() {
			$(document).trigger('bw.loaderror', url);
		}).complete(function() {
			$t.is_loading = false;
		});
	}
	function load_data(elem, data) {
		var list = elem.data("list"), loader = elem.data('loader'),
			info = elem.data('data'), count = 0;
		if (info && info.ls.length != data.begin) return;
		$(document).trigger('bw.loading', data);
		$ul.each(data.ls, function(i, v, ls, pa) {
			if (!v) return;
			var g = $ul.format(group_by, v), c = elem.data('bw-groupcount') || 0;
			if (g && g != elem.attr('bw-group')) {
				(item_formatter['sep'](v)).insertBefore(loader);
				elem.attr('bw-group', g).data('bw-groupcount', c + 1);
				c >= 3 ? elem.addClass('small-sep') : elem.removeClass('small-sep');
			}
			(item_formatter[v.typ] || item_formatter['def'])(v)
				.insertBefore(loader);
			if(info) info.ls[info.ls.length] = v;
			count ++;
		});
		elem.data('data', info || data).unbind('scroll', load_rest);
		if (count == data.count) {
			elem.bind('scroll', load_rest);
		}
		else {
			$(document).trigger('bw.loaddone', data);
			loader.remove();
			elem.removeAttr('bw-group').data('loader', null);
		}
		switch_elem(elem);
	}
	function load_rest(e) {
		var elem = $(this);
		var list = elem.data("list"), loader = elem.data('loader'),
			info = elem.data('data');
		if (loader && loader.position().top < elem.position().top + elem.height()) {
			var d = {
				url: info.url,
				name: info.name,
				begin: info.ls.length,
				count: info.count,
				sort: info.sort
			}
			get_data($conf.get_full_list_url(d), function(data) {
				load_data(elem, $.extend(data, d));
			});
		}
	}
	function switch_elem(elem) {
		if ($t.elem[0] != elem[0]) {
			$(document).trigger('bw.browse', [elem]);
			$t.elem.data('bw-scrolltop', $t.elem.scrollTop()).addClass('hidden');
			$t.elem = elem.removeClass('hidden').scrollTop(elem.data('bw-scrolltop') || 0);
		}
	}
	this.open = function(d) {
		if (!d.url && $t.data('data'))
			d.url = $t.data('data').url;
		if (typeof(d) == typeof({}) && d.url) {
			d.begin = d.begin || 0;
			d.count = d.count || 30;
			if (!d.sort && $ul.storage('conf.sort.'+d.url))
				d.sort = $ul.storage('conf.sort.'+d.url);
			var elem = get_elem(d.url), info = elem.data('data');
			if (d.reload) {
				reset_elem(elem);
				info = null;
				delete d.reload;
			}
			if (!info || info.ls.length == d.begin)
				get_data($conf.get_full_list_url(d), function(data) {
					load_data(elem, $.extend(data, d));
				});
			else
				switch_elem(elem);
		}
	}
	this.reset = function(url) {
		reset_elem(get_elem(url));
	}
	this.load = function(url, data) {
		var elem = get_elem(url);
//		reset_elem(elem);
		load_data(elem, data);
	}
	this.data = function(key) {
		return $t.elem.data(key);
	}
})(jQuery);

var $pl = new (function($) {
	var $t = this;
	this.play = function(d) {
	}
})(jQuery);
