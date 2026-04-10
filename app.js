const dropZone   = document.getElementById('dropZone');
const fileInput  = document.getElementById('fileInput');
const panelLeft  = document.getElementById('panelLeft');
const panelRight = document.getElementById('panelRight');
const leftCount  = document.getElementById('leftCount');
const rightCount = document.getElementById('rightCount');
const workspace  = document.getElementById('workspace');
const errorMsg   = document.getElementById('errorMsg');
const hint       = document.getElementById('hint');
const processBtn = document.getElementById('processBtn');

const CARD_COLORS = ['#e8714a','#8b82e8','#5ecb7a','#d4b83a','#e8728a'];

let sourceFiles    = [];
let convertedFiles = [];

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles([...e.dataTransfer.files]);
});
fileInput.addEventListener('change', () => { handleFiles([...fileInput.files]); fileInput.value = ''; });

function handleFiles(files) {
  errorMsg.textContent = '';
  const imgs = files.filter(f => f.type.startsWith('image/') || f.name.toLowerCase().endsWith('.heic'));
  if (!imgs.length) { errorMsg.textContent = '⚠ No image files found.'; return; }
  if (imgs.length < files.length)
    errorMsg.textContent = `ℹ ${files.length - imgs.length} non-image file(s) skipped.`;
  imgs.forEach(addSourceFile);
  workspace.style.display = 'grid';
  hint.style.display = 'none';
}

function addSourceFile(file) {
  const idx = sourceFiles.length;
  sourceFiles.push({
    file, dataUrl: null, cropRect: null, censors: [], previewUrl: null,
    rotation: 0, flipH: false, flipV: false,
    brightness: 0, contrast: 0, saturation: 0, sharpen: 0, grayscale: false, stripExif: true,
    exportFormat: 'image/jpeg', exportQuality: 0.82,
    exportW: null, exportH: null, exportMaxW: null, exportMaxH: null,
    lockAspect: true
  });
  const reader = new FileReader();
  reader.onload = ev => {
    sourceFiles[idx].dataUrl = ev.target.result;
    renderSourceCard(idx);
  };
  reader.readAsDataURL(file);
}

function renderSourceCard(idx) {
  const src = sourceFiles[idx];
  const existing = panelLeft.querySelector(`[data-src-idx="${idx}"]`);
  const color = CARD_COLORS[idx % CARD_COLORS.length];
  const hasEdits = !!(src.cropRect || (src.censors && src.censors.length) ||
    src.rotation || src.flipH || src.flipV || src.brightness || src.contrast || src.saturation || src.sharpen || src.grayscale);

  const card = document.createElement('div');
  card.className = 'img-card';
  card.dataset.srcIdx = idx;
  card.style.background = color;

  const inner = document.createElement('div');
  inner.className = 'img-card-inner';

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'img-card-thumb-wrap';

  const thumb = document.createElement('img');
  thumb.className = 'img-card-thumb';
  thumb.src = src.previewUrl || src.dataUrl || '';
  thumb.alt = src.file.name;
  thumb.style.cursor = 'pointer';
  thumb.addEventListener('click', () => openEditModal(idx, 'transform'));
  thumb.addEventListener('touchend', e => { e.preventDefault(); openEditModal(idx, 'transform'); });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'card-remove';
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', e => {
    e.stopPropagation();
    sourceFiles.splice(idx, 1);
    panelLeft.innerHTML = '';
    sourceFiles.forEach((_, i) => renderSourceCard(i));
    leftCount.textContent = sourceFiles.length;
    if (!sourceFiles.length) {
      workspace.style.display = 'none';
      hint.style.display = '';
    }
  });

  thumbWrap.append(thumb, removeBtn);

  const info = document.createElement('div');
  info.className = 'img-card-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'img-card-name';
  nameEl.title = src.file.name;
  nameEl.textContent = src.file.name;

  const meta = document.createElement('div');
  meta.className = 'img-card-meta';
  const szSpan = document.createElement('span');
  szSpan.textContent = formatBytes(src.file.size);
  const fmtSpan = document.createElement('span');
  fmtSpan.textContent = src.exportFormat === 'image/jpeg' ? 'JPG' : src.exportFormat === 'image/png' ? 'PNG' : 'WebP';
  meta.append(szSpan, fmtSpan);

  const actions = document.createElement('div');
  actions.className = 'img-card-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'edit-badge' + (hasEdits ? ' active' : '');
  editBtn.textContent = hasEdits ? 'Edited' : 'Edit';
  editBtn.addEventListener('click', () => openEditModal(idx, 'transform'));
  editBtn.addEventListener('touchend', e => { e.preventDefault(); openEditModal(idx, 'transform'); });

  actions.append(editBtn);
  info.append(nameEl, meta, actions);
  inner.append(thumbWrap, info);
  card.appendChild(inner);

  if (existing) {
    existing.replaceWith(card);
  } else {
    panelLeft.appendChild(card);
  }
  leftCount.textContent = sourceFiles.length;
}

function renderProcessedCard(idx, entry, dw, dh) {
  const { name, blob, url, origSize, srcIdx } = entry;
  const color = CARD_COLORS[srcIdx % CARD_COLORS.length];
  const diff = origSize - blob.size;
  const pct  = origSize > 0 ? Math.abs((diff / origSize) * 100).toFixed(0) : 0;
  const grew = diff < 0;

  const card = document.createElement('div');
  card.className = 'img-card';
  card.style.background = color;
  card.style.animationDelay = (Math.min(idx, 8) * 0.04) + 's';

  const inner = document.createElement('div');
  inner.className = 'img-card-inner';

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'img-card-thumb-wrap';

  const thumb = document.createElement('img');
  thumb.className = 'img-card-thumb';
  thumb.src = url; thumb.alt = name;
  thumb.style.cursor = 'zoom-in';
  thumb.addEventListener('click', () => openLightbox(url, name));

  thumbWrap.appendChild(thumb);

  const info = document.createElement('div');
  info.className = 'img-card-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'img-card-name';
  nameEl.title = name; nameEl.textContent = name;

  const meta = document.createElement('div');
  meta.className = 'img-card-meta';
  const dim  = document.createElement('span'); dim.textContent = `${dw}×${dh}`;
  const sz   = document.createElement('span'); sz.textContent = formatBytes(blob.size);
  const sv   = document.createElement('span');
  sv.className = grew ? 'grew' : 'saved';
  sv.textContent = grew ? `+${pct}% larger` : pct > 0 ? `−${pct}% saved` : 'same size';
  meta.append(dim, sz, sv);

  const actions = document.createElement('div');
  actions.className = 'img-card-actions';
  const dlBtn = document.createElement('button');
  dlBtn.className = 'dl-btn';
  dlBtn.textContent = '↓ Save';
  dlBtn.addEventListener('click', () => triggerDownload(url, name));
  actions.appendChild(dlBtn);

  info.append(nameEl, meta, actions);
  inner.append(thumbWrap, info);
  card.appendChild(inner);
  panelRight.appendChild(card);
}

processBtn.addEventListener('click', () => {
  if (!sourceFiles.length) return;
  convertedFiles.forEach(f => URL.revokeObjectURL(f.url));
  convertedFiles = [];
  panelRight.innerHTML = '';
  rightCount.textContent = '0';
  document.getElementById('downloadAllBtn').style.display = 'none';
  processBtn.disabled = true;
  processBtn.textContent = '⏳ Processing…';
  let pending = sourceFiles.length;
  sourceFiles.forEach((src, i) => {
    processSourceFile(src, i, () => {
      pending--;
      if (pending === 0) {
        processBtn.disabled = false;
        processBtn.textContent = 'PROCESS ALL';
        document.getElementById('downloadAllBtn').style.display = 'inline-block';
      }
    });
  });
});

function processSourceFile(src, i, onDone) {
  const img = new Image();
  img.onload = () => {
    const is90 = ((src.rotation||0) === 90 || (src.rotation||0) === 270);
    const cr = src.cropRect;
    const rw = is90 ? img.naturalHeight : img.naturalWidth;
    const rh = is90 ? img.naturalWidth  : img.naturalHeight;
    let sw = cr ? cr.w : rw;
    let sh = cr ? cr.h : rh;

    // Per-image export settings
    const fmt  = src.exportFormat  || 'image/jpeg';
    const qual = src.exportQuality != null ? src.exportQuality : 0.82;
    const targW = src.exportW  || 0;
    const targH = src.exportH  || 0;
    const maxW  = src.exportMaxW || 0;
    const maxH  = src.exportMaxH || 0;

    let dw = sw, dh = sh;

    // Exact resize takes priority
    if (targW > 0 && targH > 0) {
      dw = targW; dh = targH;
    } else if (targW > 0) {
      dh = Math.round(sh * targW / sw); dw = targW;
    } else if (targH > 0) {
      dw = Math.round(sw * targH / sh); dh = targH;
    }

    // Max constraints applied after
    if (maxW > 0 && dw > maxW) { dh = Math.round(dh * maxW / dw); dw = maxW; }
    if (maxH > 0 && dh > maxH) { dw = Math.round(dw * maxH / dh); dh = maxH; }

    const scaleX = dw / sw;
    const scaleY = dh / sh;

    let canvas = renderToCanvas(src, img, dw, dh, scaleX, scaleY);

    if (fmt === 'image/jpeg') {
      const bg = document.createElement('canvas');
      bg.width = dw; bg.height = dh;
      const bgc = bg.getContext('2d');
      bgc.fillStyle = '#fff';
      bgc.fillRect(0, 0, dw, dh);
      bgc.drawImage(canvas, 0, 0);
      canvas = bg;
    }

    const ext = fmt === 'image/jpeg' ? 'jpg' : fmt === 'image/png' ? 'png' : 'webp';
    const outName = src.file.name.replace(/\.[^.]+$/, '') + '.' + ext;

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const entry = { name: outName, blob, url, origSize: src.file.size, srcIdx: i };
      const eidx = convertedFiles.length;
      convertedFiles.push(entry);
      renderProcessedCard(eidx, entry, dw, dh);
      rightCount.textContent = convertedFiles.length;
      onDone();
    }, fmt, qual);
  };
  img.src = src.dataUrl;
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

function triggerDownload(url, name) {
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

document.getElementById('downloadAllBtn').addEventListener('click', async () => {
  const btn = document.getElementById('downloadAllBtn');
  btn.textContent = 'Zipping…'; btn.disabled = true;
  const zip = new JSZip();
  convertedFiles.forEach(f => zip.file(f.name, f.blob));
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  triggerDownload(url, 'images.zip');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  btn.textContent = 'ZIP all'; btn.disabled = false;
});

document.getElementById('clearBtn').addEventListener('click', () => {
  convertedFiles.forEach(f => URL.revokeObjectURL(f.url));
  convertedFiles = []; sourceFiles = [];
  panelLeft.innerHTML = '';
  panelRight.innerHTML = '<div class="stream-empty" id="rightEmpty"><span>→</span><span>Processed images will appear here</span></div>';
  leftCount.textContent = '0'; rightCount.textContent = '0';
  document.getElementById('downloadAllBtn').style.display = 'none';
  workspace.style.display = 'none';
  hint.style.display = '';
  errorMsg.textContent = '';
  processBtn.textContent = 'PROCESS ALL';
  processBtn.disabled = false;
});

function renderToCanvas(src, img, outW, outH, scaleX, scaleY) {
    const rotation   = src.rotation   || 0;
    const flipH      = src.flipH      || false;
    const flipV      = src.flipV      || false;
    const brightness = src.brightness || 0;
    const contrast   = src.contrast   || 0;
    const saturation = src.saturation || 0;
    const is90 = (rotation === 90 || rotation === 270);

    // Step 1: rotate/flip the full image onto a correctly-sized canvas
    const rw = is90 ? img.naturalHeight : img.naturalWidth;
    const rh = is90 ? img.naturalWidth  : img.naturalHeight;
    const rotCanvas = document.createElement('canvas');
    rotCanvas.width = rw; rotCanvas.height = rh;
    const rc = rotCanvas.getContext('2d');
    rc.save();
    rc.translate(rw/2, rh/2);
    if (flipH) rc.scale(-1,1);
    if (flipV) rc.scale(1,-1);
    rc.rotate((rotation * Math.PI) / 180);
    rc.drawImage(img, -img.naturalWidth/2, -img.naturalHeight/2);
    rc.restore();

    // Step 2: crop from the rotated canvas
    const cr = src.cropRect;
    const sx = cr ? cr.x : 0, sy = cr ? cr.y : 0;
    const sw = cr ? cr.w : rw, sh = cr ? cr.h : rh;

    // Step 3: draw cropped region to output canvas
    const canvas = document.createElement('canvas');
    canvas.width = outW; canvas.height = outH;
    const c = canvas.getContext('2d');
    c.drawImage(rotCanvas, sx, sy, sw, sh, 0, 0, outW, outH);

    // Step 4: adjustments
    const sharpen   = src.sharpen   || 0;
    const grayscale = src.grayscale || false;
    if (brightness || contrast || saturation || sharpen || grayscale) {
      applyAdjustments(c, canvas, brightness, contrast, saturation, sharpen, grayscale);
    }

    // Step 5: censors — coords stored in natural rotated+cropped space, scale to output
    if (src.censors && src.censors.length) {
      const snap = document.createElement('canvas');
      snap.width = outW; snap.height = outH;
      snap.getContext('2d').drawImage(canvas, 0, 0);
      canvas._baseImg = snap;
      src.censors.forEach(cen => {
        if ((cen.strength ?? 5) === 0) return;
        const rx = Math.round((cen.x - sx) * scaleX);
        const ry = Math.round((cen.y - sy) * scaleY);
        const rw2 = Math.round(cen.w * scaleX);
        const rh2 = Math.round(cen.h * scaleY);
        applyCensorRegion(c, canvas, rx, ry, rw2, rh2, cen.type, cen.strength);
      });
    }

    return canvas;
  }

  function buildPreviewUrl(idx, callback) {
    const src = sourceFiles[idx];
    const img = new Image();
    img.onload = () => {
      const is90 = ((src.rotation||0) === 90 || (src.rotation||0) === 270);
      const cr = src.cropRect;
      const rw = is90 ? img.naturalHeight : img.naturalWidth;
      const rh = is90 ? img.naturalWidth  : img.naturalHeight;
      const sw = cr ? cr.w : rw;
      const sh = cr ? cr.h : rh;
      const canvas = renderToCanvas(src, img, sw, sh, 1, 1);
      callback(canvas.toDataURL());
    };
    img.src = src.dataUrl;
  }



  
  const editModal    = document.getElementById('editModal');
  const editCanvas   = document.getElementById('editCanvas');
  const cropBox      = document.getElementById('cropBox');
  const editInfo     = document.getElementById('editInfo');
  const canvasWrap   = document.getElementById('canvasWrap');
  const editCtx      = editCanvas.getContext('2d');

  let editIdx        = null;
  let editScale      = 1;
  let activeTool     = 'transform';

  // ── Edit history (undo/redo) ──
  let editHistory    = [];
  let historyIndex   = -1;

  function captureState() {
    const state = {
      cropRect:      pendingCropRect ? { ...pendingCropRect } : null,
      dataUrl:       editIdx !== null ? sourceFiles[editIdx].dataUrl : null,
      censors:       censorRegions.map(c => ({ ...c })),
      rotation:      pendingRotation,
      flipH:         pendingFlipH,
      flipV:         pendingFlipV,
      brightness:    pendingBrightness,
      contrast:      pendingContrast,
      saturation:    pendingSaturation,
      sharpen:       pendingSharpen,
      grayscale:     pendingGrayscale,
    };
    editHistory = editHistory.slice(0, historyIndex + 1);
    editHistory.push(state);
    historyIndex = editHistory.length - 1;
    updateHistoryBtns();
  }

  function restoreState(state) {
    pendingCropRect   = state.cropRect ? { ...state.cropRect } : null;
    censorRegions     = state.censors.map(c => ({ ...c }));
    pendingRotation   = state.rotation;
    pendingFlipH      = state.flipH;
    pendingFlipV      = state.flipV;
    pendingBrightness = state.brightness;
    pendingContrast   = state.contrast;
    pendingSaturation = state.saturation;
    pendingSharpen    = state.sharpen;
    pendingGrayscale  = state.grayscale;

    document.getElementById('brightnessSlider').value    = pendingBrightness;
    document.getElementById('brightnessVal').textContent = pendingBrightness;
    document.getElementById('contrastSlider').value      = pendingContrast;
    document.getElementById('contrastVal').textContent   = pendingContrast;
    document.getElementById('saturationSlider').value    = pendingSaturation;
    document.getElementById('saturationVal').textContent = pendingSaturation;
    document.getElementById('sharpenSlider').value       = pendingSharpen;
    document.getElementById('sharpenVal').textContent    = pendingSharpen;
    document.getElementById('grayscaleToggle').checked   = pendingGrayscale;

    const applyCanvas = (img) => {
      const is90 = (pendingRotation === 90 || pendingRotation === 270);
      const natW = is90 ? img.naturalHeight : img.naturalWidth;
      const natH = is90 ? img.naturalWidth  : img.naturalHeight;
      editCanvas.width  = Math.round(natW * editScale);
      editCanvas.height = Math.round(natH * editScale);
      editCanvas._srcImg  = img;
      editCanvas._baseImg = img;
      if (pendingCropRect) {
        cropState = {
          x: Math.round(pendingCropRect.x * editScale),
          y: Math.round(pendingCropRect.y * editScale),
          w: Math.round(pendingCropRect.w * editScale),
          h: Math.round(pendingCropRect.h * editScale),
        };
      } else {
        cropState = { x: 0, y: 0, w: editCanvas.width, h: editCanvas.height };
      }
      showCropBox();
      redrawEditCanvas();
    };

    // If dataUrl changed (baked crop being undone), reload source image
    if (state.dataUrl && editIdx !== null && sourceFiles[editIdx].dataUrl !== state.dataUrl) {
      sourceFiles[editIdx].dataUrl = state.dataUrl;
      const img = new Image();
      img.onload = () => applyCanvas(img);
      img.src = state.dataUrl;
    } else {
      applyCanvas(editCanvas._srcImg);
    }
  }

  function updateHistoryBtns() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = historyIndex >= editHistory.length - 1;
  }

  let cropState      = { x: 0, y: 0, w: 0, h: 0 };
  let aspect         = null;
  let dragMode       = null;
  let dragStart      = { x: 0, y: 0 };
  let boxStart       = { x: 0, y: 0, w: 0, h: 0 };

  let pendingRotation    = 0;
  let pendingFlipH       = false;
  let pendingFlipV       = false;
  let pendingBrightness  = 0;
  let pendingContrast    = 0;
  let pendingSaturation  = 0;
  let pendingSharpen     = 0;
  let pendingGrayscale   = false;
  let pendingCropRect    = null;
  let pendingCensors     = [];
  let stripExif          = true;

  let censorType     = 'pixelate';
  let censorStrength = 5;
  let censorRegions  = [];
  let censorDragging = false;
  let censorDragStart   = null;
  let censorDragCurrent = null;

  function openEditModal(idx, startTool) {
    editIdx = idx;
    const src = sourceFiles[idx];

    pendingCropRect   = src.cropRect ? { ...src.cropRect } : null;
    pendingCensors    = src.censors  ? src.censors.map(c => ({ ...c })) : [];
    pendingRotation   = src.rotation   || 0;
    pendingFlipH      = src.flipH      || false;
    pendingFlipV      = src.flipV      || false;
    pendingBrightness = src.brightness || 0;
    pendingContrast   = src.contrast   || 0;
    pendingSaturation = src.saturation || 0;
    pendingSharpen    = src.sharpen    || 0;
    pendingGrayscale  = src.grayscale  || false;
    stripExif         = src.stripExif !== false;

    document.getElementById('brightnessSlider').value = pendingBrightness;
    document.getElementById('brightnessVal').textContent = pendingBrightness;
    document.getElementById('contrastSlider').value = pendingContrast;
    document.getElementById('contrastVal').textContent = pendingContrast;
    document.getElementById('saturationSlider').value = pendingSaturation;
    document.getElementById('saturationVal').textContent = pendingSaturation;
    document.getElementById('sharpenSlider').value = pendingSharpen;
    document.getElementById('sharpenVal').textContent = pendingSharpen;
    document.getElementById('grayscaleToggle').checked = pendingGrayscale;
    document.getElementById('stripExif').checked = stripExif;
    document.getElementById('stripExifLabel').textContent = stripExif ? 'Remove EXIF on export' : 'Keep EXIF on export';

    document.getElementById('censorStrengthSlider').value = 5;
    document.getElementById('censorStrengthVal').textContent = '5';
    censorStrength = 5;
    censorType = 'pixelate';
    document.querySelectorAll('#censorTypeGroup .pill').forEach(b => b.classList.remove('active'));
    document.querySelector('#censorTypeGroup .pill[data-censor="pixelate"]').classList.add('active');
    document.getElementById('censorStrengthGroup').style.display = 'flex';

    setActiveTool(startTool || 'transform');

    const img = new Image();
    img.onload = () => {
      // Modal is 95vw x 95vh.
      const isMobile = window.innerWidth <= 768;
      const maxW = isMobile
        ? window.innerWidth - 20
        : Math.round(window.innerWidth  * 0.95) - 230 - 48;
      const maxH = isMobile
        ? window.innerHeight - 52 - Math.round(window.innerHeight * 0.40) - 112
        : Math.round(window.innerHeight * 0.95) - 46 - 48;
      const s1 = Math.min(maxW / img.naturalWidth,  maxH / img.naturalHeight,  1);
      const s2 = Math.min(maxW / img.naturalHeight, maxH / img.naturalWidth,   1);
      editScale = Math.min(s1, s2);
      editCanvas.width  = Math.round(img.naturalWidth  * editScale);
      editCanvas.height = Math.round(img.naturalHeight * editScale);
      editCanvas._baseImg = img;
      editCanvas._srcImg = img;
      redrawEditCanvas();

      if (pendingCropRect) {
        cropState = {
          x: Math.round(pendingCropRect.x * editScale),
          y: Math.round(pendingCropRect.y * editScale),
          w: Math.round(pendingCropRect.w * editScale),
          h: Math.round(pendingCropRect.h * editScale),
        };
      } else {
        cropState = { x: 0, y: 0, w: editCanvas.width, h: editCanvas.height };
      }

      showCropBox();
      document.querySelectorAll('.aspect-btn[data-aspect]').forEach(b => b.classList.remove('active'));
      document.querySelector('.aspect-btn[data-aspect="free"]').classList.add('active');
      document.getElementById('rotateAspectBtn').style.display = 'none';
      aspect = null;

      censorRegions = pendingCensors.map(c => ({ ...c }));
      editHistory  = [];
      historyIndex = -1;
      captureState();
      editModal.style.display = 'flex';
    };
    img.src = src.dataUrl;
  }

  function setActiveTool(tool) {
    activeTool = tool;

    // Accordion: toggle open/close for clicked section, close others
    document.querySelectorAll('.tool-btn').forEach(btn => {
      const t = btn.dataset.tool;
      const controls = document.getElementById('controls-' + t);
      if (t === tool) {
        btn.classList.add('active');
        if (controls) controls.classList.add('open');
      } else {
        btn.classList.remove('active');
        if (controls) controls.classList.remove('open');
      }
    });

    if (tool === 'export' && editIdx !== null) loadExportPanel(sourceFiles[editIdx]);

    // Canvas cursor/mode
    if (tool === 'transform') {
      editInfo.textContent = 'Drag to select crop area';
      canvasWrap.style.cursor = 'crosshair';
      cropBox.style.display = 'block';
    } else if (tool === 'privacy') {
      editInfo.textContent = 'Drag to censor a region';
      canvasWrap.style.cursor = 'crosshair';
      cropBox.style.display = 'none';
    } else {
      editInfo.textContent = '';
      canvasWrap.style.cursor = 'default';
      cropBox.style.display = 'none';
    }
    redrawEditCanvas();
  }

  function redrawEditCanvas() {
    const img = editCanvas._srcImg;
    if (!img) return;
    editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height);

    editCtx.save();
    const cw = editCanvas.width, ch = editCanvas.height;
    editCtx.translate(cw / 2, ch / 2);
    if (pendingFlipH) editCtx.scale(-1, 1);
    if (pendingFlipV) editCtx.scale(1, -1);
    editCtx.rotate((pendingRotation * Math.PI) / 180);
    // After rotation, draw at the rotated canvas size
    const is90 = (pendingRotation === 90 || pendingRotation === 270);
    const dw = is90 ? ch : cw;
    const dh = is90 ? cw : ch;
    editCtx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    editCtx.restore();

    if (pendingBrightness !== 0 || pendingContrast !== 0 || pendingSaturation !== 0 || pendingSharpen !== 0 || pendingGrayscale) {
      applyAdjustments(editCtx, editCanvas, pendingBrightness, pendingContrast, pendingSaturation, pendingSharpen, pendingGrayscale);
    }

    if (censorRegions.length > 0) {
      const snap = document.createElement('canvas');
      snap.width = editCanvas.width; snap.height = editCanvas.height;
      snap.getContext('2d').drawImage(editCanvas, 0, 0);
      editCanvas._baseImg = snap;
      const cw2 = editCanvas.width, ch2 = editCanvas.height;
      const is90c = (pendingRotation === 90 || pendingRotation === 270);
      // Natural image size at current editScale
      const natW = is90c ? ch2 : cw2;
      const natH = is90c ? cw2 : ch2;
      censorRegions.forEach(r => {
        // r.x/r.y are in natural image coords — transform to canvas coords
        // accounting for rotation and flip
        const nx = r.x * editScale; // position in natural-orientation scaled space
        const ny = r.y * editScale;
        const nw = r.w * editScale;
        const nh = r.h * editScale;
        let cx, cy, cw3, ch3;
        const rot = ((pendingRotation % 360) + 360) % 360;
        if (rot === 0) {
          cx = pendingFlipH ? natW - nx - nw : nx;
          cy = pendingFlipV ? natH - ny - nh : ny;
          cw3 = nw; ch3 = nh;
        } else if (rot === 90) {
          // 90° cw: (x,y,w,h) → (natH-y-h, x, h, w)
          cx = pendingFlipH ? ny : natH - ny - nh;
          cy = pendingFlipV ? natW - nx - nw : nx;
          cw3 = nh; ch3 = nw;
        } else if (rot === 180) {
          cx = pendingFlipH ? nx : natW - nx - nw;
          cy = pendingFlipV ? ny : natH - ny - nh;
          cw3 = nw; ch3 = nh;
        } else { // 270
          // 270° cw: (x,y,w,h) → (y, natW-x-w, h, w)
          cx = pendingFlipH ? natH - ny - nh : ny;
          cy = pendingFlipV ? nx : natW - nx - nw;
          cw3 = nh; ch3 = nw;
        }
        applyCensorRegion(editCtx, editCanvas,
          Math.round(cx), Math.round(cy),
          Math.round(cw3), Math.round(ch3),
          r.type, r.strength);
      });
    }

    if (activeTool === 'privacy' && censorDragging && censorDragStart && censorDragCurrent) {
      const x = Math.min(censorDragStart.x, censorDragCurrent.x);
      const y = Math.min(censorDragStart.y, censorDragCurrent.y);
      const w = Math.abs(censorDragCurrent.x - censorDragStart.x);
      const h = Math.abs(censorDragCurrent.y - censorDragStart.y);
      editCtx.strokeStyle = '#5ecb7a';
      editCtx.lineWidth = 2;
      editCtx.setLineDash([6, 3]);
      editCtx.strokeRect(x, y, w, h);
      editCtx.setLineDash([]);
    }

    // Show crop overlay when a crop is set and we're not on the transform tool
    if (pendingCropRect && activeTool !== 'transform') {
      const ox = Math.round(pendingCropRect.x * editScale);
      const oy = Math.round(pendingCropRect.y * editScale);
      const ow = Math.round(pendingCropRect.w * editScale);
      const oh = Math.round(pendingCropRect.h * editScale);
      editCtx.fillStyle = 'rgba(0,0,0,0.45)';
      editCtx.fillRect(0, 0, editCanvas.width, oy);
      editCtx.fillRect(0, oy + oh, editCanvas.width, editCanvas.height - oy - oh);
      editCtx.fillRect(0, oy, ox, oh);
      editCtx.fillRect(ox + ow, oy, editCanvas.width - ox - ow, oh);
      editCtx.strokeStyle = '#5ecb7a';
      editCtx.lineWidth = 1.5;
      editCtx.setLineDash([4, 3]);
      editCtx.strokeRect(ox, oy, ow, oh);
      editCtx.setLineDash([]);
    }
  }

  function applyCensorRegion(ctx, canvas, rx, ry, rw, rh, type, strength) {
    rx = Math.max(0, rx); ry = Math.max(0, ry);
    rw = Math.min(rw, canvas.width  - rx);
    rh = Math.min(rh, canvas.height - ry);
    if (rw <= 0 || rh <= 0) return;
    const s = (strength ?? 5);

    if (s === 0) {
      const baseImg = canvas._baseImg;
      if (baseImg) ctx.drawImage(baseImg, rx, ry, rw, rh, rx, ry, rw, rh);
      return;
    }

    if (type === 'blackbox') {
      ctx.fillStyle = '#000';
      ctx.fillRect(rx, ry, rw, rh);

    } else if (type === 'pixelate') {
      const maxBlock = Math.max(4, Math.round(Math.min(rw, rh) / 8));
      const blockSize = Math.max(2, Math.round((maxBlock / 10) * s));
      for (let y = ry; y < ry + rh; y += blockSize) {
        for (let x = rx; x < rx + rw; x += blockSize) {
          const bw = Math.min(blockSize, rx + rw - x);
          const bh = Math.min(blockSize, ry + rh - y);
          const pixel = ctx.getImageData(x + Math.floor(bw/2), y + Math.floor(bh/2), 1, 1).data;
          ctx.fillStyle = `rgb(${pixel[0]},${pixel[1]},${pixel[2]})`;
          ctx.fillRect(x, y, bw, bh);
        }
      }

    } else if (type === 'blur') {
      const blurScale = 0.85 - (s - 1) * 0.092;
      const tiny = document.createElement('canvas');
      tiny.width  = Math.max(1, Math.round(rw * blurScale));
      tiny.height = Math.max(1, Math.round(rh * blurScale));
      const tc = tiny.getContext('2d');
      tc.drawImage(canvas, rx, ry, rw, rh, 0, 0, tiny.width, tiny.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'low';
      ctx.drawImage(tiny, 0, 0, tiny.width, tiny.height, rx, ry, rw, rh);
    }
  }

  function applyAdjustments(ctx, canvas, brightness, contrast, saturation, sharpen, grayscale) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const b = brightness / 100;
    const c = (contrast + 100) / 100;
    const s = (saturation + 100) / 100;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] / 255, g = data[i+1] / 255, bl = data[i+2] / 255;
      r += b; g += b; bl += b;
      r = (r - 0.5) * c + 0.5;
      g = (g - 0.5) * c + 0.5;
      bl = (bl - 0.5) * c + 0.5;
      const gray = 0.299 * r + 0.587 * g + 0.114 * bl;
      r = gray + (r - gray) * s;
      g = gray + (g - gray) * s;
      bl = gray + (bl - gray) * s;
      if (grayscale) {
        const lum = Math.round(0.299 * r * 255 + 0.587 * g * 255 + 0.114 * bl * 255);
        data[i] = data[i+1] = data[i+2] = lum;
      } else {
        data[i]   = Math.max(0, Math.min(255, r  * 255));
        data[i+1] = Math.max(0, Math.min(255, g  * 255));
        data[i+2] = Math.max(0, Math.min(255, bl * 255));
      }
    }
    ctx.putImageData(imageData, 0, 0);

    if (sharpen && sharpen > 0) {
      const strength = sharpen / 10;
      const id2 = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const src2 = new Uint8ClampedArray(id2.data);
      const w = canvas.width, h = canvas.height;
      const kernel = [-strength, -strength, -strength,
                      -strength, 1 + 8 * strength, -strength,
                      -strength, -strength, -strength];
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          for (let c = 0; c < 3; c++) {
            let val = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const ki = ((y+ky)*w+(x+kx))*4+c;
                val += src2[ki] * kernel[(ky+1)*3+(kx+1)];
              }
            }
            id2.data[idx+c] = Math.max(0, Math.min(255, val));
          }
        }
      }
      ctx.putImageData(id2, 0, 0);
    }
  }

  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle: clicking open section closes it, clicking closed section opens it
      const t = btn.dataset.tool;
      if (activeTool === t) {
        // close — deactivate, collapse
        btn.classList.remove('active');
        const ctrl = document.getElementById('controls-' + t);
        if (ctrl) ctrl.classList.remove('open');
        activeTool = null;
        editInfo.textContent = '';
        canvasWrap.style.cursor = 'default';
        cropBox.style.display = 'none';
      } else {
        setActiveTool(t);
      }
    });
  });

  document.getElementById('editModalClose').addEventListener('click', closeEditModal);
  document.getElementById('editCancelBtn').addEventListener('click', closeEditModal);

  document.getElementById('undoBtn').addEventListener('click', () => {
    if (historyIndex > 0) {
      historyIndex--;
      restoreState(editHistory[historyIndex]);
      updateHistoryBtns();
    }
  });

  document.getElementById('redoBtn').addEventListener('click', () => {
    if (historyIndex < editHistory.length - 1) {
      historyIndex++;
      restoreState(editHistory[historyIndex]);
      updateHistoryBtns();
    }
  });

  let editOverlayMousedown = false;
  editModal.addEventListener('mousedown', e => { editOverlayMousedown = e.target === editModal; });
  editModal.addEventListener('mouseup',   e => { if (editOverlayMousedown && e.target === editModal) closeEditModal(); editOverlayMousedown = false; });

  function closeEditModal() {
    editModal.style.display = 'none';
    editIdx = null;
    editCanvas._baseImg = null;
    editCanvas._srcImg  = null;
    cropBox.style.display = 'none';
  }

  document.getElementById('editApplyBtn').addEventListener('click', () => {
    if (editIdx === null) return;
    const src = sourceFiles[editIdx];

    src.cropRect   = pendingCropRect   ? { ...pendingCropRect }         : null;
    src.censors    = censorRegions.map(c => ({ ...c }));
    src.rotation   = pendingRotation;
    src.flipH      = pendingFlipH;
    src.flipV      = pendingFlipV;
    src.brightness = pendingBrightness;
    src.contrast   = pendingContrast;
    src.saturation = pendingSaturation;
    src.sharpen    = pendingSharpen;
    src.grayscale  = pendingGrayscale;
    src.stripExif  = stripExif;

    const idxToRender = editIdx;
    closeEditModal();
    // Clear edit history to free memory from stored dataUrls
    editHistory  = [];
    historyIndex = -1;
    buildPreviewUrl(idxToRender, url => {
      sourceFiles[idxToRender].previewUrl = url;
      renderSourceCard(idxToRender);
    });
  });

  document.getElementById('resetCropBtn').addEventListener('click', () => {
    pendingCropRect = null;
    cropState = { x: 0, y: 0, w: editCanvas.width, h: editCanvas.height };
    showCropBox();
    captureState();
  });

  document.getElementById('applyCropBtn').addEventListener('click', () => {
    if (cropState.w < 5 || cropState.h < 5) return;

    // Bake crop into a new dataUrl for the source file
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width  = Math.round(cropState.w);
    croppedCanvas.height = Math.round(cropState.h);
    croppedCanvas.getContext('2d').drawImage(
      editCanvas,
      Math.round(cropState.x), Math.round(cropState.y),
      Math.round(cropState.w), Math.round(cropState.h),
      0, 0, Math.round(cropState.w), Math.round(cropState.h)
    );
    const newDataUrl = croppedCanvas.toDataURL();

    // Update the source file's dataUrl (undo will restore the old one via history)
    if (editIdx !== null) sourceFiles[editIdx].dataUrl = newDataUrl;
    pendingCropRect = null;
    censorRegions = [];

    // Reload canvas from cropped image
    const newImg = new Image();
    newImg.onload = () => {
      const isMobile2 = window.innerWidth <= 768;
      const maxW = isMobile2
        ? window.innerWidth - 20
        : Math.round(window.innerWidth  * 0.95) - 230 - 48;
      const maxH = isMobile2
        ? window.innerHeight - 52 - Math.round(window.innerHeight * 0.40) - 112
        : Math.round(window.innerHeight * 0.95) - 46 - 48;
      const s1 = Math.min(maxW / newImg.naturalWidth,  maxH / newImg.naturalHeight,  1);
      const s2 = Math.min(maxW / newImg.naturalHeight, maxH / newImg.naturalWidth,   1);
      editScale = Math.min(s1, s2);
      editCanvas.width  = Math.round(newImg.naturalWidth  * editScale);
      editCanvas.height = Math.round(newImg.naturalHeight * editScale);
      editCanvas._srcImg  = newImg;
      editCanvas._baseImg = newImg;
      cropState = { x: 0, y: 0, w: editCanvas.width, h: editCanvas.height };
      showCropBox();
      redrawEditCanvas();
      editInfo.textContent = `Cropped to ${newImg.naturalWidth} × ${newImg.naturalHeight} px`;
      captureState(); // snapshot AFTER baking — includes new dataUrl
    };
    newImg.src = newDataUrl;
  });

  const rotateAspectBtn = document.getElementById('rotateAspectBtn');

  document.querySelectorAll('.aspect-btn[data-aspect]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.aspect-btn[data-aspect]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const v = btn.dataset.aspect;
      if (v === 'free') { aspect = null; rotateAspectBtn.style.display = 'none'; return; }
      const [aw, ah] = v.split(':').map(Number);
      aspect = aw / ah;
      rotateAspectBtn.style.display = aw !== ah ? 'inline-block' : 'none';
      if (cropState.w > 0) { cropState.h = Math.round(cropState.w / aspect); clampCropState(); showCropBox(); }
    });
  });

  rotateAspectBtn.addEventListener('click', () => {
    if (!aspect) return;
    aspect = 1 / aspect;
    const cx = cropState.x + cropState.w / 2, cy = cropState.y + cropState.h / 2;
    const newW = Math.round(cropState.h), newH = Math.round(cropState.w);
    cropState = { x: Math.round(cx - newW/2), y: Math.round(cy - newH/2), w: newW, h: newH };
    clampCropState(); showCropBox();
  });

  function applyRotation(deg) {
    pendingRotation = (pendingRotation + deg + 360) % 360;
    const is90 = (pendingRotation === 90 || pendingRotation === 270);
    const srcImg = editCanvas._srcImg;
    const srcW = srcImg.naturalWidth, srcH = srcImg.naturalHeight;
    // Swap canvas dimensions — scale is already pre-computed to fit both orientations
    const natW = is90 ? srcH : srcW;
    const natH = is90 ? srcW : srcH;
    editCanvas.width  = Math.round(natW * editScale);
    editCanvas.height = Math.round(natH * editScale);
    cropState = { x: 0, y: 0, w: editCanvas.width, h: editCanvas.height };
    showCropBox();
    redrawEditCanvas();
  }

  document.getElementById('rotateLeft').addEventListener('click', () => { applyRotation(-90); captureState(); });
  document.getElementById('rotateRight').addEventListener('click', () => { applyRotation(90); captureState(); });
  document.getElementById('flipH').addEventListener('click', () => {
    pendingFlipH = !pendingFlipH; redrawEditCanvas(); captureState();
  });
  document.getElementById('flipV').addEventListener('click', () => {
    pendingFlipV = !pendingFlipV; redrawEditCanvas(); captureState();
  });

  ['brightness','contrast','saturation'].forEach(name => {
    const slider = document.getElementById(name + 'Slider');
    const valEl  = document.getElementById(name + 'Val');
    slider.addEventListener('input', () => {
      const v = parseInt(slider.value);
      valEl.textContent = v;
      if (name === 'brightness') pendingBrightness = v;
      if (name === 'contrast')   pendingContrast   = v;
      if (name === 'saturation') pendingSaturation = v;
      redrawEditCanvas();
    });
    slider.addEventListener('change', () => captureState());
  });

  document.getElementById('sharpenSlider').addEventListener('input', e => {
    pendingSharpen = parseInt(e.target.value);
    document.getElementById('sharpenVal').textContent = pendingSharpen;
    redrawEditCanvas();
  });
  document.getElementById('sharpenSlider').addEventListener('change', () => captureState());

  document.getElementById('grayscaleToggle').addEventListener('change', e => {
    pendingGrayscale = e.target.checked;
    redrawEditCanvas();
    captureState();
  });

  document.getElementById('stripExif').addEventListener('change', e => {
    stripExif = e.target.checked;
    document.getElementById('stripExifLabel').textContent = stripExif ? 'Remove EXIF on export' : 'Keep EXIF on export';
  });

  document.querySelectorAll('#censorTypeGroup .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#censorTypeGroup .pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      censorType = btn.dataset.censor;
      document.getElementById('censorStrengthGroup').style.display = censorType === 'blackbox' ? 'none' : 'flex';
    });
  });

  document.getElementById('censorStrengthSlider').addEventListener('input', e => {
    censorStrength = parseInt(e.target.value);
    document.getElementById('censorStrengthVal').textContent = censorStrength;
  });

  document.getElementById('censorUndoBtn').addEventListener('click', () => {
    censorRegions.pop(); redrawEditCanvas(); captureState();
    editInfo.textContent = censorRegions.length ? censorRegions.length + ' region(s) — drag to add more' : 'Drag to select region to censor';
  });

  document.getElementById('censorClearBtn').addEventListener('click', () => {
    censorRegions = []; redrawEditCanvas(); captureState();
    editInfo.textContent = 'Drag to select region to censor';
  });

  function showCropBox() {
    cropBox.style.display = activeTool === 'transform' ? 'block' : 'none';
    cropBox.style.left   = cropState.x + 'px';
    cropBox.style.top    = cropState.y + 'px';
    cropBox.style.width  = cropState.w + 'px';
    cropBox.style.height = cropState.h + 'px';
    editInfo.textContent = activeTool === 'transform' ? Math.round(cropState.w / editScale) + ' × ' + Math.round(cropState.h / editScale) + ' px' : '';
  }

  function clampCropState() {
    const CW = editCanvas.width, CH = editCanvas.height;
    cropState.w = Math.max(10, Math.min(cropState.w, CW));
    cropState.h = Math.max(10, Math.min(cropState.h, CH));
    if (aspect) {
      if (cropState.w / aspect > CH) cropState.w = Math.round(CH * aspect);
      cropState.h = Math.round(cropState.w / aspect);
      if (cropState.h > CH) { cropState.h = CH; cropState.w = Math.round(CH * aspect); }
      if (cropState.w > CW) { cropState.w = CW; cropState.h = Math.round(CW / aspect); }
    }
    cropState.x = Math.max(0, Math.min(cropState.x, CW - cropState.w));
    cropState.y = Math.max(0, Math.min(cropState.y, CH - cropState.h));
  }

  function getEditPos(e) {
    const r = canvasWrap.getBoundingClientRect();
    const c = e.touches ? e.touches[0] : e;
    return {
      x: Math.max(0, Math.min(c.clientX - r.left, editCanvas.width)),
      y: Math.max(0, Math.min(c.clientY - r.top,  editCanvas.height))
    };
  }

  canvasWrap.addEventListener('mousedown', startEditDrag);
  canvasWrap.addEventListener('touchstart', startEditDrag, { passive: false });

  function startEditDrag(e) {
    e.preventDefault();
    const pos = getEditPos(e);
    const tgt = e.target;

    if (activeTool === 'transform') {
      if (tgt.classList.contains('crop-handle')) { dragMode = tgt.dataset.handle; }
      else if (tgt === cropBox) { dragMode = 'move'; }
      else { dragMode = 'draw'; cropState = { x: pos.x, y: pos.y, w: 0, h: 0 }; cropBox.style.display = 'block'; }
      dragStart = { ...pos }; boxStart = { ...cropState };
      window.addEventListener('mousemove', onEditDrag);
      window.addEventListener('mouseup',   endEditDrag);
      window.addEventListener('touchmove', onEditDrag,  { passive: false });
      window.addEventListener('touchend',  endEditDrag);
    } else if (activeTool === 'privacy') {
      censorDragStart   = { ...pos };
      censorDragCurrent = { ...pos };
      censorDragging    = true;
      window.addEventListener('mousemove', onCensorDrag);
      window.addEventListener('mouseup',   endCensorDrag);
      window.addEventListener('touchmove', onCensorDrag, { passive: false });
      window.addEventListener('touchend',  endCensorDrag);
    }
  }

  function onEditDrag(e) {
    e.preventDefault();
    const pos = getEditPos(e);
    const dx = pos.x - dragStart.x, dy = pos.y - dragStart.y;
    const CW = editCanvas.width, CH = editCanvas.height;

    if (dragMode === 'draw') {
      let x = Math.min(dragStart.x, pos.x), y = Math.min(dragStart.y, pos.y);
      let w = Math.abs(dx), h = Math.abs(dy);
      if (aspect) {
        w = Math.min(w, CW - x); h = w / aspect;
        if (y + h > CH) { h = CH - y; w = h * aspect; }
        if (pos.y < dragStart.y) y = dragStart.y - h;
        y = Math.max(0, y);
      }
      cropState = { x, y, w, h };
    } else if (dragMode === 'move') {
      cropState.x = Math.max(0, Math.min(boxStart.x + dx, CW - boxStart.w));
      cropState.y = Math.max(0, Math.min(boxStart.y + dy, CH - boxStart.h));
      cropState.w = boxStart.w; cropState.h = boxStart.h;
    } else {
      let { x, y, w, h } = boxStart;
      if (dragMode.includes('e')) w = Math.max(10, boxStart.w + dx);
      if (dragMode.includes('s')) h = Math.max(10, boxStart.h + dy);
      if (dragMode.includes('w')) { x = boxStart.x + dx; w = Math.max(10, boxStart.w - dx); }
      if (dragMode.includes('n')) { y = boxStart.y + dy; h = Math.max(10, boxStart.h - dy); }
      if (aspect) {
        if (dragMode.includes('e') || dragMode.includes('w')) h = w / aspect;
        else w = h * aspect;
      }
      cropState = { x, y, w, h };
    }
    clampCropState(); showCropBox();
  }

  function endEditDrag() {
    dragMode = null;
    window.removeEventListener('mousemove', onEditDrag);
    window.removeEventListener('mouseup',   endEditDrag);
    window.removeEventListener('touchmove', onEditDrag);
    window.removeEventListener('touchend',  endEditDrag);
    if (cropState.w < 5 || cropState.h < 5) {
      cropState = { x: 0, y: 0, w: editCanvas.width, h: editCanvas.height };
      showCropBox();
    }
  }

  function onCensorDrag(e) {
    e.preventDefault();
    censorDragCurrent = getEditPos(e);
    redrawEditCanvas();
  }

  function endCensorDrag() {
    window.removeEventListener('mousemove', onCensorDrag);
    window.removeEventListener('mouseup',   endCensorDrag);
    window.removeEventListener('touchmove', onCensorDrag);
    window.removeEventListener('touchend',  endCensorDrag);
    if (censorDragStart && censorDragCurrent) {
      const x = Math.min(censorDragStart.x, censorDragCurrent.x);
      const y = Math.min(censorDragStart.y, censorDragCurrent.y);
      const w = Math.abs(censorDragCurrent.x - censorDragStart.x);
      const h = Math.abs(censorDragCurrent.y - censorDragStart.y);
      if (w > 4 && h > 4) {
        censorRegions.push({
          x: Math.round(x / editScale), y: Math.round(y / editScale),
          w: Math.round(w / editScale), h: Math.round(h / editScale),
          type: censorType, strength: censorStrength
        });
      }
    }
    censorDragging = false; censorDragStart = null; censorDragCurrent = null;
    redrawEditCanvas();
    if (censorRegions.length) captureState();
    editInfo.textContent = censorRegions.length ? censorRegions.length + ' region(s) — drag to add more' : 'Drag to select region to censor';
  }

  
function loadExportPanel(src) {
  const fmtBtns = document.querySelectorAll('#exportFormatGroup .pill');
  fmtBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.fmt === src.exportFormat);
  });
  const qualSlider = document.getElementById('exportQualitySlider');
  const qualVal    = document.getElementById('exportQualityVal');
  const qualGroup  = document.getElementById('exportQualityGroup');
  qualSlider.value = Math.round((src.exportQuality || 0.82) * 100);
  qualVal.textContent = qualSlider.value + '%';
  qualGroup.style.display = src.exportFormat === 'image/png' ? 'none' : 'flex';

  document.getElementById('exportW').value    = src.exportW    || '';
  document.getElementById('exportH').value    = src.exportH    || '';
  document.getElementById('exportMaxW').value = src.exportMaxW || '';
  document.getElementById('exportMaxH').value = src.exportMaxH || '';
  document.getElementById('exportLockAspect').checked = src.lockAspect !== false;
}

document.querySelectorAll('#exportFormatGroup .pill').forEach(btn => {
  btn.addEventListener('click', () => {
    if (editIdx === null) return;
    document.querySelectorAll('#exportFormatGroup .pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sourceFiles[editIdx].exportFormat = btn.dataset.fmt;
    const qualGroup = document.getElementById('exportQualityGroup');
    qualGroup.style.display = btn.dataset.fmt === 'image/png' ? 'none' : 'flex';
  });
});

document.getElementById('exportQualitySlider').addEventListener('input', e => {
  if (editIdx === null) return;
  const v = parseInt(e.target.value);
  document.getElementById('exportQualityVal').textContent = v + '%';
  sourceFiles[editIdx].exportQuality = v / 100;
});

document.getElementById('exportW').addEventListener('input', e => {
  if (editIdx === null) return;
  const src = sourceFiles[editIdx];
  src.exportW = parseInt(e.target.value) || null;
  if (src.lockAspect !== false && src.exportW && src.dataUrl) {
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalHeight / img.naturalWidth;
      src.exportH = Math.round(src.exportW * ratio);
      document.getElementById('exportH').value = src.exportH || '';
    };
    img.src = src.dataUrl;
  }
});

document.getElementById('exportH').addEventListener('input', e => {
  if (editIdx === null) return;
  const src = sourceFiles[editIdx];
  src.exportH = parseInt(e.target.value) || null;
  if (src.lockAspect !== false && src.exportH && src.dataUrl) {
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      src.exportW = Math.round(src.exportH * ratio);
      document.getElementById('exportW').value = src.exportW || '';
    };
    img.src = src.dataUrl;
  }
});

document.getElementById('exportLockAspect').addEventListener('change', e => {
  if (editIdx === null) return;
  sourceFiles[editIdx].lockAspect = e.target.checked;
});

document.getElementById('exportMaxW').addEventListener('input', e => {
  if (editIdx === null) return;
  sourceFiles[editIdx].exportMaxW = parseInt(e.target.value) || null;
});

document.getElementById('exportMaxH').addEventListener('input', e => {
  if (editIdx === null) return;
  sourceFiles[editIdx].exportMaxH = parseInt(e.target.value) || null;
});
const lightbox     = document.getElementById('lightbox');
  const lightboxImg  = document.getElementById('lightboxImg');
  const lightboxName = document.getElementById('lightboxName');

  function openLightbox(url, name) {
    lightboxImg.src = url;
    lightboxName.textContent = name;
    lightbox.classList.add('open');
  }

  lightbox.addEventListener('click', () => lightbox.classList.remove('open'));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      lightbox.classList.remove('open');
      if (editModal.style.display !== 'none') closeEditModal();
    }
  });
