import terser from '@rollup/plugin-terser'
import copy from 'rollup-plugin-copy'

export default [
  {
    input: 'lib/scriptRetryLogic.js',
    output: {
      file: 'dist/scriptRetryLogic.js',
      format: 'iife', // 输出格式：立即执行函数表达式
    },
    plugins: [
      terser(),
      copy({
        targets: [
          { src: 'lib/ScriptRetryPlugin.js', dest: 'dist' }
        ]
      })
    ],
  },
  // {
  //   input: 'lib/scriptRetryApendChild.js',
  //   output: {
  //     file: 'dist/scriptRetryApendChild.js',
  //     format: 'iife',
  //   },
  //   plugins: [
  //     terser(),
  //     copy({
  //       targets: [
  //         { src: 'lib/ScriptRetryPlugin.js', dest: 'dist' }
  //       ]
  //     })
  //   ], // 使用 Terser 插件进行压缩
  // }
];

