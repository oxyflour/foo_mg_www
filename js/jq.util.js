(function($) {
$.ieach = function(list, func, para) {
	for (var i = 0; i < list.length; i ++) {
		var r = func(i, list[i], para);
		if (r !== undefined) return r;
	}
	return para;
}
$.keach = function(list, func, para) {
	for (var i in list) {
		var r = func(i, list[i], para);
		if (r !== undefined) return r;
	}
	return para;
}
$.query = function(obj, list) {
	if (typeof(list) == typeof(''))
		list = list.split('//');
	$.ieach(list, function(i, v) {
		obj = obj && v && obj[v];
	});
	return obj;
}
$.format = function(str) {
	var reg = /{{([^{}]+)}}/gm, args = arguments;
	return str.replace(reg, function(match, name) {
		return $.query(args, name) || '';
	});
}
$.formatcat = function(list, str, sep) {
	return $.ieach(list, function(i, v, d) {
		d.push($.format(str, i, v));
	}, []).join(sep);
}
$.url_parse = function(url) {
	var f = url.search('\\?'),
		p = f >= 0 ? url.substr(0, f) : url,
		a = f >= 0 ? url.substr(f+1) : '';
	return {
		path: p,
		dict: $.ieach(a ? a.split('&') : [], function(i, s, d) {
			var j = s.search('='),
				k = s.substr(0, j),
				v = s.substr(j+1);
			if (k && v) d[k] = decodeURIComponent(v);
		}, {})
	};
}
$.url_concat = function(dict) {
	return $.keach(dict, function(k, v, d) {
		if (k !== undefined && v !== undefined)
			d.push(k+'='+encodeURIComponent(v));
	}, []).join('&');
}

/*
$.fn.editlist = function(s) {
	s = $.extend({
		elem: 'li',
		dragger: '<div><div style="position:absolute;width:100%;height:3px;margin-top:-1;background-color:#888;z-index:99;"></div></div>',
		cls: 'dragging',
		onDragBegin: null,
		onMoveBegin: null,
		onDropDown: null
	}, s);
	var ul = this, li = null, dr = null;
	function drag_begin(e) {
		if (s.onDragBegin && s.onDragBegin.apply(ul, [li, e])) return;
		$(document).bind('mousemove', drag_move).bind('mouseup', drag_end);
	}
	function drag_move(e) {
		if (!dr || !dr.parent().length) {
			li.addClass(s.cls);
			dr = $(s.dragger).insertBefore(li);
			if (s.onMoveBegin) s.onMoveBegin.apply(ul, [li, dr]);
			return;
		}
		var p = dr.prev(), n = dr.next(),
			u = p.offset(), d = n.offset(), h = n.height();
		if (u && e.pageY < u.top) dr.remove().insertBefore(p);
		else if (d && e.pageY > d.top + h) dr.remove().insertAfter(n);
	}
	function drag_end(e) {
		if (s.onDropDown) s.onDropDown.apply(ul, [li, dr]);
		li.removeClass(s.cls);
		dr.remove();
		$(document).unbind('mousemove', drag_move).unbind('mouseup', drag_end);
	}
	function ms_down(e) {
		var t = $(e.target);
		li = t.is(s.elem) ? t : t.parents(s.elem).first();
		if (!li.length) return;
		drag_begin(e);
	}
	this.unbind('mousedown', ms_down).mousedown(ms_down);
	return this;
}
*/
})(jQuery)
