var inBrowser = typeof window !== 'undefined';
if (inBrowser) {
  var originalAppendChild = HTMLElement.prototype.appendChild;
  HTMLElement.prototype.appendChild = function(newChild) {
    try {
      if (newChild.nodeName.toLowerCase() === 'script') {
        // 标记下script是通过appendChild添加到页面上的
        newChild.__is_appendChild__ = true;
        var map = __async_chunk_retry_map___ || {};
        var src = removeQueryParamsAndHashFromScriptSrc(newChild.src)
        if (!map[src]) {
          var onload = newChild.onload
          var onerror = newChild.onerror
          map[src] = {
            'onload': onload,
            'onerror': onerror
          }
        }
        if (map[src] && map[src].onload) {
          newChild.onload = function () {
            map[src].onload();
          }
        }
        if (!newChild.__isRetry__) { // 第一次加载
          newChild.onerror = function () { console.log(src + ' 第一次加载失败') };
        } else {
          if (+newChild.__leftTimes__ === 1) {
            newChild.onerror = function () {
              console.log('最后一次重试');
              map[src] && map[src].onerror && map[src].onerror();
            }
          }
        }
      }
  
      return originalAppendChild.call(this, newChild);
    } catch (err) {
      return originalAppendChild.call(this, newChild);
    }
  };
}

var map = {};
function register() {
  if (!inBrowser) return;
  window.addEventListener('error', scriptLoadFailedHandler, true);
}
register();

function scriptLoadFailedHandler(event) {
  if (!isScriptLoadFailError(event)) return;

  var target = event.target;
  var attrs = target.attributes;
  var _target$src = target.src,
    src = _target$src === void 0 ? '' : _target$src;

  var retry = retryOptions.retry;
  var leftRetryTimes = getRetryTimes(src, retry);
  if (+leftRetryTimes >= 1) {
    // https://developer.mozilla.org/zh-CN/docs/Web/API/Event/stopImmediatePropagation
    // 阻止其他事件监听器被调用，包括捕获阶段的和冒泡阶段，和target上的onerror事件也会被阻断
    event.stopImmediatePropagation && event.stopImmediatePropagation();
  }
  if (leftRetryTimes <= 0) return;

  /**
   * 是注入到页面上的chunk
   * 或者是在html上的js并且在白名单内
   * 并且不是通过appendChild进来的script
   * 就通过document.write的方式重试
  */
  if (target.__is_appendChild__) { // 重写了appendChild方法，通过appendChild添加的script标签都会带__is_appendChild__标记
    var script = document.createElement('script');
    script.__isRetry__ = true;
    script.__leftTimes__ = leftRetryTimes;
    Array.prototype.slice.call(attrs).forEach(attr => {
      if (attr.name === 'src') {
        var url = addRtryParamToScript(attr.value);
        script.setAttribute('src', url);
        return
      }
      script.setAttribute(attr.name, attr.value);
    })
    setTimeout(() => {
      document.head.appendChild(script);
    }, retryOptions.delayRetry)
    reduceRetryTimes(src);
  } else if ((isBasicChunk(src) || isWhiteList(src) || isMarkToRetry(attrs)) && !isDeferOrAsync(attrs)) { // 不是通过appendChild进来的script
    const str = getScriptStr(attrs);
    document.write(str);
    reduceRetryTimes(src);
  }
}

function isBasicChunk (src) {
  return isExist(__basic_chunks__, src);
}
function isWhiteList (src) {
  return isExist(retryOptions.whileList, src);
}
function isExist (list, src) {
  var l = list || [];
  if (!l.length) return false;

  return hasCondition(l, (item) => {
    return item && src.indexOf(item) > -1;
  })
}

function isMarkToRetry (attrs) {
  return hasCondition(attrs, (attr) => {
    return attr.name === 'data-retry' && attr.value === 'true'
  })
}

/**
 * 针对有defer和async属性的scirpt标签，不做重试逻辑。
 * 因为document.write实在html解析阶段会阻塞html的解析。
 * 但是使用defer的script是在html解析完后才执行的。
 * 这个时候使用document.write会重写整个文档，导致文档空白
*/
function isDeferOrAsync (attrs) {
  return hasCondition(attrs, (attr) => {
    return attr.name === 'async' || attr.name === 'defer'
  })
}
function hasCondition (collection, filterFn) {
  var tag = false;
  Array.prototype.slice.call(collection).forEach(item => {
    if (filterFn(item)) {
      tag = true;
    }
  })
  return tag;
}

function getScriptStr (attrs) {
  let str = "<script";
  Array.prototype.slice.call(attrs).forEach(attr => {
    str += " ";
    if (attr.value !== '') {
      var val = attr.value
      if (attr.name === 'src') {
        val = addRtryParamToScript(attr.value)
      }
      str += attr.name + '=' + "\"" + val + "\"";
    } else {
      // 布尔属性没有值 比如disabled、defer、async，只要有这个属性就生效
      str += attr.name;
    }
  })
  str += "></scr" + "ipt>";
  return str;
}

function getRetryTimes(src, retry) {
  src = removeQueryParamsAndHashFromScriptSrc(src);
  if (map[src] === void 0) {
    map[src] = retry;
  }
  return map[src];
}
function reduceRetryTimes(src) {
  src = removeQueryParamsAndHashFromScriptSrc(src);
  if (map[src] !== void 0) {
    map[src]--;
  }
}

function isScriptLoadFailError (event) {
  var target = event.target;
  if (!target.tagName || (target.tagName && target.tagName.toLowerCase() !== 'script')) return false;

  var src = target.src === void 0 ? '' : target.src
  if (!src) return false
  // 判断是否脚本执行错误
  // https://developer.mozilla.org/zh-CN/docs/Web/API/ErrorEvent
  if (ErrorEvent && ErrorEvent.prototype.isPrototypeOf(event)) return false;
  return true;
}

function removeQueryParamsAndHashFromScriptSrc(src) {
  // 查找查询字符串的起始位置（?）和片段标识符（#）的位置
  var queryStartIndex = src.indexOf('?');
  var hashIndex = src.indexOf('#');

  // 如果既没有查询字符串也没有片段标识符，则直接返回原字符串
  if (queryStartIndex === -1 && hashIndex === -1) {
    return src;
  }

  // 找到最早出现的 ? 或 # 的位置
  const earliestIndex = Math.min(
    queryStartIndex !== -1 ? queryStartIndex : Infinity,
    hashIndex !== -1 ? hashIndex : Infinity
  );

  // 返回去掉查询字符串和片段标识符后的部分
  return src.slice(0, earliestIndex);
}

function addRtryParamToScript(src) {
  // 查找查询字符串的起始位置
  var queryStartIndex = src.indexOf('?');
  var hashIndex = src.indexOf('#');

  // 如果有 # 符号且在 ? 之前，则只考虑 # 之前的部分
  if (hashIndex !== -1 && (queryStartIndex === -1 || hashIndex < queryStartIndex)) {
    queryStartIndex = -1; // 忽略 # 后面的内容
  }

  // 添加或更新 rtry 参数
  if (queryStartIndex !== -1) {
    // 已经有查询参数，检查是否已经存在 rtry 参数
    var existingParams = src.substring(queryStartIndex + 1, hashIndex !== -1 ? hashIndex : undefined);
    var paramsArray = existingParams.split('&');
    
    var paramExists = false;
    for (var i = 0; i < paramsArray.length; i++) {
      var d = paramsArray[i];
      if (d.indexOf('rtry=') > -1) {
        paramExists = true;
        break;
      }
    }
    
    if (paramExists) {
      // 替换已有的 rtry 参数值
      return src.replace(/rtry=[^&]*/, 'rtry=true');
    } else {
      // 在已有查询参数后添加 rtry 参数
      var hashPart = hashIndex !== -1 ? src.substring(hashIndex) : '';
      return `${src.split('?')[0]}?${existingParams}&rtry=true${hashPart}`;
    }
  } else {
    // 没有查询参数，直接添加 rtry 参数
    var hashPart = hashIndex !== -1 ? src.substring(hashIndex) : '';
    return `${src.split('#')[0]}?rtry=true${hashPart}`;
  }
}

// function removeQueryParamsFromUrl(url) {
//   try {
//     // 创建一个新的 URL 对象
//     var urlObj = new URL(url);
//     // 清空搜索参数（即查询字符串）
//     urlObj.search = '';
//     // 返回新的 URL 字符串，不包含查询参数
//     return urlObj.toString();
//   } catch (error) {
//     // 如果提供的 URL 格式不正确，则抛出错误或返回原始 URL
//     console.error('Invalid URL:', error);
//     return url;
//   }
// }
// function addRetryParam (url) {
//   return addUrlParam(url, (params) => {
//     params.set('rtry', 'true');
//   })
// }
// function addUrlParam(url, addFn) {
//   try {
//     // 创建一个新的 URL 对象
//     var urlObj = new URL(url);
//     // 使用 URLSearchParams 来管理查询参数
//     var params = new URLSearchParams(urlObj.search);
//     // 添加或更新 rtry 参数
//     addFn(params)
//     // 将修改后的查询参数应用回 URL
//     urlObj.search = params.toString();
//     // 返回新的 URL 字符串，包含 rtry 参数
//     return urlObj.toString();
//   } catch (error) {
//     // 如果提供的 URL 格式不正确，则抛出错误或返回原始 URL
//     console.error('Invalid URL:', error);
//     return url;
//   }
// }

