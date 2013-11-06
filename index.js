function sec2Mmss(sec, n) {
	var m = Math.floor(sec / 60), s = (sec - m*60).toFixed(n);
	return m + ':' + (s >= 10 ? s : '0'+s);
}
function mmss2Sec(mmss) {
	var p = mmss.split(':');
	return parseFloat(p[0])*60 + parseFloat(p[1]);
}
var app = angular.module('app', []);
app.filter('urlEncode', function() {
	return function(str) {
		return encodeURIComponent(str);
	}
})
app.directive('bwMain', function($compile) {
	function open(elem, scope, url, reopen) {
		var lists = elem.children('[bw-list]');
		var find = $.ieach(lists, function(i, v, d) {
			var e = angular.element(v), t = parseInt(e.attr('bw-time'));
			if (e.attr('ng-non-bindable') != undefined)
				d.tpl = e;
			else if (e.attr('bw-list') == url)
				d.current = e;
			else if (!d.oldest || !(t > d.time)) {
				d.oldest = e;
				d.time = t;
			}
		}, {});
		if (lists.length > 4 && find.oldest) {
			find.oldest.scope().$destroy();
			find.oldest.remove();
		}
		if (reopen && find.current) {
			find.current.remove();
			find.current = undefined;
		}
		if (!find.current && find.tpl) {
			find.current = find.tpl.clone()
				.removeAttr('ng-non-bindable')
				.attr('bw-list', url)
				.insertAfter(find.tpl);
			($compile(find.current))(scope.$new());
		}
		if (find.current) {
			find.current.attr('bw-time', (new Date()).getTime());
			scope.list = find.current.scope(); // there should be a better way to share scope
		}
	}
	return function (scope, elem, attrs, ctrl) {
		scope.open = function(url, reopen) {
			if (!url) return;
			open(elem, scope, url, reopen);
		};
	}
})
app.directive('bwList', function($http) {
	function get_brackets(str) {
		var rb = [], sb = [];
		var s = str.replace(/\(([^\(\)]+)\)/g, function(m, v) {
			rb.push(v); return ' ';
		}).replace(/\[([^\[\]]+)\]/g, function(m, v) {
			sb.push(v); return ' ';
		}).replace(/_|\s+/g, " ").replace(/^\s*|\s*$/g, "") || "No Title";
		return [s, rb, sb]
	}
	return {
		scope: true,
		link: function (scope, elem, attrs, ctrl) {
		var load = function() {
			if (scope.ls.length >= scope.total)
				return;
			var url = scope.conf.list_url(scope.url, scope.ls.length, 30);
			$http.get(url).success(function(data) {
				if (scope.ls.length != data.begin)
					return;
				$.keach(data.ls, function(i, v, d) {
					// have to check because lua cjson sends null to fill array
					if (!v) return;
					if ((v.group = $.format('{{1//album}}', v)) &&
							d.currentGroup != v.group) {
						d.currentGroup = v.group;
						d.groupCount = (d.groupCount || 0) + 1;
						v.newGroup = true;
						v.aaUrl = scope.conf.res_url('albumart', v.id, undefined);
						v.aaUrlNfb = scope.conf.res_url('albumart', v.id, undefined, {nofallback:1});
						v.aaCssUrl = 'url('+v.aaUrlNfb.replace(/([\(\)'"])/g, '\\$1')+')';
					}
					if (v.typ == "folder") {
						var b = get_brackets(v.name);
						v.shortName = b[0];
						v.bracR = b[1].join(' ') || '';
						v.bracS = b[2].length ? $.formatcat(b[2], '[{{2}}]', ' ') : '';
						v.aaUrl = scope.conf.res_url('albumart', undefined, v.path, {w:64});
						v.aaCssUrl = 'url('+v.aaUrl.replace(/([\(\)'"])/g, '\\$1')+')';
					}
					d.ls.push(v);
				}, scope)
				$.keach(data, function(k, v, d) {
					if (k != 'ls') d[k] = v;
				}, scope);
				if (data.res && !scope.resList) scope.resList = $.ieach(data.res, function(i, v, d) {
					d.push({
						name: v.split('\\').pop(),
						url: scope.conf.res_url(v, undefined, data.path),
						typ: {jpg:'img',png:'img',bmp:'img'}[v.split('.').pop().toLowerCase()]
					});
				}, []);
			});
		}
		elem.bind('scroll', function(e) {
			var loader = elem.find('.loading');
			if (loader.position().top < elem.position().top + elem.height())
				load();
			elem.attr('bw-scroll', elem.scrollTop());
		});
		scope.$watch(function() {
			return elem.height();
		}, function(v) {
			if (v) elem.scrollTop(parseInt(elem.attr('bw-scroll')));
		});
		scope.url = attrs.bwList;
		scope.ls = [];
		load();
	}}
})
app.directive('plCtrl', function($http) {
	return function (scope, elem, attrs, ctrl) {
		var a = angular.element('[pl-audio]');
		scope.load = function(id) {
			var ad = scope.audio;
			if (id > 0 && ad) {
				ad.id = id;
				ad.aaUrl = scope.conf.res_url('albumart', id);
				ad.aaCssUrl = 'url('+ad.aaUrl.replace(/([\(\)'"])/g, '\\$1')+')';
				a[0].src = scope.conf.track_url(id);
				var url = scope.conf.list_url('?tlist='+id);
				$http.get(url).success(function(data) {
					ad.info = data.ls[0];
					ad.length = data.ls[0].seconds;
				});
				var lrc = scope.conf.res_url('lyric', id);
				$http.get(lrc, {// do not transform lyric file
					transformResponse: function(d) { return d }
				}).success(function(data) {
					ad.lyric = data;
				});
			}
		}
		scope.play = function(id) {
			scope.load(id);
			a[0].play();
		}
		scope.playnext = function(offset, loop) {
			var ls = scope.playlist.split(','), i = $.ieach(ls, function(i, v) {
				return v == scope.audio.id ? i : undefined;
			}, -1) + offset;
			var j = loop ? ((i+ls.length) % ls.length) : i, d = ls[j];
			if (d) scope.play(d);
		}
		scope.pause = function() {
			a[0].pause();
		}
		scope.playpause = function(id) {
			if (id && id != scope.audio.id)
				scope.play(id);
			else
				a[0].paused ? a[0].play() : a[0].pause();
		}
		scope.seek = function(time) {
			a[0].currentTime = time;
		}

		// try to restore play state
		scope.playlist = scope.playlist || '';
		if(scope.audio && scope.audio.id)
			scope.load(scope.audio.id);
	}
})
app.directive('plAudio', function() {
	return function (scope, elem, attrs, ctrl) {
		var audio = scope.audio = (scope.audio || {});
		audio.current = {};
		var timeout = 0;
		var update = function(start) {
			if (start && timeout > 0)
				clearTimeout(timeout);
			var a = elem[0], t = a.currentTime;
			// save to current object to speed up
			audio.current.sec = t;
			audio.current.mmss = sec2Mmss(t);
			if (!a.ended && !a.paused)
				timeout = setTimeout(update, (Math.floor(t) + 1.05 - t) * 1000)
			else
				timeout = 0;
			// do not use $timeout because we only need to update elements
			scope.$apply();
		}
		audio.state = 'ready';
		elem.bind('play', function(e) {
			audio.state = 'play';
			update(true);
			if (attrs.plAudioPlay)
				scope.$eval(plAudioPlay);
		}).bind('pause', function(e) {
			audio.state = 'pause';
			if (attrs.plAudioPause)
				scope.$eval(plAudioPause);
		}).bind('ended', function(e) {
			audio.state = 'ended';
			if (attrs.plAudioEnded)
				scope.$eval(plAudioEnded);
		});
	}
})
app.directive('plAnalyser', function() {
	return function (scope, elem, attrs, ctrl) {
		var audio = $(attrs.plAnalyser);
		var context = source = analyser = freqdata = null;
		if (audio.length && window.webkitAudioContext) {
			// init objes
			context = new webkitAudioContext();
			source = context.createMediaElementSource(audio[0]);
			analyser = context.createAnalyser();
			freqdata = new Uint8Array(analyser.frequencyBinCount);
			// audio -> analyser -> destination
			source.connect(analyser);
			analyser.connect(context.destination);
		}

		var cv = elem,
			dc = cv[0].getContext('2d');
		dc.strokeStyle = attrs.plAnalyserStroke || '#aaa';
		dc.lineWidth = parseInt(attrs.plAnalyserBarWidth) || 2;

		var interval = 0;
		var update = function() {
			if (!analyser || !cv.height()) return;
			analyser.getByteFrequencyData(freqdata);
			var bs = 40, fs = freqdata.length,
				w = cv[0].width, h = cv[0].height;
			dc.clearRect(0, 0, w, h);
			dc.beginPath();
			for (var i = 0; i < bs-1; i ++) {
				var j = Math.floor(fs * i / bs),
					y = freqdata[j] * h / 256,
					x = w * i / bs + dc.lineWidth;
				dc.moveTo(x, h/2-y/2);
				dc.lineTo(x, h/2+y/2);
				dc.stroke();
			}
			dc.closePath();
		}

		audio.bind('play', function(e) {
			if (elem.attr('pl-analyser-disabled')) {
				if (interval > 0)
					clearInterval(interval);
				interval = 0;
			}
			else if (analyser && interval == 0) {
				interval = setInterval(update, attrs.plAnalyserInterval || 100);
			}
		});
	}
})
app.directive('plLyric', function($http) {
	return function (scope, elem, attrs, ctrl) {
		var audio = $(attrs.plLyric), timeout = 0,
			content = [], info = {};
		function parse(txt) {
			content = [];
			info = {};
			var e = null, r = /\[([\d\.:]+)\](.*)/, k = /\[([^:]+):([^\]]+)\]/;
			$.ieach(txt.split('\n'), function(i, v, d) {
				if (e = r.exec(v)) d.push({
					t: mmss2Sec(e[1]),
					c: e[2]
				})
				else if (e = k.exec(v)) {
					info[e[1].toLowerCase()] = e[2];
				}
			}, content)
			if (attrs.plLyricLoad)
				scope.$eval(attrs.plLyricLoad, {elem:elem, content:content, info:info});
		}
		function get(t) {
			if (content[0] && content[0].t > t)
				return -1;
			return $.ieach(content, function(i, v) {
				var n = content[i + 1];
				if (v.t <= t && n && n.t > t)
					return i;
			}, content.length-1);
		}
		function update(start) {
			if (start && timeout > 0)
				clearTimeout(timeout);
			var offset = parseFloat(info.offset || 0) + parseFloat(elem.attr('pl-lyric-offset') || 0);
			var t = audio[0].currentTime + offset, i = get(t);
			if (i >= 0) {
				var a = audio[0], v = content[i], n = content[i + 1];
				if (attrs.plLyricUpdate)
					scope.$eval(attrs.plLyricUpdate, {elem:elem, content:content, info:info, i:i});
				if (n && !a.ended && !a.paused)
					timeout = setTimeout(update, Math.max(1000, (n.t - t)*1000+50));
				else
					timeout = 0;
			}
		}
		if (attrs.plLyricBind) scope.$watch(attrs.plLyricBind, function(t, t0) {
			if (t == t0) return;
			parse(t);
			update(true);
		})
		scope.$watch(function() {
			return elem.is(':visible');
		}, function(v) {
			if (v) update(true);
		});
		audio.bind('play', function(e) {
			update(true);
		})
	}
})
app.directive('localStore', function() {
	return {
		require: 'ngModel',
		link: function (scope, elem, attrs, ctrl) {
		function get_val(k) {
			var m = attrs.ngModel,
				v = localStorage.getItem(k) || '';
			if (m) scope.$eval(m+'="'+v.replace(/"/g, '\\"')+'"');
		}
		function set_val(k, v) {
			v ? localStorage.setItem(k, v) :
				localStorage.removeItem(k);
		}
		scope.$watch(attrs.ngModel, function(v, v0) {
			if (v === v0) return;
			set_val(elem.attr('local-store'), v);
		});
		if (!attrs.localStore) {
			attrs.localStore = attrs.ngModel;
			elem.attr('local-store', attrs.localStore);
		}
		if (attrs.localStoreInit)
			set_val(attrs.localStore, scope.$eval(attrs.localStoreInit))
		else
			get_val(attrs.localStore);
	}}
})
app.directive('showDelay', function() {
	return function (scope, elem, attrs, ctrl) {
		elem.css('opacity', 0);
		// don't use $timeout because we don't have to update
		setTimeout(function() {
			elem.css('opacity', 1);
		}, parseInt(attrs.showDelay) || 400)
	}
})
app.directive('autoSelect', function() {
	return function (scope, elem, attrs, ctrl) {
		elem.mousedown(function(e) {
			if (!elem.is(':focus')) setTimeout(function() {
				elem.select();
			}, parseInt(attrs.autoSelect) || 100)
		});
	}
})

app.controller('main', function($scope, $location, $http, $timeout) {
	function get_full_url(url) {
		return '' + url;
	}
	function get_tracks_from_elems(list) {
		return $.ieach(list || [], function(i, v, d) {
			var i = parseInt($(v).attr('pl-id'));
			if (i > 0) d.push(i);
		}, []);
	}
	function get_tracks_from_data(list) {
		return $.ieach(list || [], function(i, v, d) {
			if (v.typ == 'track') d.push(v.id);
		}, []);
	}

	$scope.conf = {
		list_url: function(url, begin, count) {
			var p = $.url_parse(url);
			p.dict.path = p.path.replace(/\//g, '\\');
			p.dict.tojson = 1;
			p.dict.begin = parseInt(p.begin || '0') + (begin || 0);
			p.dict.count = count;
			p.dict.sort = $scope.setting.list_sort[url] || p.dict.sort;
			return get_full_url('browse.lua?' + $.url_concat(p.dict));
		},
		res_url: function(res, id, path, dict) {
			dict = dict || {};
			dict.res = res;
			dict.id = id;
			dict.path = path;
			return get_full_url('resource.lua?' + $.url_concat(dict));
		},
		track_url: function(id) {
			var dict = { id: id, support: $scope.setting.music_format_support || undefined};
			return get_full_url('resource.lua?' + $.url_concat(dict));
		},
		local_store_dict: function(prefix) {
			var ls = {};
			for (var i = 0; i < localStorage.length; i ++) {
				var k = localStorage.key(i);
				if (k.search(prefix) == 0) {
					var u = k.substr(prefix.length);
					ls[u] = localStorage.getItem(k);
				}
			}
			return ls;
		}
	}

	// the bw-list elem may not load all items from listUrl at once, i.e. $scope.list.ls might be not complete
	// this function will make sure the callback can fetch every items under listurl all
	function get_full_list(f) {
		var list = $scope.list, url = $scope.listUrl;
		if (list.total == list.ls.length)
			f(list.ls);
		else {
			url = $scope.conf.list_url(url);
			$http.get(url).success(function(data) {
				f(data.ls);
			});
		}
	}
	// the first parameter passed to the callback is a complete list of user selection,
	// while the second one may not contain every one under listUrl.
	// the second list should only be used for comparing with the first one
	function get_selected_list(f) {
		var bwList = $('.list:not(.ng-hide)'), children = bwList.children('.track'),
			elems = $scope.list.onEdit ? children.filter('.selected') : children,
			rest = children.not(elems);
		var elemList = get_tracks_from_elems(elems);
		// every item is selected means that user probably wants all
		if (!rest.length) get_full_list(function(list) {
			var dataList = get_tracks_from_data(list);
			$.ieach(dataList, function(i, v) {
				if (i >= elemList.length) elemList[i] = v;
			});
			f(elemList, dataList);
		})
		// or we only have to deal with the loaded ones
		else {
			var dataList = get_tracks_from_data($scope.list.ls);
			f(elemList, dataList);
		}
	}
	function save_list(u, n) {
		$scope.playlists[u] = n;
		setTimeout(function() {
			$.ieach($('li.playlist input'), function(i, e) {
				if ($(e).attr('pl-url') == u)
					return $(e).focus().select();
			})
		}, 100);
	}

	$scope.browser = {
		open: function(url) {
			$scope.listUrl = url;
		},
		browse: function(path) {
			$scope.listUrl = (path || '/').replace(/\\/g, '/');
		},
		search: function() {
			var s = $scope.search;
			var fields = $.keach(s.fields, function(k, v, d) {
				if (k && v) d.push(k);
			}, []).join(',');
			var path = (s.onpath && $scope.list.path) ? $scope.list.path.replace(/\\/g, '/') : '/';
			$scope.listUrl = path + '?' + $.url_concat({
				fields: fields,
				word: s.word
			});
		},
		reload: function() {
			if (!$scope.listUrl) return;
			$scope.open($scope.listUrl, true);
		},
		// save (all items or current selection) as playlist
		save: function() {
			get_selected_list(function(selected, total) {
				var url = selected.join(',') == total.join(',') ?
					$scope.listUrl : '?tlist='+selected.join(',')+'&sort=tlist,flist';
				var name = $scope.playlists[url] || $scope.playlists[$scope.listUrl] || $scope.list.name || 'new';
				save_list(url, name);
			});
			$scope.select.finish();
		},
		// add (all items or current selection) to another playlist (addToUrl).
		// addToUrl will be removed,
		// and a new one is create with the same name
		addTo: function() {
			var u = $scope.addToUrl;
			if (u) get_selected_list(function(selected) {
				var url = $scope.conf.list_url(u);
				$http.get(url).success(function(data) {
					var dataList = get_tracks_from_data(data.ls);
					selected = dataList.concat(selected);
					if (selected.length) {
						var newName = $scope.playlists[u] || data.name || 'new',
							newUrl = '?'+$.url_concat({
								tlist: selected.join(','),
								sort: 'tlist,flist'
							});
						$scope.playlists[u] = '';
						save_list(newUrl, newName);
					}
				});
			});
			// reset select value
			$scope.addToUrl = '';
			$scope.select.finish();
		},
		// play (every items) under current listUrl
		playCurrent: function(id) {
			$scope.playpause(id);
			$scope.playUrl = $scope.listUrl;
			get_full_list(function(list) {
				var dataList = get_tracks_from_data(list);
				$scope.playlist = dataList.join(',');
			});
		}
	}

	$scope.player = {
		show: false,
		getHoverPosition: function(e) {
			var t = $(e.currentTarget), p = t.offset(), w = t.width(), x = e.pageX;
			$scope.player.hoverSec = $scope.audio ? $scope.audio.length * (x - p.left) / w : 0;
			$scope.player.hoverMmss = $scope.audio ? sec2Mmss($scope.player.hoverSec) : '';
		},
		onLyricLoad: function(e, i) {
			/*
			e.attr('style', i.bkstyle || '');
			var bkUrl = i.bkimg && $scope.conf.res_url(i.bkimg, $scope.audio.id),
				bkCssUrl = bkUrl ? 'url('+bkUrl.replace(/([\(\)'"])/g, '\\$1')+')' : 'none';
			e.css('background-image', bkCssUrl);
			// we have to reset offset for animation
			i.offset = (i.offset ? parseFloat(i.offset) : 0) + 0.5;
			*/
		},
		onLyricUpdate: function(e, i, v) {
			function disp(e, i, p) {
				if (!e.is(":visible")) return;
				var img = e.find('img');
				var alignx = p.alignx || i.bkalignx, aligny = p.aligny || i.bkaligny,
					width = p.width || i.bklinewidth, height = p.height || i.bklineheight;
				i.bkcw = e.width() || i.bkcw;
				i.bkch = e.height() || i.bkch;

				var baseX = 0, baseY = 0;
				if (alignx == 'center') baseX = i.bkcw / 2;
				else if (alignx == 'right') baseX = i.bkcw;
				if (aligny == 'center') baseY = i.bkch / 2;
				else if (aligny == 'bottom') baseY = i.bkch;

				var zoomX = i.bkcw / width, zoomY = i.bkch / height;
				i.bkzoom = Math.min(zoomX, zoomY, 1);

				var trans = 'scale('+i.bkzoom+') translate3d('+
					Math.floor(baseX/i.bkzoom-parseFloat(p['left']))+'px, '+
					Math.floor(baseY/i.bkzoom-parseFloat(p['top']))+'px, 0'
				img.css({
					'-webkit-transform': trans,
					'-moz-transform': trans,
					'-ms-transform': trans,
					'transform': trans,
				});
			}
			if (v.c.substr(0, 1) == '{' && v.c.substr(-1) == '}') {
				var para = {};
				$.ieach(v.c.slice(1, -1).split(';'), function(ii, v, d) {
					var st = v.trim().split(':'),
						k = st[0] && st[0].trim(),
						v = st[1] && st[1].trim();
					if (k && v) para[k.toLowerCase()] = v;
				});
				disp(e, i, para);
			}
			else
				e.html(v.c);
		}
	}

	$scope.tool = {
		show: false,
		toggle: function(first, second) {
			$scope.tool.show = $scope.tool.show != first ? first : second;
		},
		autoHide: function() {
			if (parseInt($('.tool').css('left'))==0)
				$scope.tool.show = false;
		}
	}

	$scope.select = {
		start: function() {
			 $scope.list.onEdit = true;
		},
		length: function() {
			var bwList = $('.list:not(.ng-hide)');
			return bwList.children('li.selected').length;
		},
		clear: function() {
			var bwList = $('.list:not(.ng-hide)');
			bwList.children('li').removeClass('selected');
		},
		toggle: function(id) {
			var bwList = $('.list:not(.ng-hide)');
			bwList.children(id ? 'li[pl-id='+id+']' : 'li').toggleClass('selected');
			bwList.children('.selected').length ? $scope.select.start() : $scope.select.finish();
		},
		finish: function() {
			$scope.select.clear();
			$scope.list.onEdit = false;
		}
	}

	$scope.$watch('list.url+list.total', function(v) {
		var ls = $scope.list, pl = $scope.playlists
		if (!v || !ls || ls.total === undefined) return;
		$scope.tool.autoHide();

		$scope.listName = (ls.parent ? '< ' : '') + ls.name;
		$scope.listParentPath = ls.parent && ls.parent.path;
		if (pl[ls.url]) {
			$scope.listName = "Playlist: " + pl[ls.url];
		}
		else if (ls.word) {
			$scope.listName = "Search: '" + ls.word + "' in " + ls.name;
			$scope.listParentPath = ls.path;
		}

		var path = $scope.listPath = ls.path;
		var lpath = $scope.listLongestPath || '';
		if (path && lpath.indexOf(path) != 0) {
			var p = [], d = {'':'root'};
			$scope.listPathSplit = $.ieach(path.split('\\'), function(i, v, d) {
				if (v) {
					p.push(v);
					d[p.join('\\')+'\\'] = v;
				}
			}, d);
			$scope.listLongestPath = path;
		}
/*		$('.list:not(.ng-hide)').editlist({
			onDragBegin: function(li) {
				if (!$scope.list.onEdit) return true;
				if (!li.hasClass('selected')) return true;
			},
			onMoveBegin: function(li) {
				this.children('.selected').addClass('dragging');
			},
			onDropDown: function(li, dr) {
				if (dr.parent().length)
					this.children('.selected').removeClass('dragging')
						.remove().insertAfter(dr);
			}
		})
*/	})
	$scope.$watch('listUrl', function(url, url0) {
		if (url === url0) return;
		$location.path('/list').search({url: url});
		// call bwMain method to open
		$scope.open(url);
	})
	$scope.$watch('imgUrl', function(url, url0) {
		if (url === url0) return;
		$location.path('/img').search({url: url});
		// display image
		var tmpl = '<span class="loader" style="position:fixed;left:0;top:0;width:100%;color:#888;background-color:#eee;text-align:center;padding:1.5em 0;">Loading...</span>';
		var i = $('.img').find('img').hide(), l = $($('.img').find('.loader')[0] || $(tmpl).insertAfter(i).hide()[0]);
		var c = 0, p = "/''\\..";
		setTimeout(function check_loaded() {
			if (i[0].complete) {
				if (i[0].naturalWidth / i[0].naturalHeight > window.innerWidth / window.innerHeight)
					i.css({display:'block', width: 'auto', 'min-height': '100%'})
				else
					i.css({display:'block', 'min-width': '100%', height: 'auto'})
				l.hide();
				i.show();
			}
			else {
				i.hide();
				l.html('Loading '+(p+p).substr(Math.floor(c++)%p.length, p.length));
				l.show();
				setTimeout(check_loaded, 300);
			}
		}, 200);
	})

	// hash router
	$scope.$watch(function() {
		return $location.absUrl()
	}, function(url) {
		var l = $scope.location = {
			path :$location.path().substr(1),
			search :$location.search()
		}
		if (l.path == 'list' && l.search.url)
			$scope.listUrl = l.search.url;
		else if (l.path == 'img' && l.search.url)
			$scope.imgUrl = l.search.url;
		else
			$scope.listUrl = '/'
	})

	// only use jquery dom event here
	// $scope.$watch will not fire when a mobile browser goes to background
	$(document).find('audio[pl-audio]').bind('ended', function(e) {
		var offset = $scope.setting.play_single_track ? 0 : 1,
			loop = $scope.setting.play_no_loop ? false : true;
		if (offset || loop)
			$scope.playnext(offset, loop);
	})
	$(document).bind("scroll touchstart mousedown", function(e) {
		if ($(e.target.childNodes[0] || e.target).parents(".list").length) {
			$scope.tool.autoHide();
			$scope.$apply();
		}
	})
	// to make lyric
	$('img').mousedown(function(e) {
		var l = $('.lyric-content'), a = $('audio'), t = a[0].currentTime;
		if (!l.is(":visible")) return;

		var px = e.pageX, py = e.pageY;
		if (e.shiftKey || e.ctrlKey) px = l.children('[px]').last().attr('px') || px;

		var u = '['+sec2Mmss(t, 3)+']{left:'+px+';top:'+py+';}';
		if (e.ctrlKey) u = '&nbsp;';

		var d = $('<div>'+u+'</div>').click(function(e) {
			a[0].currentTime = parseFloat($(this).attr('tk'));
			$(this).nextAll().remove();
		}).attr('px', px).attr('tk', t)
		l.append(d).parent().scrollTop(9999)
	}).dblclick(function(e) {
		var l = $('.lyric-content'), a = $('audio'), t = a[0].currentTime;
		if (!l.is(":visible")) return;
		l.html('<div>[bkImg:'+$.url_parse($(this).attr('src')).dict.res+']</div>'+
			'<div>[bkAlignX:left]</div>'+
			'<div>[bkAlignY:center]</div>'+
			'<div>[bkWidth:'+this.naturalWidth+']</div>'+
			'<div>[bkHeight:'+this.naturalHeight+']</div>'+
			'<div>[bkLineWidth:800]</div>'+
			'<div>[bkLineHeight:50]</div>'+
			'<div>&nbsp;</div>'+
			'<div px="'+e.pageX+'">['+sec2Mmss(0, 3)+']{left:'+e.pageX+';top:'+e.pageY+';}</div>');
		$scope.playnext(0);
	});
})
