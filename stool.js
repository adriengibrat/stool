var suite
(function () {
	var common = document.getElementById('common')
	var titles = document.getElementsByClassName('title')
	var cases = document.getElementsByClassName('case')
	var results = document.getElementsByClassName('result')
	var s = document.getElementById('suite')
	var shareResult = document.getElementById('share-result')

	function abort () {
		if (!suite || (suite && !suite.running))
			return
		suite.abort()
		for (var i = 0; i < results.length; i++)
			if (results[i].classList.contains('running'))
				results[i].innerText = 'aborted'
	}

	function clear () {
		if (suite && suite.running)
			abort()
		for (var i = 0; i < results.length; i++) {
			results[i].innerText = ''
			results[i].classList.remove('running')
		}
	}

	function done () {
		document.body.classList.remove('running')
	}

	function update (result) {
		var sparkline = result.sparkline
		var line = []
		var labels = ['']
		var data = { series: [line], labels: labels }
		sparkline.update(data)
		result.classList.add('running')
		result.innerText = 'queued'
		return function (event) {
			if (event.target.aborted)
				return
			var speed = Math.round(event.target.hz)
			result.innerText = speed.toLocaleString() + ' ops/sec'
			if (speed !== Infinity)
				labels.push('') && line.push(speed) && sparkline.update(data)
			if (event.type === 'complete')
				result.classList.remove('running')
		}
	}

	var noAxys = { showLabel: false, showGrid: false, offset: 0 }
	var sparkline = { showPoint: false, axisX: noAxys, axisY: noAxys, chartPadding: 0, fullWidth: true, lineSmooth: Chartist.Interpolation.cardinal({ fillHoles: true }) }

	function run () {
		abort()
		var suite = new Benchmark.Suite()
		for (var i = 0; i < cases.length; i++) {
			if (!cases[i].value)
				continue
			var updateResult = update(results[i])
			suite.add({
				name: titles[i].value,
				fn: cases[i].value,
				setup: common.value,
				onCycle: updateResult,
				onComplete: updateResult
			})
		}
		if (!suite.length)
			return
		document.body.classList.add('running')
		return suite.on('complete', done).run({ async: true })
	}

	function add (title, code) {
		var html = '\
<td class="inputs">\
	<div class="ui fluid action input">\
		<input type="text" class="title input" placeholder="Label">\
		<button class="ui button remove" tabindex="-1">Remove</button>\
	</div>\
	<textarea rows="2" class="case input" placeholder="Code"></textarea>\
</td>\
<td>\
	<span class="result"></span>\
	<div class="sparkline"></div>\
</td>\
\
'
		var tr = document.createElement('tr')
		tr.innerHTML = html
		tr.getElementsByClassName('title')[0].value = title || ''
		tr.getElementsByClassName('case')[0].value = code || ''
		tr.getElementsByClassName('remove')[0].onclick = function () {
			tr.remove()
			clear()
		}
		var inputs = tr.getElementsByClassName('input')
		for (var i = 0; i < inputs.length; i++)
			inputs[i].oninput = function () {
				abort()
				shareResult.href = shareResult.innerText = ''
			}
		tr.getElementsByClassName('result')[0].sparkline = 
		new Chartist.Line(
			tr.getElementsByClassName('sparkline')[0],
			null,
			Object.assign({ width: 100, height: '1em' }, sparkline)
		)
		.on('draw', function(data) {
			data.type === 'line' && data.element.attr({ style: 'stroke-width: 1px; stroke: #ccc' })
		})
		s.appendChild(tr)
		clear()
	}

	function share () {
		var body = {
			public: true,
			files: {}
		}
		for (var i = 0; i < cases.length; i++)
			if (cases[i].value)
				body.files[titles[i].value || '__empty' + i] = {content: cases[i].value}
		if (common.value)
			body.files['__common'] = {content: common.value}
		if (Object.keys(body.files).length == 0)
			return
		var req = new XMLHttpRequest()
		req.open('post', 'https://api.github.com/gists', true)
		req.onload = function () {
			var result = JSON.parse(req.responseText)
			var location  = window.location.toString().replace(/#.*$/, '')
			shareResult.href = shareResult.innerText = location + '#' + result.id
		}
		req.send(JSON.stringify(body))
	}

	function load (id) {
		var req = new XMLHttpRequest()
		req.open('get', 'https://api.github.com/gists/' + id, true)
		req.onload = function () {
			var files = JSON.parse(req.responseText).files
			for (var file in files)
				if (file == '__common') {
					common.value = files[file].content
				} else {
					add(file, files[file].content)
				}
		}
		req.send()
		shareResult.href = shareResult.innerText = window.location
	}

	document.getElementById('add').onclick = function () { add() }
	document.getElementById('run').onclick = function () { suite = run() }
	document.getElementById('abort').onclick = abort
	document.getElementById('share').onclick = share

	if (window.location.hash.length)
		load(window.location.hash.substring(1))
	else
		add(), add()
})()