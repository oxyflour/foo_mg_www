function sec2Mmss(sec, n) {
	var m = Math.floor(sec / 60), s = (sec - m*60).toFixed(n);
	return m + ':' + (s >= 10 ? s : '0'+s);
}
function mmss2Sec(mmss) {
	var p = mmss.split(':');
	return parseFloat(p[0])*60 + parseFloat(p[1]);
}
var app = angular.module('app', []);
app.config(function($compileProvider) {
	$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|data):/);
})
app.filter('urlEncode', function() {
	return encodeURIComponent;
})
app.filter('btoa', function() {
	return btoa;
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
		if (!(lists.length <= parseInt(elem.attr('bw-main-cache'))) && find.oldest) {
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
						// extract date time from folder name
						v.name = v.name.replace(/^\d\d\d\d\.\d\d\.\d\d/, '($&)');
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
						typ: {jpg:'img',png:'img',bmp:'img',txt:'txt',log:'txt'}[v.split('.').pop().toLowerCase()]
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
		var player = scope.player = (scope.player || {});
		player.load = function(id) {
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
				$http.get(lrc, {// do not transform txt
					transformResponse: function(d) { return d }
				}).success(function(data) {
					ad.lyric = data;
				});
			}
		}
		player.play = function(id) {
			player.load(id);
			a[0].play();
		}
		player.playnext = function(offset, loop) {
			var ls = player.playlist.split(','), i = $.ieach(ls, function(i, v) {
				return v == scope.audio.id ? i : undefined;
			}, -1) + offset;
			var j = loop ? ((i+ls.length) % ls.length) : i, d = ls[j];
			if (d) player.play(d);
		}
		player.pause = function() {
			a[0].pause();
		}
		player.playpause = function(id) {
			if (id && id != scope.audio.id)
				player.play(id);
			else
				a[0].paused ? a[0].play() : a[0].pause();
		}
		player.seek = function(time) {
			a[0].currentTime = time;
		}

		// try to restore play state
		player.playlist = player.playlist || '';
		if(scope.audio && scope.audio.id)
			player.load(scope.audio.id);

		// only use jquery dom event here
		// $scope.$watch will not fire when a mobile browser goes to background
		a.bind('ended', function(e) {
			var offset = elem.attr('pl-ctrl-next') ? 1 : 0,
				loop = elem.attr('pl-ctrl-loop') ? true : false;
			if (offset || loop)
				player.playnext(offset, loop);
		})
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
/*
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
*/
app.directive('plLyric', function($http) {
	return function (scope, elem, attrs, ctrl) {
		var audio = $(attrs.plLyric), timeout = 0,
			content = [], info = {};
		function split(content) {
			var para = {};
			$.ieach(content.split(';'), function(ii, v, d) {
				var st = v.trim().split(':'),
					k = st[0] && st[0].trim(),
					v = st[1] && st[1].trim();
				if (k && v) para[k.toLowerCase()] = v;
			});
			return para;
		}
		function parse(txt) {
			content = [];
			info = {};
			var e = null, r = /\[([\d\.:]+)\](.*)/, k = /\[([^:]+):([^\]]+)\]/;
			$.ieach(txt.split('\n'), function(i, v, d) {
				if (e = r.exec(v)) d.push({
					t: mmss2Sec(e[1]),
					d: e[2].substr(0, 1) == '{' && e[2].substr(-1) == '}' ?
						split(e[2].slice(1, -1)) : e[2],
					c: v
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
					timeout = setTimeout(update, Math.max(200, (n.t - t)*1000+50));
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
			return elem.width() * elem.height();
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

	$scope.setting = { }

	$scope.conf = {
		list_url: function(url, begin, count) {
			var p = $.url_parse(url);
			p.dict.path = p.path.replace(/\//g, '\\');
			p.dict.tojson = 1;
			p.dict.begin = parseInt(p.begin || '0') + (begin || 0);
			p.dict.count = count;
			p.dict.sort = $scope.setting.list_sort && $scope.setting.list_sort[url] || p.dict.sort;
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

	var $browser = $scope.browser = {
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
			$select.finish();
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
			$select.finish();
		},
		// play (every items) under current listUrl
		playCurrent: function(id) {
			$scope.player.playpause(id);
			$scope.playUrl = $scope.listUrl;
			get_full_list(function(list) {
				var dataList = get_tracks_from_data(list);
				$scope.player.playlist = dataList.join(',');
			});
		}
	}

	var $player = $scope.player = {
		show: false,
		getHoverPosition: function(e) {
			var t = $(e.currentTarget), p = t.offset(), w = t.width(), x = e.pageX;
			$player.hoverSec = $scope.audio ? $scope.audio.length * (x - p.left) / w : 0;
			$player.hoverMmss = $scope.audio ? sec2Mmss($player.hoverSec) : '';
		}
	}

	var $lyric = $scope.lyric = {
		load: function(i, c) {
			$lyric.info = i;
			$lyric.content = c;
			$lyric.current = {};
		},
		update: function(i, n, v) {
			$lyric.current.index = n;
			var elem = $('[pl-lyric]'), img = elem.find('img'), txt = elem.find('.text');
			if (!elem.is(":visible")) return;
			function dispbk(e, i, p) {
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
			function disptxt(e, i, n) {
				var baseY = e.height() / 2, pos = txt.find('.line[lrc-id='+n+']').position();
				var trans = 'translate3d(0, '+
					Math.floor(baseY-(pos ? pos.top : 0))+'px, 0'
				txt.css({
					'-webkit-transform': trans,
					'-moz-transform': trans,
					'-ms-transform': trans,
					'transform': trans,
				});
			}
			if (typeof(v.d) == typeof({}))
				dispbk(elem, i, v.d);
			else
				disptxt(elem, i, n);
		}
	}

	var $tool = $scope.tool = {
		show: false,
		toggle: function(first, second) {
			$tool.show = $tool.show != first ? first : second;
		},
		autoHide: function() {
			if (parseInt($('.tool').css('left'))==0)
				$tool.show = false;
		},
		showTxt: function(title, url) {
			$tool.show = 'txt';
			$tool.showTxt.title = title;
			$tool.showTxt.loading = true;
			$http.get(url, {// do not transform txt
				transformResponse: function(d) { return d }
			}).success(function(data) {
				$tool.showTxt.text = data;
				$tool.showTxt.loading = false;
			}).error(function() {
				$tool.showTxt.text = 'load failed';
				$tool.showTxt.loading = false;
			})
			$timeout(function() {
				if ($tool.showTxt.loading)
					$tool.showTxt.text = 'loading...';
			}, 500)
		}
	}

	var $select = $scope.select = {
		start: function() {
			$scope.list.onEdit = true;
		},
		length: function() {
			return $('body').children('.list').not('.ng-hide').children('li.selected').length;
		},
		clear: function() {
			$('body').children('.list').not('.ng-hide').children('li').removeClass('selected');
		},
		toggle: function(id) {
			var bwList = $('body').children('.list').not('.ng-hide');
			bwList.children(id ? 'li[pl-id='+id+']' : 'li').toggleClass('selected');
			bwList.children('.selected').length ? $select.start() : $select.finish();
		},
		finish: function() {
			$select.clear();
			$scope.list.onEdit = false;
		}
	}

	$scope.$watch('list.url+list.total', function(v) {
		var ls = $scope.list, pl = $scope.playlists
		if (!v || !ls || ls.total === undefined) return;
		$tool.autoHide();

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
	})
	$scope.$watch('listUrl', function(url, url0) {
		if (url === url0) return;
		$location.path('/list').search({url: url});
		// call bwMain method to open
		$scope.open && $scope.open(url);
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

	$(document).bind("scroll touchstart mousedown", function(e) {
		if ($(e.target.childNodes[0] || e.target).parents(".list").length) {
			$tool.autoHide();
			$scope.$apply();
		}
	})
})
