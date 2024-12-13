# webpack-plugin-script-load-fail-retry

支持html页面上的js加载失败重试
支持通过appendChild添加的脚本加载失败后的重试（import()--异步加载一般是通过appendChild往页面上添加脚本）
支持配置重试次数