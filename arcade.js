const titleScreen = document.getElementById('title-screen');
const selectScreen = document.getElementById('select-screen');
const startBtn = document.getElementById('startBtn');
const backTitle = document.getElementById('backTitle');

let audioCtx = null;
function beep(freq, dur, type = 'square', vol = 0.07) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = vol;
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.stop(audioCtx.currentTime + dur);
}

function startJingle() {
  const notes = [392, 523, 659, 784];
  notes.forEach((n, i) => setTimeout(() => beep(n, 0.12), i * 90));
}

function showSelect() {
  startJingle();
  titleScreen.classList.add('hidden');
  selectScreen.classList.remove('hidden');
}

function showTitle() {
  beep(330, 0.08);
  selectScreen.classList.add('hidden');
  titleScreen.classList.remove('hidden');
}

startBtn.addEventListener('click', showSelect);
backTitle.addEventListener('click', showTitle);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
    if (!titleScreen.classList.contains('hidden')) {
      e.preventDefault();
      showSelect();
    }
  }
  if (e.key === 'Escape' && !selectScreen.classList.contains('hidden')) {
    showTitle();
  }
});

document.querySelectorAll('.cabinet').forEach((cab) => {
  cab.addEventListener('mouseenter', () => beep(880, 0.04, 'square', 0.04));
  cab.addEventListener('click', () => beep(523, 0.08));
});
