var originalAppendChild = HTMLElement.prototype.appendChild;
HTMLElement.prototype.appendChild = function(newChild) {
  try {
    if (newChild.nodeName.toLowerCase() === 'script') {
      // 标记下script是通过appendChild添加到页面上的
      newChild.__is_appendChild__ = true;
      var map = __async_chunk_retry_map___ || {};
      if (!map[newChild.src]) {
        var onload = newChild.onload
        var onerror = newChild.onerror
        map[newChild.src] = {
          'onload': onload,
          'onerror': onerror
        }
      }
      if (map[newChild.src] && map[newChild.src].onload) {
        newChild.onload = function () {
          map[newChild.src].onload();
        }
      }
      if (!newChild.__isRetry__) { // 第一次加载
        newChild.onerror = function () { console.log(newChild.src + ' 第一次加载失败') };
      } else {
        if (+newChild.__leftTimes__ === 1) {
          newChild.onerror = function () {
            console.log('最后一次重试');
            map[newChild.src] && map[newChild.src].onerror && map[newChild.src].onerror();
          }
        }
      }
    }

    return originalAppendChild.call(this, newChild);
  } catch (err) {
    return originalAppendChild.call(this, newChild);
  }
};