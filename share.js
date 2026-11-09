(function () {
  var btn = document.getElementById('share-btn');
  if (!btn) return;
  var msg = document.getElementById('share-msg');
  btn.addEventListener('click', function () {
    var data = { title: document.title, url: location.href };
    if (navigator.share) {
      navigator.share(data).catch(function () {});
      return;
    }
    var done = function () { if (msg) msg.textContent = '已複製網址，可以貼到 LINE 給親友。'; };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(location.href).then(done, function () {
        if (msg) msg.textContent = '請複製瀏覽器上方的網址分享：' + location.href;
      });
    } else if (msg) {
      msg.textContent = '請複製瀏覽器上方的網址分享：' + location.href;
    }
  });
})();
