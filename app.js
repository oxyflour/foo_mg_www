angular.ieach = function (ls, fn, para) {
	for (var i = 0, r; i < ls.length && r === undefined; i ++)
		r = fn.call(ls, ls[i], i, para)
	return r !== undefined ? r : para
}
angular.keach = function (obj, fn, para) {
	var r
	for (var k in obj) {
		r = fn.call(obj, obj[k], k, para)
		if (r !== undefined)
			break
	}
	return r !== undefined ? r : para
}
angular.each = function (data, fn, para) {
	return (d.isArray() ? angular.ieach : angular.keach)(data, fn, para)
}
angular.paramsJoin = function (obj) {
	return angular.ieach(Object.keys(obj).sort(), function (k, i, d) {
		if (k && obj[k] !== undefined)
			d.push(k+'='+encodeURIComponent(obj[k]))
	}, [ ]).join('&')
}
angular.paramsSplit = function (str) {
	return angular.ieach((str || '').split('&'), function (s, i, d) {
		var sp = s.split('='), k = sp.shift(), v = sp.join('=')
		d[k] = decodeURIComponent(v)
	}, { })
}

var app = angular.module('app', ['ngRoute'/*, 'ngAnimate'*/])
app.value('config', {
	luaPath: '/lua/',
	playNext: true,
	playLoop: true,
})
app.filter('toBgImgCss', function () {
	return function (url) {
		return 'url('+url.replace(/([\(\)'"])/g, '\\$1')+')'
	}
})
app.factory('fooMG', function ($http, config) {
	return {
		list: function (params, begin, count) {
			var data = angular.paramsSplit(params)
			return $http({
				url: config.luaPath + 'browse.lua',
				method: 'GET',
				params: angular.extend(data, {
					tojson: 1,
					begin: begin,
					count: count,
					sort: data.sort || (config.sort && config.sort[params]) || (data.tlist && 'tlist') || undefined
				})
			})
		},
		getResUrl: function (data) {
			var params = angular.paramsJoin(data)
			return config.luaPath + 'resource.lua' + (params ? '?'+params : '')
		},
		shared: { }
	}
})
app.factory('player', function ($interval, $rootScope, fooMG, config) {
	var player = $rootScope.$new(true),
		audio = new Audio()

	player.interval = 0
	player.status = 'ready'
	player.sec2Mmss = function (sec) {
		var m = Math.floor(sec / 60),
			s = sec - m * 60
		return m + ':' + ('0' + s).slice(-2)
	}
	$(audio).on('play', function () {
		setTimeout(function () {
			$interval.cancel(player.interval)
			player.status = 'play'
			player.interval = $interval(function () {
				player.time.seconds = Math.floor(audio.currentTime + 0.5)
				player.time.mmss = player.sec2Mmss(player.time.seconds)
				player.time.mmssLeft = player.sec2Mmss(player.playing.seconds - player.time.seconds)
			}, 1000)
		}, (Math.ceil(audio.currentTime) - audio.currentTime)*1000)
	})
	$(audio).on('pause', function () {
		$interval.cancel(player.interval)
		player.status = 'paused'
	})
	$(audio).on('error', function () {
		$interval.cancel(player.interval)
		player.status = 'error'
	})
	$(audio).on('ended', function () {
		$interval.cancel(player.interval)
		player.status = 'ended'

		// continue playing
		if (config.playNext) {
			var id = player.getTrackId(0, 1, !config.playLoop)
			if (id) player.play(id)
		}
		// loop itself
		else if (config.playLoop)
			audio.play()
	})

	// player.params
	player.$watch('params', function (params) {
		if (params) fooMG.list(params).success(function (data) {
			player.playlist = angular.ieach(data.ls, function (v, i, d) {
				if (v.id) d.push(v.id)
			}, [ ]).join(',')
		})
	})
	// player.pid
	player.$watch('pid', function (pid) {
		if (pid) fooMG.list('tlist='+pid).success(function (data) {
			player.playing = data.ls[0]
		})
	})

	// return nothing if id is not empty and not in playlist
	player.getTrackId = function (id, offset, noloop) {
		var st = (player.playlist || '').split(',').map(parseFloat)
		if (!id) id = player.playing && player.playing.id || st[0]

		var i = st.indexOf(parseFloat(id))
		if (i < 0) return

		i = i + (offset || 0)
		if (!noloop) {
			i = i % st.length
			if (i < 0) i += st.length
		}

		return st[i]
	}
	player.play = function (id, offset) {
		if (!id && audio.src) {
			audio.play()
		}
		else if (id = player.getTrackId(id, offset) || id) {
			player.pid = id
			audio.src = fooMG.getResUrl({ id:id })
			audio.play()
		}
	}
	player.loadAndPlay = function (params, id) {
		player.params = params
		player.play(id)
	}
	player.pause = function () {
		audio.pause()
	}
	player.playPause = function () {
		audio.paused || audio.ended ? audio.play() : audio.pause()
	}
	player.isPaused = function () {
		return audio.paused
	}
	player.time = function (time) {
		return time === undefined ? audio.currentTime : (audio.currentTime = time)
	}
	Object.defineProperty(player, 'volume', {
		get: function () { return Math.floor(audio.volume * 100) },
		set: function (v) { audio.volume = v / 100 }
	})

	return player
})
app.directive('localStorage', function () {
	return {
		require: 'ngModel',
		scope: {
			model: '=ngModel',
			key: '@localStorage',
		},
		link: function (scope, elem, attrs, ctrl) {
			// set initial value if the storage is unset yet
			var k = scope.key || attrs.ngModel,
				m = k+'.localStorageInited'
			if (attrs.localStorageInitialValue && !localStorage.getItem(m)) {
				scope.model = scope.$eval(attrs.localStorageInitialValue)
				localStorage.setItem(k, JSON.stringify(scope.model))
				localStorage.setItem(m, true)
			}
			// getter / setter
			// note that if the storage will be removed if the value is empty (!value)
			scope.$watch('model', function(v, v0) {
				var k = scope.key || attrs.ngModel
				if (v === v0 && attrs.localStorageSaveOnly === undefined) {
					try {
						scope.model = JSON.parse(localStorage.getItem(k)) || ''
					}
					catch (e) {
					}
				}
				else {
					if (scope.model)
						localStorage.setItem(k, JSON.stringify(scope.model))
					else
						localStorage.removeItem(k)
				}
			});
		},
	};
})
app.directive('fitParentWidth', function () {
	return function (scope, elem, attrs, ctrl) {
		scope.$watch(function () {
			return elem.parent().width()
		}, function (v) {
			elem.width(v)
		})
		function onResize(e) {
			elem.width(elem.parent().width())
		}
		$(window).on('resize', onResize)
		elem.on('$destroy', function (e) {
			$(window).off('resize', onResize)
		})
	}
})
app.directive('onScrollAndSeen', function ($timeout) {
	return function (scope, elem, attrs, ctrl) {
		function onScroll(e, repeat) {
			if (elem.is(':visible') &&
					$(document).scrollTop() + $(window).height() > elem.offset().top) {
				scope.$eval(attrs.onScrollAndSeen)
				// let's check it later
				if (repeat > 10)
					console.log('[auto scroll] repeat too many times, giving up...')
				else setTimeout(function () {
					onScroll(null, (repeat || 0) + 1)
				}, 200)
			}
		}
		$(document).on('scroll', onScroll)
		elem.on('$destroy', function (e) {
			$(document).off('scroll', onScroll)
		})
		// !Important: do things after other directives loaded
		$timeout(function () {
			$(document).trigger('scroll')
		}, 0)
	}
})
app.directive('onTouchStart', function ($timeout) {
	return function (scope, elem, attrs, ctrl) {
		elem.on('touchstart', function () {
			scope.$apply(function () {
				scope.$eval(attrs.onTouchStart)
			})
		})
	}
})
app.directive('cacheScrollPosition', function ($location, $cacheFactory) {
	var cache = $cacheFactory('cacheScrollPosition')
	function onScroll (e) {
		cache.url = $location.url()
		cache.top = $(this).scrollTop()
	}
	return function (scope, elem, attrs, ctrl) {
		var container = elem.is('body') ? $(window) : elem;
		container.off('scroll', onScroll).on('scroll', onScroll)
		function checkScroll (top, repeat) {
			container.scrollTop(top)
			setTimeout(function () {
				if (repeat > 0 && container.scrollTop() != top)
					checkScroll(top, repeat - 1)
			}, 10)
		}
		scope.$on('$routeChangeSuccess', function () {
			checkScroll(cache.get(cache.url = $location.url()), 20)
		})
		scope.$on('$routeChangeStart', function () {
			cache.put(cache.url, cache.top)
		})
	}
})
app.directive('includeTemplate', function ($compile) {
	return function (scope, elem, attrs, ctrl) {
		elem.html($('#'+attrs.includeTemplate).html())
		$compile(elem.contents())(scope)
	}
})
app.directive('onFocusOut', function ($timeout) {
	return function (scope, elem, attrs, ctrl) {
		elem.delegate('*', 'blur', function (e) {
			$timeout(function () {
				if (!elem.find(':focus').length)
					scope.$eval(attrs.onFocusOut)
			}, parseInt(attrs.onFocusOutDelay || 100))
		})
	}
})
app.directive('focusMe', function () {
	return function (scope, elem, attrs, ctrl) {
		scope.$watch(attrs.focusMe, function (v) {
			v && setTimeout(function () {
				elem.focus()
			}, parseInt(attrs.focusMeDelay || 100))
		})
	}
})
app.directive('showDelay', function() {
	return function (scope, elem, attrs, ctrl) {
		elem.css('opacity', 0)
		setTimeout(function () {
			elem.css('opacity', 1)
		}, parseFloat(attrs.showDelay || 400))
	}
})
app.controller('list', function ($scope, $location, $routeParams, $cacheFactory, fooMG) {
	function getBrackets(str) {
		var rb = [], sb = [];
		var s = str.replace(/\(([^\(\)]+)\)/g, function(m, v) {
			rb.push(v); return ' ';
		}).replace(/\[([^\[\]]+)\]/g, function(m, v) {
			sb.push(v); return ' ';
		}).replace(/_|\s+/g, " ").replace(/^\s*|\s*$/g, "");
		return {
			shortString: s,
			roundBrackets: rb,
			squreBrackets: sb
		}
	}
	function getSplitDirs(path) {
		var st = path.split('/'),
			dirs = [{ name:'Root', shortName:'Root', path:'' }]
		angular.forEach(st, function(s, i) {
			if (s) dirs.push({
				name: s,
				shortName: getBrackets(s).shortString || s,
				path: st.slice(0, i+1).join('/')+'/',
			})
		})
		return dirs
	}
	function processItem(i) {
		if (i.path)
			i.path = i.path.replace(/\\/g, '/')
		if (i.typ === "folder") {
			// extract date time from folder name
			i.name = i.name.replace(/^\d\d\d\d\.\d\d\.\d\d/, '($&)')
			var bs = getBrackets(i.name)
			i.shortName = bs.shortString || 'No Title'
			i.bracketsJoin = bs.roundBrackets.join(' ')
			i.sbracketsJoin = bs.squreBrackets.map(function(s) {
				return '[' + s + ']'
			}).join(' ')
		}
		else if (i.typ === 'track') {
			var items = $scope.items,
				j = items.albumItem || { }
			if ((i.album && j.album !== i.album) || (i.path && i.path !== j.path)) {
				i.group = i.album
				i.count = 0
				items.albumItem = i
				items.groupCount = (items.groupCount || 0) + 1
			}
			if (items.albumItem)
				items.albumItem.count ++
		}
		return i
	}

	$scope.items = [ ]
	$scope.search = $routeParams
	$scope.path = $routeParams.path || ($routeParams.path = '')
	$scope.params = angular.paramsJoin($routeParams)

	$scope.loadMore = function (callback) {
		if (!$scope.loadPromise && !($scope.items.length >= $scope.items.total)) {

			// try load from cache
			var cache = fooMG.listCache || (fooMG.listCache = $cacheFactory('listCache')),
				data = cache.get($scope.params)
			if (data && data.items && data.items.length > $scope.items.length) {
				// restore
				angular.extend($scope, data)
				// share
				fooMG.mainScope && (fooMG.mainScope.list = $scope)
				callback && callback($scope.items)
				return
			}

			// load from fooMG
			$scope.loadPromise = fooMG.list($scope.params, $scope.items.length, 24)
			$scope.loadPromise.success(function(data) {
				angular.forEach(data.ls, function (item, index) {
					if (item) // cjson will fill nulls in a sparse array
						$scope.items[parseInt(index)] = processItem(item)
				})
				$scope.items.total = data.total
				// save in cache
				cache.put($scope.params, {
					items: $scope.items,
					res: $scope.res = data.res,
				})
			}).finally(function() {
				$scope.loadPromise = null
				// share
				fooMG.mainScope && (fooMG.mainScope.list = $scope)
				callback && callback($scope.items)
			})
		}
		else setTimeout(function () {
			callback && callback()
		}, 200)
	}
	$scope.reload = function () {
		if (fooMG.listCache)
			fooMG.listCache.put($scope.params, null)
		$scope.items = [ ]
		$scope.loadMore()
	}
	$scope.loadAll = function (callback, repeat) {
		if ($scope.items.length >= $scope.items.total || repeat > 10)
			callback($scope.items)
		else $scope.loadMore(function () {
			$scope.loadAll(callback, (repeat || 0) + 1)
		})
	}

	if ((fooMG.pathLongest || '').indexOf($scope.path) !== 0)
		fooMG.pathLongest = $scope.path
	$scope.dirs = getSplitDirs(fooMG.pathLongest || '')
	var dirs = $scope.path.split('/'),
		name = dirs.slice(-2, -1).toString(),
		parent = dirs.slice(0, -2)
	$scope.info = getBrackets($scope.path)
	$scope.parentPath = parent.concat('').join('/')
	$scope.title = ($scope.search.word && 'Searching "'+$scope.search.word+'"') ||
		getBrackets(name).shortString || name
})
app.controller('main', function ($scope, $location, $timeout, fooMG, player, config) {
	fooMG.mainScope = $scope

	$scope.player = player
	$scope.config = config

	$scope.paramsSplit = angular.paramsSplit

	$scope.getHoverSeconds = function (e) {
		var t = $(e.currentTarget), p = t.offset(),
			w = t.width(), x = e.pageX, f = (x - p.left) / w
		if (player.playing) {
			var time = { }
			time.seconds = Math.floor(player.playing.seconds * f)
			time.mmss = player.sec2Mmss(time.seconds)
			time.mmssLeft = player.sec2Mmss(player.playing.seconds - time.seconds)
			return time
		}
	}

	$scope.getLocalStorageObject = function (prefix) {
		var ls = {};
		for (var i = 0; i < localStorage.length; i ++) {
			var k = localStorage.key(i);
			if (k.search(prefix) == 0) {
				var u = k.substr(prefix.length);
				try {
					ls[u] = JSON.parse(localStorage.getItem(k))
				}
				catch (e) {
					ls[u] = ''
				}
			}
		}
		return ls;
	}
	$scope.getPlaylistsCount = function () {
		return angular.keach($scope.playlists, function (v, k, d) {
			if (v) d.push(k)
		}, [ ]).length
	}
	$scope.playlists = $scope.getLocalStorageObject('playlist:')

	$scope.getResUrl = fooMG.getResUrl
	$scope.getListUrl = function (params) {
		if (!params)
			params = { }
		else if (typeof(params) == 'string')
			params = angular.paramsSplit(params)
		var path = encodeURIComponent(params.path || '')
		delete params.path
		params = angular.paramsJoin(params)
		return '/list/'+path+(params ? '?'+params : '')
	}
	$scope.browse = function (params) {
		$location.url($scope.getListUrl(params))
	}

	function getIds (items) {
		return angular.ieach(items, function (item, i, d) {
			if (item.id) d.push(parseInt(item.id))
		}, [ ])
	}
	function getTargetItemIds (source, callback) {
		var sids = getIds($scope.list.items.filter(function (item) {
			return item.selected
		}))
		if (source == 'all') $scope.list.loadAll(function (items) {
			callback(getIds(items), true)
		})
		else if (source == 'unselected') $scope.list.loadAll(function (items) {
			if (sids.length) items = items.filter(function (item) {
				return sids.indexOf(item.id) == -1
			})
			callback(getIds(items), !sids.length)
		})
		else
			callback(sids)
	}
	function getPlaylistItemIds (params, callback) {
		var items = [ ]
		if (params) {
			var data = angular.paramsSplit(params)
			if (data.tlist)
				callback(data.tlist.split(',').map(parseFloat))
			else fooMG.list(params).success(function (data) {
				items = getIds(data.ls)
			}).finally(function () {
				callback(items)
			})
		}
		else
			callback(items)
	}
	$scope.updatePlaylist = function (select) {
		if (select) getTargetItemIds(select.source, function (sids, all) {
			var params = select.target,
				playlists = $scope.playlists,
				name = playlists[params]
			if (params == '$new') {
				name = prompt('Enter New Playlist Name', $scope.list.title || 'Unnamed')
				params = ''
			}
			if (name) getPlaylistItemIds(params, function (pids) {
				// let's merge playlist items & selected items to get new params
				var newParams = params
				if (!pids.length)
					newParams = all ? $scope.list.params : 'tlist='+sids.join(',')
				else if (sids.length) {
					angular.ieach(sids, function (id) {
						if (pids.indexOf(id) == -1)
							pids.push(id)
					})
					newParams = 'tlist='+pids.join(',')
				}
				// save it in playlist. Dont' override saved items
				playlists[params] = undefined
				if (playlists[newParams])
					newParams += '&time='+Date.now()
				playlists[newParams] = name
			})
		})
		angular.ieach($scope.list.items, function (item) {
			item.selected = false
		})
	}
	$scope.getSelectedLength = function () {
		return angular.ieach($scope.list.items, function (item, i, d) {
			if (item.selected) d.c ++
		}, { c:0 }).c
	}

	$scope.$on('$routeChangeSuccess', function () {
		$scope.route = {
			path: $location.path(),
		}
	})
})
app.config(function ($routeProvider) {
	$routeProvider.when('/list/:path*?', {
		controller: 'list',
		template: $('#tmplList').html(),
	}).when('/playlists', {
		template: $('#tmplPlaylists').html(),
	}).when('/help', {
		template: $('#tmplHelp').html(),
	}).otherwise({
		redirectTo: '/list/',
	})
})
