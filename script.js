const initialBitmap = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0],
];

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
const valueSelect = document.getElementById('valueSelect');
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
  9: '#ff55dd'
};
let drawing = false;
let tool = 'paint'; 

let bitmap = [];

valueSelect.innerHTML = Object.keys(palette)
  .map(k => `<option value="${k}">${k} — ${palette[k]}</option>`)
  .join('');

valueSelect.value = '1';

paletteWrap.addEventListener('click',e=>{
  const sw = e.target.closest('[data-v]');
  if(!sw) return;
  valueSelect.value = sw.dataset.v;
});


function createEmpty(r,c){
  const arr = new Array(r).fill(0).map(()=>new Array(c).fill(0));
  return arr;
}

function setBitmapFrom(initial){
  const r = initial.length;
  const c = initial[0].length;
  bitmap = initial.map(row=>row.slice());
  rowsInput.value = r;
  colsInput.value = c;
  pxSizeInput.value = Math.floor(Math.max(8, Math.min(28, 256 / Math.max(r,c))));
  updateCanvasSize();
  render();
}

function updateCanvasSize(){
  const r = Number(rowsInput.value);
  const c = Number(colsInput.value);
  const px = Number(pxSizeInput.value);
  canvas.width = c * px;
  canvas.height = r * px;
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';
}

function render(){
  const r = bitmap.length;
  const c = bitmap[0].length;
  const px = Number(pxSizeInput.value);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<r;y++){
    for(let x=0;x<c;x++){
      const v = bitmap[y][x];
  
      // pick color
      const color = palette[v] ?? '#ffffff';
  
      ctx.fillStyle = color;
      ctx.fillRect(x*px, y*px, px, px);
    }
  }
  
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for(let i=0;i<=c;i++){
    ctx.beginPath();ctx.moveTo(i*px+0.5,0);ctx.lineTo(i*px+0.5,canvas.height);ctx.stroke();
  }
  for(let j=0;j<=r;j++){
    ctx.beginPath();ctx.moveTo(0,j*px+0.5);ctx.lineTo(canvas.width,j*px+0.5);ctx.stroke();
  }
}

function posToCell(ev){
  const rect = canvas.getBoundingClientRect();
  const px = Number(pxSizeInput.value);
  const x = Math.floor((ev.clientX - rect.left) / px);
  const y = Math.floor((ev.clientY - rect.top) / px);
  if(x<0||y<0||y>=bitmap.length||x>=bitmap[0].length) return null;
  return {x,y};
}

canvas.addEventListener('mousedown', e=>{
  drawing = true;
  const cell = posToCell(e);
  if(!cell) return;
  if(tool === 'fill'){
    floodFill(cell.y,cell.x, Number(valueSelect.value));
  } else {
    paintAt(cell.y,cell.x, tool==='paint' ? Number(valueSelect.value) : 0);
  }
});
window.addEventListener('mouseup', ()=>{drawing=false});
canvas.addEventListener('mousemove', e=>{
  if(!drawing) return;
  const cell = posToCell(e);
  if(!cell) return;
  if(tool !== 'fill') paintAt(cell.y,cell.x, tool==='paint' ? Number(valueSelect.value) : 0);
});

function paintAt(r,c,val){
  if(bitmap[r][c] === val) return;
  bitmap[r][c] = val;
  render();
}

jsonFileInput.addEventListener('change', async (ev)=>{
  const f = ev.target.files?.[0];
  if(!f) return;

  const txt = await f.text();
  try {
    const obj = JSON.parse(txt);

    if(!obj.bitmap || !Array.isArray(obj.bitmap))
      throw new Error('json missing bitmap array');

    setBitmapFrom(obj.bitmap);

  } catch(err){
    alert('json parse failed: ' + err.message);
  }
});


function floodFill(sr,sc,newVal){
  const rows = bitmap.length, cols = bitmap[0].length;
  const oldVal = bitmap[sr][sc];
  if(oldVal === newVal) return;
  const stack = [[sr,sc]];
  while(stack.length){
    const [y,x] = stack.pop();
    if(y<0||x<0||y>=rows||x>=cols) continue;
    if(bitmap[y][x] !== oldVal) continue;
    bitmap[y][x] = newVal;
    stack.push([y+1,x],[y-1,x],[y,x+1],[y,x-1]);
  }
  render();
}

resizeBtn.addEventListener('click', ()=>{
  const r = Math.max(1, Number(rowsInput.value));
  const c = Math.max(1, Number(colsInput.value));
  const newBmp = createEmpty(r,c);
  for(let y=0;y<Math.min(bitmap.length,r);y++){
    for(let x=0;x<Math.min(bitmap[0].length,c);x++){
      newBmp[y][x] = bitmap[y][x];
    }
  }
  bitmap = newBmp;
  updateCanvasSize();
  render();
});

paintBtn.addEventListener('click', ()=>{tool='paint'; paintBtn.classList.remove('secondary'); eraseBtn.classList.add('secondary');});
eraseBtn.addEventListener('click', ()=>{tool='erase'; eraseBtn.classList.remove('secondary'); paintBtn.classList.add('secondary');});
fillBtn.addEventListener('click', ()=>{tool='fill'});
clearBtn.addEventListener('click', ()=>{bitmap = createEmpty(bitmap.length, bitmap[0].length); render();});
invertBtn.addEventListener('click', ()=>{ for(let y=0;y<bitmap.length;y++) for(let x=0;x<bitmap[0].length;x++) bitmap[y][x]=bitmap[y][x]?0:1; render();});

exportBtn.addEventListener('click', ()=>{
  const name = 'myBitmap';
  const text = '[\n' + bitmap.map(row => '  [' + row.join(',') + ']').join(',\n') + '\n];';
  exportArea.value = text;
});

copyBtn.addEventListener('click', async ()=>{
  try{ await navigator.clipboard.writeText(exportArea.value); copyBtn.textContent='Copied!'; setTimeout(()=>copyBtn.textContent='Copy',900);}catch(e){alert('Clipboard failed')}
});

loadBtn.addEventListener('click', ()=>{
  const txt = loadArea.value.trim();
  if(!txt) return alert('Paste a JS array or variable assignment');
  try{
    const arrMatch = txt.match(/\[\s*(?:\[.*\])*\s*\]/s);
    if(!arrMatch) throw new Error('No array literal found');
    const arrText = arrMatch[0].replace(/([\r\n])/g,'');
    const parsed = JSON.parse(arrText.replace(/'/g,'"').replace(/\b(\d+)\b/g,'$1'));
    if(!Array.isArray(parsed)) throw new Error('Parsed value not an array');
    setBitmapFrom(parsed);
    exportArea.value = '';
  }catch(err){
    alert('Could not parse array: ' + err.message + '\nHint: paste an array like [ [0,1,0], [1,0,1] ] or a variable assignment containing it.');
  }
});

downloadBtn.addEventListener('click', ()=>{
  const data = { bitmap };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'bitmap.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

setBitmapFrom(initialBitmap);
exportArea.value = '';
