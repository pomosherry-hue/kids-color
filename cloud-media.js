// 视频和封面优先从腾讯云存储加载；打不开或约 6 秒还没出来时，改用本页同目录的备份。
// 第 32 课的 lesson-32-en.mp4 / lesson-32-dual.mp4 云上没有，仍用本站文件。
(function (w) {
  var MEDIA_BASE = 'https://cloud1-d2guejnqud92f5860.storage.tcloudbase.com/';
  var STALL_MS = 6000;

  function fileName(url) {
    return String(url || '').split('?')[0].split('#')[0].split('/').pop();
  }

  function cloudFor(local) {
    var name = fileName(local);
    var m = name.match(/^lesson-(\d{2})\.(mp4|jpg)$/i);
    if (!m) return '';
    var n = m[1];
    var ext = m[2].toLowerCase();
    if (ext === 'mp4') return MEDIA_BASE + 'series/wanzhuan-secai/' + n + '/lesson-' + n + '.mp4';
    return MEDIA_BASE + 'series/wanzhuan-secai/' + n + '/cover.jpg';
  }

  function setPoster(video, cloud, local) {
    if (!video || !cloud) return;
    video.setAttribute('poster', cloud);
    if (!local || local === cloud) return;
    var im = new Image();
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      video.setAttribute('poster', local);
    }, STALL_MS);
    im.onload = function () {
      done = true;
      clearTimeout(timer);
    };
    im.onerror = function () {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.setAttribute('poster', local);
    };
    im.src = cloud;
  }

  function ensureNotice(video) {
    var el = document.getElementById('cloud-fb-note');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'cloud-fb-note';
    el.hidden = true;
    el.style.cssText = 'max-width:480px;margin:8px auto 0;padding:0 16px;font-size:13px;color:#cbbba8;text-align:center;';
    if (video && video.parentNode) video.parentNode.insertBefore(el, video.nextSibling);
    else document.body.appendChild(el);
    return el;
  }

  function showNotice(video, text) {
    var el = ensureNotice(video);
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = text;
  }

  function currentUrl(video) {
    return (video && (video.currentSrc || video.getAttribute('src') || '')) || '';
  }

  function setSrc(video, url) {
    var source = video.querySelector('source');
    if (source) source.src = url;
    video.src = url;
  }

  function attachVideo(video, localSrc) {
    if (!video) return;
    var source = video.querySelector('source');
    var local = localSrc || video.getAttribute('data-local-src') || video.getAttribute('src') || (source && source.getAttribute('data-local-src')) || (source && source.getAttribute('src')) || '';
    local = fileName(local) ? (fileName(local).match(/^lesson-/i) ? fileName(local) : local) : local;
    // Prefer a bare lesson-NN.mp4 as the local backup path
    var localFile = fileName(local) || local;
    var cloud = cloudFor(localFile);
    var posterLocal = video.getAttribute('data-local-poster') || video.getAttribute('poster') || '';
    var posterFile = fileName(posterLocal);
    if (posterFile && cloudFor(posterFile)) {
      if (!video.getAttribute('data-local-poster')) video.setAttribute('data-local-poster', posterFile);
      setPoster(video, cloudFor(posterFile), posterFile);
    }

    var state = video._kidsCloud;
    if (!state) {
      state = video._kidsCloud = { bound: false, stallTimer: null };
      video.addEventListener('error', function () { state.fallback(); });
      video.addEventListener('waiting', function () { state.armStall(); });
      video.addEventListener('stalled', function () { state.armStall(); });
      video.addEventListener('canplay', function () { state.clearStall(); });
      video.addEventListener('playing', function () {
        state.clearStall();
        showNotice(video, '');
      });
      state.bound = true;
    }

    state.clearStall = function () {
      if (state.stallTimer) {
        clearTimeout(state.stallTimer);
        state.stallTimer = null;
      }
    };

    state.armStall = function () {
      state.clearStall();
      if (!state.usingCloud) return;
      state.stallTimer = setTimeout(function () {
        state.stallTimer = null;
        if (video.readyState >= 2) return;
        state.fallback();
      }, STALL_MS);
    };

    state.fallback = function () {
      if (!state.usingCloud || !state.local) return;
      state.usingCloud = false;
      state.clearStall();
      showNotice(video, '正在试试本站备份…');
      var t = video.currentTime || 0;
      setSrc(video, state.local);
      video.load();
      var onMeta = function () {
        video.removeEventListener('loadedmetadata', onMeta);
        if (t) {
          try { video.currentTime = t; } catch (e) {}
        }
        video.play().catch(function () {});
      };
      video.addEventListener('loadedmetadata', onMeta);
    };

    state.local = localFile;
    video.setAttribute('data-local-src', localFile);
    if (cloud) {
      state.usingCloud = true;
      setSrc(video, cloud);
      state.armStall();
    } else {
      state.usingCloud = false;
      setSrc(video, localFile);
    }
  }

  function boot() {
    var list = document.querySelectorAll('video');
    for (var i = 0; i < list.length; i++) attachVideo(list[i]);
  }

  w.kidsCloudSrc = function (local) {
    return cloudFor(local) || local;
  };
  w.kidsCloudAttach = attachVideo;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
