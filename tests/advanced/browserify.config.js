const browserify = require('browserify');
const path = require('path')
const fs = require('fs')

function createGeneratorInput(generatorName) {
  console.log(`generating ${generatorName}...`)
  browserify({ standalone: generatorName, require: generatorName })
    .add(path.join(__dirname, `generator/${generatorName}.js`))
    .bundle()
    .pipe(fs.createWriteStream(path.join(__dirname, `generated/${generatorName}.js`)))
}

[
  'cheerio',
  'global-jsdom',
  'jsdom'
].map(createGeneratorInput)