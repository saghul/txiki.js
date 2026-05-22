import assert from 'tjs:assert';


await import('./generated/cheerio.js')

assert.ok(typeof cheerio !== 'undefined')
assert.ok(typeof cheerio.load !== 'undefined')

const $ = cheerio.load('<h2 class="title">Hello world</h2>')

$('h2.title').text('Hello there!')
$('h2').addClass('welcome')

assert.eq($('h2').html(), `Hello there!`, 'text replaced via cheerio')
assert.eq($('h2').attr('class'), `title welcome`, 'class added via cheerio')
