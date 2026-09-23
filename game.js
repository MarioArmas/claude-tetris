'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#6fa8dc', // J - pale blue
  '#ffb74d', // L - orange
  '#90a4ae', // N - nut (steel grey)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - nut (agujero en el centro)
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600];          // T-spin con 0, 1, 2 o 3 líneas
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000];
const B2B_MULTIPLIER = 1.5;
const CLEAR_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];
const T_TYPE = 3;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const holdSection = document.getElementById('hold-section');
const holdStatus = document.getElementById('hold-status');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const soundToggle = document.getElementById('sound-toggle');
const boardWrap = document.getElementById('board-wrap');
const fxLayer = document.getElementById('fx-layer');
const comboSection = document.getElementById('combo-section');
const comboEl = document.getElementById('combo');
const b2bEl = document.getElementById('b2b-status');

const THEME_KEY = 'tetris-theme';
const SOUND_KEY = 'tetris-sound';

let board, current, next, hold, holdLocked, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
// combo: piezas consecutivas que limpiaron líneas. b2b: la última limpieza fue "difícil" (Tetris o T-spin).
// lastRotate: el último movimiento exitoso de la pieza fue una rotación (requisito del T-spin).
let combo, b2b, lastRotate;
let soundOn = localStorage.getItem(SOUND_KEY) !== 'off';
let audioCtx = null;

function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggle.checked = theme === 'light';
}

function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  applyTheme(theme);
  localStorage.setItem(THEME_KEY, theme);
  draw();
});

soundToggle.checked = soundOn;
soundToggle.addEventListener('change', () => {
  soundOn = soundToggle.checked;
  localStorage.setItem(SOUND_KEY, soundOn ? 'on' : 'off');
});

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function createPiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  return createPiece(Math.floor(Math.random() * 8) + 1);
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastRotate = true;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}

// T-spin (regla de las 3 esquinas): la pieza T se asentó justo después de rotar
// y al menos 3 de las 4 esquinas de su caja 3×3 están ocupadas (o fuera del tablero).
// Se evalúa antes de merge(), con la pieza aún sin fijar.
function isTSpin() {
  if (current.type !== T_TYPE || !lastRotate) return false;
  const corners = [[0, 0], [0, 2], [2, 0], [2, 2]];
  let filled = 0;
  for (const [r, c] of corners) {
    const x = current.x + c, y = current.y + r;
    if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) filled++;
  }
  return filled >= 3;
}

function isBoardEmpty() {
  return board.every(row => row.every(v => v === 0));
}

// Puntuación de una pieza asentada:
// base (líneas o T-spin) × nivel → ×1.5 si es B2B → × multiplicador de combo → + bonus Perfect Clear.
function scoreLock(cleared, tspin) {
  if (!cleared) {
    combo = 0;
    if (tspin) {
      // Un T-spin sin líneas puntúa pero no rompe (ni inicia) la cadena B2B.
      const pts = TSPIN_SCORES[0] * level;
      score += pts;
      showFx(['T-SPIN'], `+${pts.toLocaleString()}`, 'fx-tspin');
      playSound('tspin');
    }
    return;
  }

  combo++;
  const difficult = tspin || cleared === 4;
  const isB2B = difficult && b2b;
  b2b = difficult;

  let base = (tspin ? TSPIN_SCORES[cleared] : LINE_SCORES[cleared]) * level;
  if (isB2B) base = Math.floor(base * B2B_MULTIPLIER);
  let pts = base * combo;

  const perfect = isBoardEmpty();
  if (perfect) pts += PERFECT_CLEAR_SCORES[cleared] * level;

  score += pts;
  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);

  // ---- Efectos ----
  const labels = [];
  if (perfect) labels.push('PERFECT CLEAR!');
  if (tspin) labels.push(`T-SPIN ${CLEAR_NAMES[cleared]}`);
  else if (cleared === 4) labels.push('TETRIS');
  if (isB2B) labels.push('BACK-TO-BACK');
  if (combo >= 2) labels.push(`COMBO x${combo}`);

  const variant = perfect ? 'fx-perfect'
    : tspin ? 'fx-tspin'
    : cleared === 4 ? 'fx-tetris'
    : combo >= 2 ? 'fx-combo'
    : '';

  if (labels.length) showFx(labels, `+${pts.toLocaleString()}`, variant);
  retrigger(boardWrap, perfect ? 'flash-perfect' : 'flash');
  if (perfect || difficult || combo >= 2) {
    const intensity = Math.min(2 + combo + (difficult ? 2 : 0) + (perfect ? 4 : 0), 12);
    boardWrap.style.setProperty('--shake', `${intensity}px`);
    retrigger(boardWrap, 'shake');
  }

  playSound('clear', cleared);
  if (difficult) playSound(isB2B ? 'b2b' : 'special');
  if (perfect) playSound('perfect');
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  if (gy > current.y) lastRotate = false;
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastRotate = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  const tspin = isTSpin();
  merge();
  scoreLock(clearLines(), tspin);
  updateHUD();
  holdLocked = false;
  spawn();
  drawHold();
}

function spawn() {
  current = next;
  next = randomPiece();
  lastRotate = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

// Guarda la pieza actual en reserva (o la intercambia con la reservada).
// Solo se permite una vez por pieza: se desbloquea al asentarse la pieza.
function holdPiece() {
  if (holdLocked) return;
  const heldType = current.type;
  if (hold) {
    current = createPiece(hold.type);
    lastRotate = false;
    if (collide(current.shape, current.x, current.y)) endGame();
  } else {
    spawn();
  }
  hold = createPiece(heldType);
  holdLocked = true;
  dropAccum = 0;
  drawHold();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo >= 2 ? `x${combo}` : '—';
  comboSection.classList.toggle('active', combo >= 2);
  boardWrap.classList.toggle('combo-active', combo >= 2);
  b2bEl.textContent = b2b ? 'B2B' : '';
}

// ---- Efectos visuales ----

// Reinicia una animación CSS aunque la clase ya esté aplicada.
function retrigger(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

function showFx(labels, points, variant) {
  fxLayer.replaceChildren();
  const popup = document.createElement('div');
  popup.className = `fx-popup ${variant}`;
  labels.forEach((text, i) => {
    const span = document.createElement('span');
    span.className = i === 0 ? 'fx-main' : 'fx-sub';
    span.textContent = text;
    popup.appendChild(span);
  });
  const pts = document.createElement('span');
  pts.className = 'fx-points';
  pts.textContent = points;
  popup.appendChild(pts);
  popup.addEventListener('animationend', () => popup.remove());
  fxLayer.appendChild(popup);
}

// ---- Sonido (Web Audio sintetizado, sin archivos externos) ----

// El navegador solo deja arrancar el AudioContext tras un gesto del usuario,
// por eso se crea/reanuda desde el listener de teclado.
function unlockAudio() {
  if (!soundOn) return;
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(freq, start, dur, type = 'square', vol = 0.06) {
  const t = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function playSound(kind, cleared = 1) {
  if (!soundOn || !audioCtx || audioCtx.state !== 'running') return;
  // Cada eslabón del combo sube un semitono (hasta una octava).
  const root = 440 * Math.pow(2, Math.min(Math.max(combo - 1, 0), 12) / 12);
  switch (kind) {
    case 'clear': {
      const steps = [1, 1.25, 1.5, 2];
      for (let i = 0; i < cleared; i++) tone(root * steps[i], i * 0.06, 0.15);
      break;
    }
    case 'tspin':
      tone(330, 0, 0.1, 'triangle', 0.1);
      tone(495, 0.08, 0.2, 'triangle', 0.1);
      break;
    case 'special':
      tone(root / 2, 0.05, 0.4, 'sawtooth', 0.05);
      tone(root * 0.75, 0.05, 0.4, 'triangle', 0.08);
      break;
    case 'b2b':
      tone(root / 2, 0.05, 0.5, 'sawtooth', 0.05);
      tone(root * 1.5, 0.25, 0.3, 'square', 0.05);
      tone(root * 2, 0.35, 0.4, 'square', 0.05);
      break;
    case 'perfect':
      [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.3 + i * 0.07, 0.35, 'triangle', 0.08));
      break;
  }
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawPreview(context, piece, alpha) {
  const NB = 30;
  context.clearRect(0, 0, context.canvas.width, context.canvas.height);
  if (!piece) return;
  const shape = piece.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], NB, alpha);
}

function drawNext() {
  drawPreview(nextCtx, next);
}

function drawHold() {
  drawPreview(holdCtx, hold, holdLocked ? 0.3 : 1);
  holdSection.classList.toggle('locked', holdLocked);
  holdStatus.textContent = holdLocked ? 'BLOQUEADO' : '';
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastRotate = false;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  hold = null;
  holdLocked = false;
  combo = 0;
  b2b = false;
  lastRotate = false;
  fxLayer.replaceChildren();
  boardWrap.classList.remove('flash', 'flash-perfect', 'shake');
  next = randomPiece();
  spawn();
  drawHold();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  unlockAudio();
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastRotate = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastRotate = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

loadTheme();
init();
