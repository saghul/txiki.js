import { run, test } from '../t.js';

test('cheerio check', async t => {
  await import('./generated/cheerio.js')

  t.ok(typeof cheerio !== 'undefined')
  t.ok(typeof cheerio.load !== 'undefined')
});

test('cheerio readme example', async t => {
  await import('./generated/cheerio.js')

  const $ = cheerio.load('<h2 class="title">Hello world</h2>')

  $('h2.title').text('Hello there!')
  $('h2').addClass('welcome')

  t.eq($.html(), `<h2 class=\"title welcome\">Hello there!</h2>`, "run the example provided from the README")
});

if (import.meta.main) {
    run();
}
