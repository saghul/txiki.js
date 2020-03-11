import assert from '../assert.js';


(async () => {
  await import('./generated/cheerio.js')

  assert.ok(typeof cheerio !== 'undefined')
  assert.ok(typeof cheerio.load !== 'undefined')

  const $ = cheerio.load('<h2 class="title">Hello world</h2>')

  $('h2.title').text('Hello there!')
  $('h2').addClass('welcome')

  assert.eq($.html(), `<h2 class=\"title welcome\">Hello there!</h2>`, "run the example provided from the README")
})();
