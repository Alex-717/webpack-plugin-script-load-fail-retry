const HtmlWebpackPlugin = require("html-webpack-plugin");
const PluginName = 'ScriptRetryPlugin'
const path = require('path')
const fs = require('fs');

const isJS = (file) => /\.js(\?[^.]+)?$/.test(file);
const isHtml = (file) => /\.html$/.test(file);

// options = {
//   retry: 1,
//   delayRetry: 1000,
//   whileList: []
// }
class ScriptRetryPlugin {
  constructor (options = {}) {
    this.options = Object.assign({ retry: 1, delayRetry: 1000 }, options)
  }
  apply (compiler) {
    compiler.hooks.compilation.tap(PluginName, (compilation) => {
      // 往html的head标签中注入script重试逻辑
      this.injectRetryLogic(compilation)
    })
  }
  injectRetryLogic (compilation) {
    if (HtmlWebpackPlugin.getHooks) {
      console.log('\x1b[42m\x1b[37m%s\x1b[0m', 'webpack-plugin-script-loadfail-retry: 使用的是新版本的html-webpack-plugin');
      const mainChunks = []
      // alterAssetTags钩子没有提供html字段
      HtmlWebpackPlugin.getHooks(compilation).alterAssetTags.tapAsync(
        PluginName,
        (data, cb) => {
          const { assetTags: { scripts = [] } } = data
          scripts.forEach(item => {
            const { attributes: { src } } = item
            mainChunks.push(src)
          })
          cb()
        }
      )
      // afterTemplateExecution钩子提供html字段，并且在alterAssetTags钩子后执行
      HtmlWebpackPlugin.getHooks(compilation).afterTemplateExecution.tapAsync(
        PluginName,
        (data, cb) => {
          const codeArray = []
          const code = `var retryOptions = ${JSON.stringify(this.options)};var __async_chunk_retry_map___ = {};var __basic_chunks__ = ${JSON.stringify(mainChunks)};`
          codeArray.push(
            code,
            getJsCode('./scriptRetryApendChild.js'),
            getJsCode('./scriptRetryLogic.js')
          )
          data.html = injectCode(data.html, codeArray)
          cb()
        }
      )
    } else {
      // 3.2.0一下的html-webpack-plugin
      console.log('\x1b[42m\x1b[37m%s\x1b[0m', 'webpack-plugin-script-loadfail-retry: 使用的是老版本的html-webpack-plugin');
      compilation.plugin(
        'html-webpack-plugin-before-html-processing',
        (data) => {
          const mainChunks = []
          const { assets: { chunks } } = data
          for (const [key, value] of Object.entries(chunks)) {
            const { entry } = value
            if (isJS(entry)) {
              mainChunks.push(path.basename(entry))
            }
          }
          const codeArray = []
          const code = `var retryOptions = ${JSON.stringify(this.options)};var __async_chunk_retry_map___ = {};var __basic_chunks__ = ${JSON.stringify(mainChunks)};`
          codeArray.push(
            code,
            getJsCode('./scriptRetryApendChild.js'),
            getJsCode('./scriptRetryLogic.js')
          )
          data.html = injectCode(data.html, codeArray)
        }
      )
    }
  }
}

function getJsCode (p) {
  const filePath = path.resolve(__dirname, p)
  const jsCode = fs.readFileSync(filePath, { encoding: 'utf-8' })
  return jsCode
}

function injectCode (htmlStr, codeArray) {
  let string = '<head><script>;(function (){'
  codeArray.forEach(item => {
    string += item
  })
  string += '})();\n</script>'
  const newStr = htmlStr.replace('<head>', string)
  return newStr
}

module.exports = ScriptRetryPlugin
