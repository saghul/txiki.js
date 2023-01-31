import assert from 'tjs:assert';


await import('./generated/jsdom.js')

assert.ok(typeof jsdom !== 'undefined')
assert.ok(typeof jsdom.JSDOM !== 'undefined')

const { JSDOM } = jsdom

let dom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
assert.eq(dom.window.document.querySelector("p").textContent, "Hello world", "run the example provided from the README")

dom = new JSDOM(`<body>
    <script>document.body.appendChild(document.createElement("hr"));</script>
    </body>`)
assert.eq(dom.window.document.body.children.length, 1)

dom = new JSDOM(`<body>
    <script>document.body.appendChild(document.createElement("hr"));</script>
    </body>`, { runScripts: "dangerously" })
assert.eq(dom.window.document.body.children.length, 2)
