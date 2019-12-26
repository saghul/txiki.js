import { run, test } from '../t.js';

test('jsdom check', async t => {
  await import('./generated/jsdom.js')

  t.ok(typeof jsdom !== 'undefined')
  t.ok(typeof jsdom.JSDOM !== 'undefined')
});

test('jsdom readme example', async t => {
  await import('./generated/jsdom.js')

  const { JSDOM } = jsdom

  let dom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
  t.eq(dom.window.document.querySelector("p").textContent, "Hello world", "run the example provided from the README")

  dom = new JSDOM(`<body>
    <script>document.body.appendChild(document.createElement("hr"));</script>
  </body>`)
  t.eq(dom.window.document.body.children.length, 1)

  dom = new JSDOM(`<body>
    <script>document.body.appendChild(document.createElement("hr"));</script>
  </body>`, { runScripts: "dangerously" })
  t.eq(dom.window.document.body.children.length, 2)

});

if (import.meta.main) {
    run();
}
