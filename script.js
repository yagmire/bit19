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
  bitmap = initial.map(row => row.slice());
  rowsInput.value = r;
  colsInput.value = c;
  pxSizeInput.value = Math.floor(Math.max(8, Math.min(28, 256 / Math.max(r, c))));
  updateCanvasSize();
  render();
}

function updateCanvasSize() {
  const r = Number(rowsInput.value);
  const c = Number(colsInput.value);
  const px = Number(pxSizeInput.value);
  canvas.width = c * px;
  canvas.height = r * px;
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';
}

function render() {
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

canvas.addEventListener('mousedown', e => {
  drawing = true;
  const cell = posToCell(e);
  if (!cell) return;
  if (tool === 'fill') {
    floodFill(cell.y, cell.x, activeValue);
  } else {
    paintAt(cell.y, cell.x, tool === 'paint' ? activeValue : 0);
  }
});
window.addEventListener('mouseup', () => { drawing = false; });
canvas.addEventListener('mousemove', e => {
  if (!drawing) return;
  const cell = posToCell(e);
  if (!cell) return;
  if (tool !== 'fill') paintAt(cell.y, cell.x, tool === 'paint' ? activeValue : 0);
});

function paintAt(r, c, val) {
  if (bitmap[r][c] === val) return;
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
  [paintBtn, eraseBtn, fillBtn].forEach(btn => btn.classList.add('secondary'));
  if (selected === 'paint') paintBtn.classList.remove('secondary');
  if (selected === 'erase') eraseBtn.classList.remove('secondary');
  if (selected === 'fill') fillBtn.classList.remove('secondary');
}

paintBtn.addEventListener('click', () => setTool('paint'));
eraseBtn.addEventListener('click', () => setTool('erase'));
fillBtn.addEventListener('click', () => setTool('fill'));

clearBtn.addEventListener('click', () => {
  bitmap = createEmpty(bitmap.length, bitmap[0].length);
  render();
});

invertBtn.addEventListener('click', () => {
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
    copyBtn.textContent = 'Copied!';
    setTimeout(() => copyBtn.textContent = 'Copy to clipboard', 900);
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
