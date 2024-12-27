const fs = require('fs')
const path = require('path')

function getJsCode (p) {
  const filePath = path.resolve(__dirname, p)
  const jsCode = fs.readFileSync(filePath, { encoding: 'utf-8' })
  return jsCode
}

// const jsCode1 = getJsCode('./dist/scriptRetryApendChild.js')
const jsCode = getJsCode('./dist/scriptRetryLogic.js')

const str = `<script>\n;(function() {var retryOptions = {"retry":1,"delayRetry":1000};var __async_chunk_retry_map___ = {};var __basic_chunks__ = [];${jsCode}})();\n</script>`

fs.writeFile('./dist/script_loadfail_retry.html', str, (err) => {
  if (err) {
    console.error('toStatic error', err)
  }
})