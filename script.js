const initialBitmap = Array.from({ length: 19 }, () => Array(19).fill(0));

const canvas = document.getElementById('bitmapCanvas');
const ctx = canvas.getContext('2d');
const rowsInput = document.getElementById('rows');
const colsInput = document.getElementById('cols');
const pxSizeInput = document.getElementById('pxSize');
const resizeBtn = document.getElementById('resizeBtn');
const exportBtn = document.getElementById('exportBtn');
const exportArea = document.getElementById('exportArea');
const loadArea = document.getElementById('loadArea');
const loadBtn = document.getElementById('loadBtn');
const copyBtn = document.getElementById('copyBtn');
const paintBtn = document.getElementById('paintBtn');
const eraseBtn = document.getElementById('eraseBtn');
const fillBtn = document.getElementById('fillBtn');
const invertBtn = document.getElementById('invertBtn');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');
const jsonFileInput = document.getElementById('jsonFile');
const paletteWrap = document.getElementById('paletteEditor');
const selectBtn = document.getElementById('selectBtn');
const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');

const palette = {
  0: '#ffffff',
  1: '#000000',
  2: '#ff4444',
  3: '#ff8800',
  4: '#ffee33',
  5: '#44ff44',
  6: '#44ddff',
  7: '#4488ff',
  8: '#9955ff',
  9: '#ff55dd',
  10: '#964B00'
};

let drawing = false;
let tool = 'paint';
let bitmap = [];
let activeValue = 1;

// --- Selection state ---
let selection = null;   // {x, y, w, h}
let floating = null;    // pixels being dragged (2D array)
let dragMode = null;    // 'select' | 'move' | null
let moveStart = null, moveOrigin = null;
let selAnchor = null;

// --- Undo / redo ---
const undoStack = [], redoStack = [];
const MAX_HISTORY = 100;
let strokeSaved = false;

function snapshot() { return bitmap.map(r => r.slice()); }
function updateHistoryButtons() {
  undoBtn.disabled = !undoStack.length;
  redoBtn.disabled = !redoStack.length;
}
function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
  updateHistoryButtons();
}
function beginChange() {            // one history entry per stroke
  if (!strokeSaved) { pushHistory(); strokeSaved = true; }
}
function restore(snap) {
  bitmap = snap.map(r => r.slice());
  selection = null; floating = null;
  rowsInput.value = bitmap.length;
  colsInput.value = bitmap[0].length;
  updateCanvasSize();
  render();
  updateHistoryButtons();
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
}

// --- Render color palette ---
function renderPalette() {
  paletteWrap.innerHTML = Object.entries(palette)
    .map(([k, color]) => `
      <div class="swatch" data-v="${k}" title="${k}"
           style="width:22px;height:22px;border-radius:4px;
                  background:${color};
                  cursor:pointer;
                  border:${k == activeValue ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.15)'}">
      </div>
    `)
    .join('');
}

paletteWrap.addEventListener('click', e => {
  const sw = e.target.closest('[data-v]');
  if (!sw) return;
  activeValue = Number(sw.dataset.v);
  renderPalette();
});

function createEmpty(r, c) {
  return Array.from({ length: r }, () => Array(c).fill(0));
}

function setBitmapFrom(initial) {
  const r = initial.length;
  const c = initial[0].length;
  if (bitmap.length) pushHistory();
  selection = null;
  bitmap = initial.map(row => row.slice());
  rowsInput.value = r;
  colsInput.value = c;
  pxSizeInput.value = Math.floor(Math.max(8, Math.min(28, 256 / Math.max(r, c))));
  updateCanvasSize();
  render();
}

function updateCanvasSize() {
  const r = bitmap.length || Number(rowsInput.value);
  const c = bitmap.length ? bitmap[0].length : Number(colsInput.value);
  const px = Number(pxSizeInput.value);
  canvas.width = c * px;
  canvas.height = r * px;
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';
  updateStatus();
}

function render() {
  drawBase();
  drawOverlay();
}

function drawOverlay() {
  const px = Number(pxSizeInput.value);
  if (floating && selection) {
    for (let j = 0; j < floating.length; j++) {
      for (let i = 0; i < floating[0].length; i++) {
        ctx.fillStyle = palette[floating[j][i]] ?? '#ffffff';
        ctx.fillRect((selection.x + i) * px, (selection.y + j) * px, px, px);
      }
    }
  }
  if (selection) {
    const x = selection.x * px + 1, y = selection.y * px + 1;
    const w = selection.w * px - 2, h = selection.h * px - 2;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = '#000'; ctx.strokeRect(x, y, w, h);
    ctx.lineDashOffset = 5;
    ctx.strokeStyle = '#fff'; ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
}

function drawBase() {
  const r = bitmap.length;
  const c = bitmap[0].length;
  const px = Number(pxSizeInput.value);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < r; y++) {
    for (let x = 0; x < c; x++) {
      const v = bitmap[y][x];
      const color = palette[v] ?? '#ffffff';
      ctx.fillStyle = color;
      ctx.fillRect(x * px, y * px, px, px);
    }
  }

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; 
  ctx.beginPath();
  for (let i = 0; i <= c; i++) {
    const x = i * px + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (let j = 0; j <= r; j++) {
    const y = j * px + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();
}


function posToCell(ev) {
  const rect = canvas.getBoundingClientRect();
  const px = Number(pxSizeInput.value);
  const x = Math.floor((ev.clientX - rect.left) / px);
  const y = Math.floor((ev.clientY - rect.top) / px);
  if (x < 0 || y < 0 || y >= bitmap.length || x >= bitmap[0].length) return null;
  return { x, y };
}

function cellClamped(ev) {
  const rect = canvas.getBoundingClientRect();
  const px = Number(pxSizeInput.value);
  const x = Math.floor((ev.clientX - rect.left) / px);
  const y = Math.floor((ev.clientY - rect.top) / px);
  return {
    x: Math.max(0, Math.min(bitmap[0].length - 1, x)),
    y: Math.max(0, Math.min(bitmap.length - 1, y))
  };
}

function inSelection(c) {
  return selection && c.x >= selection.x && c.x < selection.x + selection.w &&
         c.y >= selection.y && c.y < selection.y + selection.h;
}

function liftSelection() {
  floating = [];
  for (let j = 0; j < selection.h; j++) {
    floating.push(bitmap[selection.y + j].slice(selection.x, selection.x + selection.w));
    for (let i = 0; i < selection.w; i++) bitmap[selection.y + j][selection.x + i] = 0;
  }
}

function dropFloating() {
  for (let j = 0; j < floating.length; j++) {
    for (let i = 0; i < floating[0].length; i++) {
      bitmap[selection.y + j][selection.x + i] = floating[j][i];
    }
  }
  floating = null;
}

canvas.addEventListener('mousedown', e => {
  drawing = true;
  strokeSaved = false;
  if (tool === 'select') {
    const c = cellClamped(e);
    if (inSelection(c)) {
      dragMode = 'move';
      moveStart = c;
      moveOrigin = { x: selection.x, y: selection.y };
    } else {
      dragMode = 'select';
      selAnchor = c;
      selection = { x: c.x, y: c.y, w: 1, h: 1 };
    }
    render();
    return;
  }
  const cell = posToCell(e);
  if (!cell) return;
  if (tool === 'fill') {
    floodFill(cell.y, cell.x, activeValue);
  } else {
    paintAt(cell.y, cell.x, tool === 'paint' ? activeValue : 0);
  }
});

canvas.addEventListener('mousemove', e => {
  if (!drawing) return;
  if (tool === 'select') {
    const c = cellClamped(e);
    if (dragMode === 'select') {
      const x0 = Math.min(selAnchor.x, c.x), y0 = Math.min(selAnchor.y, c.y);
      selection = { x: x0, y: y0, w: Math.abs(c.x - selAnchor.x) + 1, h: Math.abs(c.y - selAnchor.y) + 1 };
    } else if (dragMode === 'move') {
      const dx = c.x - moveStart.x, dy = c.y - moveStart.y;
      if (!floating) {
        if (!dx && !dy) return;
        pushHistory();
        liftSelection();
      }
      selection.x = Math.max(0, Math.min(bitmap[0].length - selection.w, moveOrigin.x + dx));
      selection.y = Math.max(0, Math.min(bitmap.length - selection.h, moveOrigin.y + dy));
    }
    render();
    return;
  }
  const cell = posToCell(e);
  if (!cell) return;
  paintAt(cell.y, cell.x, tool === 'paint' ? activeValue : 0);
});

window.addEventListener('mouseup', () => {
  if (floating) dropFloating();
  drawing = false;
  dragMode = null;
  render();
});

function paintAt(r, c, val) {
  if (bitmap[r][c] === val) return;
  beginChange();
  bitmap[r][c] = val;
  render();
}

jsonFileInput.addEventListener('change', async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    const bitmapData = Array.isArray(data)
      ? data
      : Array.isArray(data.bitmap)
        ? data.bitmap
        : null;

    if (!bitmapData) {
      throw new Error('Invalid JSON: must be an array or object with a "bitmap" array');
    }

    setBitmapFrom(bitmapData);
    render();
    exportArea.value = '';
  } catch (err) {
    alert(`❌ Failed to load bitmap: ${err.message}`);
  }
});


function floodFill(sr, sc, newVal) {
  const rows = bitmap.length, cols = bitmap[0].length;
  const oldVal = bitmap[sr][sc];
  if (oldVal === newVal) return;
  beginChange();
  const stack = [[sr, sc]];
  while (stack.length) {
    const [y, x] = stack.pop();
    if (y < 0 || x < 0 || y >= rows || x >= cols) continue;
    if (bitmap[y][x] !== oldVal) continue;
    bitmap[y][x] = newVal;
    stack.push([y + 1, x], [y - 1, x], [y, x + 1], [y, x - 1]);
  }
  render();
}

resizeBtn.addEventListener('click', () => {
  pushHistory();
  selection = null;
  const r = Math.max(1, Number(rowsInput.value));
  const c = Math.max(1, Number(colsInput.value));
  const newBmp = createEmpty(r, c);
  for (let y = 0; y < Math.min(bitmap.length, r); y++) {
    for (let x = 0; x < Math.min(bitmap[0].length, c); x++) {
      newBmp[y][x] = bitmap[y][x];
    }
  }
  bitmap = newBmp;
  updateCanvasSize();
  render();
});

function setTool(selected) {
  tool = selected;
  updateStatus();
  if (selected !== 'select') { selection = null; render(); }
  [paintBtn, eraseBtn, fillBtn, selectBtn].forEach(btn => btn.classList.add('secondary'));
  if (selected === 'paint') paintBtn.classList.remove('secondary');
  if (selected === 'erase') eraseBtn.classList.remove('secondary');
  if (selected === 'fill') fillBtn.classList.remove('secondary');
  if (selected === 'select') selectBtn.classList.remove('secondary');
}

paintBtn.addEventListener('click', () => setTool('paint'));
eraseBtn.addEventListener('click', () => setTool('erase'));
fillBtn.addEventListener('click', () => setTool('fill'));

clearBtn.addEventListener('click', () => {
  pushHistory();
  selection = null;
  bitmap = createEmpty(bitmap.length, bitmap[0].length);
  render();
});

invertBtn.addEventListener('click', () => {
  pushHistory();
  function hexToRgb(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
    const num = parseInt(c, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function invertHexColor(hex) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
    const num = parseInt(c, 16);
    const inverted = (0xFFFFFF ^ num).toString(16).padStart(6, '0');
    return '#' + inverted;
  }

  const paletteRGB = Object.entries(palette).map(([k, color]) => ({
    index: Number(k),
    color,
    rgb: hexToRgb(color)
  }));

  function findClosestPaletteColor(hex) {
    const invRgb = hexToRgb(hex);
    let bestIndex = 0;
    let bestDist = Infinity;
    for (const p of paletteRGB) {
      const dr = invRgb.r - p.rgb.r;
      const dg = invRgb.g - p.rgb.g;
      const db = invRgb.b - p.rgb.b;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = p.index;
      }
    }
    return bestIndex;
  }

  for (let y = 0; y < bitmap.length; y++) {
    for (let x = 0; x < bitmap[0].length; x++) {
      const originalColor = palette[bitmap[y][x]] ?? '#ffffff';
      const invertedHex = invertHexColor(originalColor);
      const closestIndex = findClosestPaletteColor(invertedHex);
      bitmap[y][x] = closestIndex;
    }
  }

  render();
});



exportBtn.addEventListener('click', () => {
  const text = '[\n' + bitmap.map(row => '  [' + row.join(',') + ']').join(',\n') + '\n];';
  exportArea.value = text;
});

copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(exportArea.value);
    copyBtn.querySelector('.lbl').textContent = 'Copied!';
    setTimeout(() => copyBtn.querySelector('.lbl').textContent = 'Copy', 900);
  } catch (e) {
    alert('Clipboard failed');
  }
});

loadBtn.addEventListener('click', () => {
  const txt = loadArea.value.trim();
  if (!txt) return alert('Paste a JS array or variable assignment');
  try {
    const arrMatch = txt.match(/\[\s*(?:\[.*\])*\s*\]/s);
    if (!arrMatch) throw new Error('No array literal found');
    const arrText = arrMatch[0].replace(/([\r\n])/g, '');
    const parsed = JSON.parse(arrText.replace(/'/g, '"').replace(/\b(\d+)\b/g, '$1'));
    if (!Array.isArray(parsed)) throw new Error('Parsed value not an array');
    setBitmapFrom(parsed);
    exportArea.value = '';
  } catch (err) {
    alert('Could not parse array: ' + err.message +
      '\nHint: paste an array like [ [0,1,0], [1,0,1] ] or a variable assignment containing it.');
  }
});

downloadBtn.addEventListener('click', () => {
  const data = { bitmap };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bitmap.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

setBitmapFrom(initialBitmap);
renderPalette();
exportArea.value = '';

selectBtn.addEventListener('click', () => setTool('select'));
undoBtn.addEventListener('click', undo);
redoBtn.addEventListener('click', redo);

document.addEventListener('keydown', e => {
  if (/^(TEXTAREA|INPUT)$/.test(e.target.tagName)) return;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && k === 'y') { e.preventDefault(); redo(); }
  else if (k === 'escape') { selection = null; render(); }
  else if ((k === 'delete' || k === 'backspace') && selection && !drawing) {
    e.preventDefault();
    pushHistory();
    for (let j = 0; j < selection.h; j++)
      for (let i = 0; i < selection.w; i++) bitmap[selection.y + j][selection.x + i] = 0;
    render();
  }
});

updateHistoryButtons();

// --- Editor chrome: status bar, shortcuts, zoom, open ---
function updateStatus() {
  const t = document.getElementById('statusTool');
  const z = document.getElementById('statusSize');
  if (t) t.textContent = tool[0].toUpperCase() + tool.slice(1);
  if (z && bitmap.length) z.textContent = bitmap[0].length + '×' + bitmap.length;
}
canvas.addEventListener('mousemove', e => {
  const c = cellClamped(e);
  document.getElementById('statusPos').textContent = c.x + ', ' + c.y;
});
canvas.addEventListener('mouseleave', () => {
  document.getElementById('statusPos').textContent = '–';
});
pxSizeInput.addEventListener('change', () => {
  pxSizeInput.value = Math.max(4, Math.min(64, Number(pxSizeInput.value) || 18));
  updateCanvasSize();
  render();
});
document.getElementById('openBtn').addEventListener('click', () => jsonFileInput.click());
document.addEventListener('keydown', e => {
  if (/^(TEXTAREA|INPUT)$/.test(e.target.tagName) || e.ctrlKey || e.metaKey) return;
  const map = { b: 'paint', e: 'erase', g: 'fill', m: 'select' };
  const t = map[e.key.toLowerCase()];
  if (t) setTool(t);
});
updateStatus();
