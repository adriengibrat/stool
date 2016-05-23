!function (document, Chartist, CodeMirror, domData) {
	var data = domData()
	var format = function (number, decimals) {
		if (!number) return 0
		decimals = decimals || 1
		var base = 1000
		var unit = ['', 'k', 'm', 'g']
		var index = Math.min(unit.length - 1, Math.floor(Math.log(number) / Math.log(base)))
		if (! (index in unit))
			return number
		number = number / Math.pow(base, index)
		return (number % 10 ? number.toFixed(decimals) : number) + unit[index]
	}

	var stackBars = { stackBars: true, horizontalBars: true,
		axisY: { showGrid: false, offset: 0 },
		axisX: {
			labelInterpolationFnc: function(value, index, labels) {
				if (0 === value)
					return value
				if (index === labels.length - 1)
					return
				return format(value)
			}
		}
	}
	var Sparkline = function (element, settings) {
		var noAxys = { showLabel: false, showGrid: false, offset: 0 }
		var sparklineSettings = { showPoint: false, axisX: noAxys, axisY: noAxys, chartPadding: 0, fullWidth: true, lineSmooth: Chartist.Interpolation.cardinal({ fillHoles: true }) }
		return new Chartist.Line(element, null, Object.assign(settings, sparklineSettings))
			.on('draw', function(data) {
				data.type === 'line' && data.element.attr({ style: 'stroke-width: 1px; stroke: #ccc' })
			})
	}
	var Editor = function (element) {
		return CodeMirror.fromTextArea(element, {
			mode: 'javascript',
			lineNumbers: true,
			lineWrapping: true,
			extraKeys: {'Ctrl-f': function(cm){ cm.foldCode(cm.getCursor()) }},
			foldGutter: true,
			gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter']
		})
	}

	var shareResult = document.getElementById('share-result')

	var init = function (data, common, graph, suite, template, cards) {
		var start = function (event) {
			document.body.classList.add('running')
			var labels = event.currentTarget.map(function (benchmark) { return benchmark.name })
			this.graph.data.labels = labels
			this.graph.update(this.graph.data, { axisY: { offset: Math.max.apply(Math, labels.map(function (label) { return label.length })) * 12 * .75 } }, true)
			console.log(this.graph.data)
		}
		var complete = function (event) {
			document.body.classList.remove('running')
			this.graph.data.series = [event.currentTarget.map(function (benchmark) { return benchmark.hz })]
			this.graph.update(this.graph.data)
			console.log(this.graph.data)
		}
		var queued = function () {
			this.result.classList.add('running')
			this.result.innerText = 'queued'
		}
		var abort = function () {
			this.result.classList.contains('running') &&
			(this.result.innerText = 'aborted')
		}
		var clear = function () {
			this.result.classList.remove('running')
			this.result.innerText = ''
			this.sparkline.update({})
		}
		var update = function (test) {
			var line = []
			var labels = ['']
			var data = { series: [line], labels: labels }
			test.sparkline.update(data)
			queued.call(test)
			return function (event) {
				if (event.target.aborted)
					return
				var speed = Math.round(event.target.hz)
				test.result.innerText = speed.toLocaleString() + ' ops/sec'
				if (speed !== Infinity)
					labels.push('') && line.push(speed) && test.sparkline.update(data)
				if (event.type === 'complete')
					test.result.classList.remove('running')
			}
		}
		data(common).editor = Editor(common)
		return {
			graph: new Chartist.Bar(graph, {
				labels: [''],
				series: [[]]
			}, stackBars),
			get setup () {
				return data(common).editor.getValue()
			},
			set setup (value) {
				data(common).editor.setValue(value)
			},
			get cases () {
				return [].reduce.call(cards, function (list, card) {
					return list.concat({
						get name () { return data(card).title.value },
						set name (value) { data(card).title.value = value },
						get code () { return data(card).editor.getValue() },
						set code (value) { data(card).editor.setValue(value) },
						result: data(card).result,
						sparkline: data(card).sparkline
					})
				}, [])
			},
			run () {
				this.abort()
				var setup = this.setup
				return this.suite = this.cases.reduce(function (suite, test) {
					if (!test.code)
						return
					suite.push(
						(new Benchmark({
							name: test.name,
							fn: test.code,
							setup: setup
						}))
						.on('cycle complete', update(test))
					)
					return suite
				}, new Benchmark.Suite)
					.on('start', start.bind(this))
					.on('complete', complete.bind(this))
					.run({ async: true })
			},
			add (name, code) {
				var card = template.content.cloneNode(true).querySelector('.card')
				var title = card.querySelector('.title')
				var textarea = card.querySelector('.case')
				var sparkline = card.querySelector('.sparkline')
				var result = card.querySelector('.result')
				var remove = card.querySelector('.remove')
				var clear = this.clear.bind(this)
				suite.appendChild(card)
				title.value = name || ''
				textarea.value = code || ''
				data(card).title = title
				data(card).editor = Editor(textarea)
				data(card).sparkline = Sparkline(sparkline, { width: '100%', height: '1em' })
				data(card).result = result
				remove.onclick = function () {
					card.remove()
					data.remove(card)
					clear()
				}
				clear()
			},
			abort () {
				this.suite && this.suite.running && this.suite.abort() &&
				this.cases.forEach(function (test) { abort.call(test) })
			},
			clear () {
				this.suite && this.suite.running && this.suite.abort()
				this.cases.forEach(function (test) { clear.call(test) })
			},
			share () {
				var body = { public: true, files: {} }
				this.cases.forEach(function (test, index) {
					test.code && (body.files[test.name || '__empty' + index] = {content: test.code})
				})
				if (this.setup)
					body.files['__common'] = {content: this.setup}
				if (Object.keys(body.files).length == 0)
					return
				var request = new XMLHttpRequest()
				request.open('post', 'https://api.github.com/gists', true)
				request.onload = function () {
					var result = JSON.parse(request.responseText)
					var location  = window.location.toString().replace(/#.*$/, '')
					shareResult.href = shareResult.innerText = location + '#' + result.id
				}
				request.send(JSON.stringify(body))
			}
		}
	}

	function load (id) {
		var req = new XMLHttpRequest()
		req.open('get', 'https://api.github.com/gists/' + id, true)
		req.onload = function () {
			var files = JSON.parse(req.responseText).files
			for (var file in files)
				if (file == '__common') {
					bench.setup = files[file].content
				} else {
					bench.add(file, files[file].content)
				}
		}
		req.send()
		shareResult.href = shareResult.innerText = window.location
	}

	var bench = init(
		data,
		document.getElementById('common'),
		document.getElementById('graph'),
		document.getElementById('suite'),
		document.getElementById('test'),
		document.getElementsByClassName('test')
	)

	document.getElementById('add').onclick = function () { bench.add() }
	document.getElementById('run').onclick = function () { bench.run() }
	document.getElementById('abort').onclick = function () { bench.abort() }
	document.getElementById('share').onclick = function () { bench.share() }
	document.onkeyup = function (event) {
		if (event.metaKey)
			switch (event.keyCode) {
				case 65: return bench.abort() // a
				case 82: return bench.run() // r
				case 83: return bench.share() // s
				case 84: return bench.add() // t
			}
	}

	if (window.location.hash.length)
		load(window.location.hash.substring(1))
	else
		bench.add(), bench.add()

}(document, Chartist, CodeMirror, function () {
	var cache = [null]
	var expando = 'data' + +new Date
	var data = function (element) {
		var cacheIndex = element[expando]
		var nextCacheIndex = cache.length
		if (!cacheIndex) {
			cacheIndex = element[expando] = nextCacheIndex
			cache[cacheIndex] = {}
		}
		return cache[cacheIndex]
	}
	data.remove = function (element) {
		var cacheIndex = element[expando]
		cacheIndex && delete cache[cacheIndex]
	}
	return data
})
!function templatePolyfill (document) {
	if ('content' in document.createElement('template'))
		return
	var templates = document.getElementsByTagName('template')
	for (var index = 0, content, fragment; index < templates.length; ++index) {
		content = templates[index].childNodes
		fragment = document.createDocumentFragment()
		while (content.length)
			fragment.appendChild(content[0])
		templates[index].content = fragment
	}
}(document)
