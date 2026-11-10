/* 故事播放器：讀取頁面中的 window.STORY，一格一格播放。
   每一格可指定 audio（音檔路徑）；有音檔就播完音檔再換下一格，沒有就照 secs 秒數。 */
(function () {
  var CAST = {
    gulugu: { name: '咕嚕咕', img: 'img/gulugu.jpg' },
    xiajiucai: { name: '下酒菜', img: 'img/xiajiucai.jpg' }
  };
  var story = window.STORY || [];
  var stage = document.getElementById('stage');
  var playBtn = document.getElementById('play');
  var prevBtn = document.getElementById('prev');
  var nextBtn = document.getElementById('next');
  var counter = document.getElementById('counter');
  var i = 0, playing = false, timer = null, audio = new Audio();

  function avatar(who, active) {
    var c = CAST[who];
    var wrap = document.createElement('div');
    wrap.className = 'cat' + (active ? ' talking' : '');
    var img = document.createElement('img');
    img.alt = c.name;
    img.src = c.img;
    img.onerror = function () {
      var ph = document.createElement('div');
      ph.className = 'cat-ph';
      ph.textContent = c.name;
      img.replaceWith(ph);
    };
    var name = document.createElement('div');
    name.className = 'cat-name';
    name.textContent = c.name;
    wrap.appendChild(img);
    wrap.appendChild(name);
    return wrap;
  }

  function render() {
    var s = story[i];
    stage.innerHTML = '';
    var scene = document.createElement('div');
    scene.className = 'scene';
    if (s.big) {
      var big = document.createElement('div');
      big.className = 'big-sign';
      big.textContent = s.big;
      scene.appendChild(big);
    }
    var cats = document.createElement('div');
    cats.className = 'cats';
    (s.show || [s.who]).forEach(function (w) { cats.appendChild(avatar(w, w === s.who)); });
    scene.appendChild(cats);
    var bubble = document.createElement('div');
    bubble.className = 'bubble from-' + s.who;
    bubble.innerHTML = '<b>' + CAST[s.who].name + '：</b>' + s.text;
    scene.appendChild(bubble);
    stage.appendChild(scene);
    counter.textContent = (i + 1) + ' / ' + story.length;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === story.length - 1;
  }

  function stop() {
    playing = false;
    clearTimeout(timer);
    audio.pause();
    playBtn.textContent = '▶ 播放';
  }

  function schedule() {
    clearTimeout(timer);
    if (!playing) return;
    var s = story[i];
    var advance = function () {
      if (i < story.length - 1) { i++; render(); schedule(); }
      else { stop(); }
    };
    if (s.audio) {
      audio.src = s.audio;
      audio.onended = advance;
      audio.play().catch(function () { timer = setTimeout(advance, (s.secs || 5) * 1000); });
    } else {
      timer = setTimeout(advance, (s.secs || 5) * 1000);
    }
  }

  playBtn.addEventListener('click', function () {
    if (playing) { stop(); return; }
    if (i === story.length - 1) { i = 0; render(); }
    playing = true;
    playBtn.textContent = '❚❚ 暫停';
    schedule();
  });
  prevBtn.addEventListener('click', function () { if (i > 0) { audio.pause(); i--; render(); schedule(); } });
  nextBtn.addEventListener('click', function () { if (i < story.length - 1) { audio.pause(); i++; render(); schedule(); } });

  render();
})();
