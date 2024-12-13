var inBrowser = typeof window !== 'undefined';
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
  if ((isBasicChunk(src) || isWhiteList(src)) && !target.__is_appendChild__) {
    const str = getScriptStr(attrs);
    document.write(str);
    reduceRetryTimes(src);
  } else if (target.__is_appendChild__)  {
    var script = document.createElement('script');
    script.__isRetry__ = true;
    script.__leftTimes__ = leftRetryTimes;
    Array.prototype.slice.call(attrs).forEach(attr => {
      script.setAttribute(attr.name, attr.value);
    })
    setTimeout(() => {
      document.head.appendChild(script);
    }, retryOptions.delayRetry)
    reduceRetryTimes(src);
  }
}

function isBasicChunk (src) {
  return isExist(__basic_chunks__, src)
}
function isWhiteList (src) {
  return isExist(retryOptions.whileList, src)
}
function isExist (list, src) {
  var tag = false;
  var l = list || [];
  if (!l.length) return false;
  for (var i = 0; i < l.length; i++) {
    var chunkName = l[i];
    if (chunkName && src.indexOf(chunkName) > -1) {
      tag = true;
      break;
    }
  }
  return tag

}

function getScriptStr (attrs) {
  let str = "<script";
  Array.prototype.slice.call(attrs).forEach(attr => {
    str += " ";
    if (attr.value !== '') {
      str += attr.name + '=' + "\"" + attr.value + "\"";
    } else {
      // 布尔属性没有值 比如disabled、defer、async，只要有这个属性就生效
      str += attr.name;
    }
  })
  str += "></scr" + "ipt>";
  return str;
}

function getRetryTimes(src, retry) {
  if (map[src] === void 0) {
    map[src] = retry;
  }
  return map[src];
}
function reduceRetryTimes(src) {
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
