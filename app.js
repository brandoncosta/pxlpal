let outputFormat = 'image/jpeg';
  let quality      = 0.82;

  
  
  let sourceFiles    = [];
  let convertedFiles = []; 

  
  const dropZone       = document.getElementById('dropZone');
  const fileInput      = document.getElementById('fileInput');
  const panelLeft      = document.getElementById('panelLeft');
  const panelRight     = document.getElementById('panelRight');
  const rightEmpty     = document.getElementById('rightEmpty');
  const leftCount      = document.getElementById('leftCount');
  const rightCount     = document.getElementById('rightCount');
  const workspace      = document.getElementById('workspace');
  const optionsBar     = document.getElementById('optionsBar');
  const errorMsg       = document.getElementById('errorMsg');
  const bulkBar        = document.getElementById('bulkBar');
  const hint           = document.getElementById('hint');
  const qualitySlider  = document.getElementById('qualitySlider');
  const qualityDisplay = document.getElementById('qualityDisplay');
  const qualityGroup   = document.getElementById('qualityGroup');
  const maxWidthInput  = document.getElementById('maxWidth');
  const maxHeightInput = document.getElementById('maxHeight');
  const processBtn     = document.getElementById('processBtn');

  
  document.querySelectorAll('#formatGroup .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#formatGroup .pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      outputFormat = btn.dataset.fmt;
      qualityGroup.style.display = outputFormat === 'image/png' ? 'none' : 'flex';
    });
  });

  qualitySlider.addEventListener('input', () => {
    quality = qualitySlider.value / 100;
    qualityDisplay.textContent = qualitySlider.value + '%';
  });

  
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
    optionsBar.style.display = 'flex';
    bulkBar.style.display = 'flex';
    hint.style.display = 'none';
  }

  
  function addSourceFile(file) {
    const idx = sourceFiles.length;
    sourceFiles.push({ file, dataUrl: null, cropRect: null, censors: [], previewUrl: null });

    const reader = new FileReader();
    reader.onload = ev => {
      sourceFiles[idx].dataUrl = ev.target.result;
      renderSourceCard(idx);
    };
    reader.readAsDataURL(file);
  }

  
  function buildPreviewUrl(idx, callback) {
    const src = sourceFiles[idx];
    const img = new Image();
    img.onload = () => {
      const cr = src.cropRect;
      const sx = cr ? cr.x : 0, sy = cr ? cr.y : 0;
      const sw = cr ? cr.w : img.naturalWidth, sh = cr ? cr.h : img.naturalHeight;

      const canvas = document.createElement('canvas');
      canvas.width = sw; canvas.height = sh;
      const c = canvas.getContext('2d');
      c.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      
      if (src.censors && src.censors.length) {
        
        canvas._baseImg = img;
        
        
        const eraseBase = document.createElement('canvas');
        eraseBase.width = sw; eraseBase.height = sh;
        eraseBase.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        canvas._baseImg = eraseBase;
        
        const savedScale = censorScale;
        censorScale = 1;
        src.censors.forEach(cen => {
          if ((cen.strength ?? 5) === 0) return;
          const rx = cen.x - sx, ry = cen.y - sy;
          applyCensorRegion(c, canvas, rx, ry, cen.w, cen.h, cen.type, cen.strength);
        });
        censorScale = savedScale;
      }

      callback(canvas.toDataURL());
    };
    img.src = src.dataUrl;
  }

  function renderSourceCard(idx) {
    const src      = sourceFiles[idx];
    const existing = panelLeft.querySelector(`[data-src-idx="${idx}"]`);
    const hasCrop  = !!src.cropRect;

    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.srcIdx = idx;

    
    const thumbImg = document.createElement('img');
    thumbImg.className = 'card-thumb';
    thumbImg.src = src.previewUrl || src.dataUrl;
    thumbImg.alt = src.file.name;
    thumbImg.title = 'Click to set crop';
    thumbImg.addEventListener('click', () => openCropModal(idx));
    thumbImg.addEventListener('touchend', e => { e.preventDefault(); openCropModal(idx); });

    
    const cropBadge = document.createElement('div');
    cropBadge.className = 'crop-badge' + (hasCrop ? ' active' : '');
    cropBadge.textContent = hasCrop ? 'CROP ✓' : 'CROP';
    cropBadge.addEventListener('click', () => openCropModal(idx));
    cropBadge.addEventListener('touchend', e => { e.preventDefault(); openCropModal(idx); });

    const hasCensors = src.censors && src.censors.length > 0;
    const censorBadge = document.createElement('div');
    censorBadge.className = 'censor-badge' + (hasCensors ? ' active' : '');
    censorBadge.textContent = hasCensors ? `CENSOR (${src.censors.length})` : 'CENSOR';
    censorBadge.addEventListener('click', () => openCensorModal(idx));
    censorBadge.addEventListener('touchend', e => { e.preventDefault(); openCensorModal(idx); });

    const body = document.createElement('div');
    body.className = 'card-body';

    const nameEl = document.createElement('div');
    nameEl.className = 'card-name';
    nameEl.title = src.file.name;
    nameEl.textContent = src.file.name;

    const meta = document.createElement('div');
    meta.className = 'card-meta';

    const sz = document.createElement('span');
    sz.textContent = formatBytes(src.file.size);

    const cropMeta = document.createElement('span');
    if (hasCrop) {
      cropMeta.textContent = `${src.cropRect.w}×${src.cropRect.h}`;
      cropMeta.style.color = 'var(--accent)';
    }
    meta.append(sz, cropMeta);

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    if (hasCrop) {
      const clearCrop = document.createElement('button');
      clearCrop.className = 'crop-btn';
      clearCrop.style.fontSize = '10px';
      clearCrop.style.padding  = '5px 10px';
      clearCrop.textContent = 'CLEAR CROP';
      clearCrop.addEventListener('click', e => {
        e.stopPropagation();
        sourceFiles[idx].cropRect = null;
        sourceFiles[idx].previewUrl = null;
        buildPreviewUrl(idx, url => {
          sourceFiles[idx].previewUrl = url;
          renderSourceCard(idx);
        });
      });
      actions.appendChild(clearCrop);
    }

    body.append(nameEl, meta, actions);
    const removeBtn = document.createElement('button');
    removeBtn.className = 'card-remove';
    removeBtn.title = 'Remove image';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      sourceFiles.splice(idx, 1);
      
      panelLeft.innerHTML = '';
      sourceFiles.forEach((_, i) => renderSourceCard(i));
      leftCount.textContent = sourceFiles.length;
      if (!sourceFiles.length) {
        workspace.style.display = 'none';
        optionsBar.style.display = 'none';
        bulkBar.style.display = 'none';
        hint.style.display = '';
      }
    });

    const badgeRow = document.createElement('div');
    badgeRow.className = 'card-badge-row';
    badgeRow.append(cropBadge, censorBadge);
    card.append(removeBtn, thumbImg, badgeRow, body);

    if (existing) {
      existing.replaceWith(card);
    } else {
      panelLeft.appendChild(card);
    }

    leftCount.textContent = sourceFiles.length;
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
          processBtn.textContent = 'Process';
          document.getElementById('downloadAllBtn').style.display = 'inline-block';
        }
      });
    });
  });

  function processSourceFile(src, i, onDone) {
    const img = new Image();
    img.onload = () => {
      const cr = src.cropRect;
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (cr) { sx = cr.x; sy = cr.y; sw = cr.w; sh = cr.h; }

      let dw = sw, dh = sh;
      const mw = parseInt(maxWidthInput.value) || 0;
      const mh = parseInt(maxHeightInput.value) || 0;
      if (mw > 0 && dw > mw) { dh = Math.round(dh * mw / dw); dw = mw; }
      if (mh > 0 && dh > mh) { dw = Math.round(dw * mh / dh); dh = mh; }

      const canvas = document.createElement('canvas');
      canvas.width = dw; canvas.height = dh;
      const c = canvas.getContext('2d');
      if (outputFormat === 'image/jpeg') { c.fillStyle = '#fff'; c.fillRect(0, 0, dw, dh); }
      c.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

      
      if (src.censors && src.censors.length) {
        const scaleX = dw / sw;
        const scaleY = dh / sh;
        src.censors.forEach(cen => {
          if ((cen.strength ?? 5) === 0) return; 
          const rx = Math.round((cen.x - sx) * scaleX);
          const ry = Math.round((cen.y - sy) * scaleY);
          const rw = Math.round(cen.w * scaleX);
          const rh = Math.round(cen.h * scaleY);
          if (rw <= 0 || rh <= 0) return;
          applyCensorRegion(c, canvas, rx, ry, rw, rh, cen.type, cen.strength);
        });
      }

      const ext = outputFormat === 'image/jpeg' ? 'jpg' : outputFormat === 'image/png' ? 'png' : 'webp';
      const outName = src.file.name.replace(/\.[^.]+$/, '') + '.' + ext;

      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const entry = { name: outName, blob, url, origSize: src.file.size };
        const idx = convertedFiles.length;
        convertedFiles.push(entry);
        appendProcessedCard(idx, entry, dw, dh);
        rightCount.textContent = convertedFiles.length;
        onDone();
      }, outputFormat, quality);
    };
    img.src = src.dataUrl;
  }

  
  function appendProcessedCard(idx, entry, dw, dh) {
    const card = buildProcessedCard(idx, entry, dw, dh);
    card.style.animationDelay = (Math.min(idx, 8) * 0.04) + 's';
    panelRight.appendChild(card);
  }

  function buildProcessedCard(idx, entry, dw, dh) {
    const { name, blob, url, origSize } = entry;
    const diff = origSize - blob.size;
    const pct  = origSize > 0 ? Math.abs((diff / origSize) * 100).toFixed(0) : 0;
    const grew = diff < 0;

    const card = document.createElement('div');
    card.className = 'card';

    const thumb = document.createElement('img');
    thumb.className = 'card-thumb';
    thumb.src = url; thumb.alt = name;

    const body = document.createElement('div');
    body.className = 'card-body';

    const nameEl = document.createElement('div');
    nameEl.className = 'card-name';
    nameEl.title = name; nameEl.textContent = name;

    const meta = document.createElement('div');
    meta.className = 'card-meta';

    const dim = document.createElement('span'); dim.textContent = `${dw}×${dh}`;
    const sz  = document.createElement('span'); sz.textContent = formatBytes(blob.size);
    const sv  = document.createElement('span');
    sv.className = grew ? 'grew' : 'saved';
    sv.textContent = grew ? `+${pct}% larger` : pct > 0 ? `−${pct}% saved` : 'same size';
    meta.append(dim, sz, sv);

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const dlBtn = document.createElement('button');
    dlBtn.className = 'dl-btn';
    dlBtn.textContent = '↓ Save';
    dlBtn.addEventListener('click', () => triggerDownload(url, name));

    actions.append(dlBtn);
    body.append(nameEl, meta, actions);
    thumb.style.cursor = 'zoom-in';
    thumb.addEventListener('click', () => openLightbox(url, name));
    card.append(thumb, body);
    return card;
  }

  function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  }

  function triggerDownload(url, name) {
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
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
    convertedFiles = [];
    sourceFiles    = [];
    panelLeft.innerHTML  = '';
    panelRight.innerHTML = '';
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'panel-empty';
    emptyDiv.id = 'rightEmpty';
    emptyDiv.innerHTML = '<span class="panel-empty-icon">→</span><span>Processed images<br>will appear here</span>';
    panelRight.appendChild(emptyDiv);
    leftCount.textContent  = '0';
    rightCount.textContent = '0';
    document.getElementById('downloadAllBtn').style.display = 'none';
    workspace.style.display  = 'none';
    optionsBar.style.display = 'none';
    bulkBar.style.display    = 'none';
    hint.style.display       = '';
    errorMsg.textContent     = '';
    processBtn.textContent   = 'Process';
    processBtn.disabled      = false;
  });

  
  const modal      = document.getElementById('cropModal');
  const cropCanvas = document.getElementById('cropCanvas');
  const cropBox    = document.getElementById('cropBox');
  const cropInfo   = document.getElementById('cropInfo');
  const canvasWrap = document.getElementById('canvasWrap');
  const ctx2d      = cropCanvas.getContext('2d');

  let cropIdx   = null;  
  let scale     = 1;
  let aspect    = null;
  let cropState = { x: 0, y: 0, w: 0, h: 0 };
  let dragMode  = null;
  let dragStart = { x: 0, y: 0 };
  let boxStart  = { x: 0, y: 0, w: 0, h: 0 };

  function openCropModal(idx) {
    cropIdx = idx;
    const src = sourceFiles[idx];
    const srcImg = new Image();
    srcImg.onload = () => {
      const maxW = Math.min(1060, window.innerWidth - 32);
      const maxH = Math.min(window.innerHeight - 180, window.innerHeight * 0.72);
      scale = Math.min(maxW / srcImg.naturalWidth, maxH / srcImg.naturalHeight, 1);
      cropCanvas.width  = Math.round(srcImg.naturalWidth  * scale);
      cropCanvas.height = Math.round(srcImg.naturalHeight * scale);
      ctx2d.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
      ctx2d.drawImage(srcImg, 0, 0, cropCanvas.width, cropCanvas.height);

      
      if (src.cropRect) {
        cropState = {
          x: Math.round(src.cropRect.x * scale),
          y: Math.round(src.cropRect.y * scale),
          w: Math.round(src.cropRect.w * scale),
          h: Math.round(src.cropRect.h * scale),
        };
      } else {
        cropState = { x: 0, y: 0, w: cropCanvas.width, h: cropCanvas.height };
      }

      showCropBox();
      modal.style.display = 'flex';

      document.querySelectorAll('.aspect-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.aspect-btn[data-aspect="free"]').classList.add('active');
      rotateAspectBtn.style.display = 'none';
      aspect = null;
    };
    srcImg.src = src.dataUrl;
  }

  document.getElementById('modalClose').addEventListener('click', closeModal);
  let overlayMousedownOnSelf = false;
  modal.addEventListener('mousedown', e => { overlayMousedownOnSelf = e.target === modal; });
  modal.addEventListener('mouseup',   e => { if (overlayMousedownOnSelf && e.target === modal) closeModal(); overlayMousedownOnSelf = false; });

  function closeModal() {
    modal.style.display = 'none';
    cropIdx = null;
  }

  
  const rotateAspectBtn = document.getElementById('rotateAspectBtn');

  document.querySelectorAll('.aspect-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.aspect-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const v = btn.dataset.aspect;
      if (v === 'free') {
        aspect = null;
        rotateAspectBtn.style.display = 'none';
        return;
      }
      const [aw, ah] = v.split(':').map(Number);
      aspect = aw / ah;
      
      rotateAspectBtn.style.display = aw !== ah ? 'inline-block' : 'none';
      if (cropState.w > 0) {
        cropState.h = Math.round(cropState.w / aspect);
        clampCropState();
        showCropBox();
      }
    });
  });

  rotateAspectBtn.addEventListener('click', () => {
    if (!aspect) return;
    aspect = 1 / aspect;
    
    const cx = cropState.x + cropState.w / 2;
    const cy = cropState.y + cropState.h / 2;
    const newW = Math.round(cropState.h);
    const newH = Math.round(cropState.w);
    cropState.w = newW;
    cropState.h = newH;
    cropState.x = Math.round(cx - newW / 2);
    cropState.y = Math.round(cy - newH / 2);
    clampCropState();
    showCropBox();
  });

  document.getElementById('resetCropBtn').addEventListener('click', () => {
    cropState = { x: 0, y: 0, w: cropCanvas.width, h: cropCanvas.height };
    showCropBox();
  });

  
  document.getElementById('applyCropBtn').addEventListener('click', () => {
    if (cropIdx === null) return;
    const rect = {
      x: Math.round(cropState.x / scale),
      y: Math.round(cropState.y / scale),
      w: Math.round(cropState.w / scale),
      h: Math.round(cropState.h / scale),
    };
    sourceFiles[cropIdx].cropRect = rect;

    const idxToRender = cropIdx;
    closeModal();
    buildPreviewUrl(idxToRender, url => {
      sourceFiles[idxToRender].previewUrl = url;
      renderSourceCard(idxToRender);
    });
  });

  function showCropBox() {
    cropBox.style.display = 'block';
    cropBox.style.left   = cropState.x + 'px';
    cropBox.style.top    = cropState.y + 'px';
    cropBox.style.width  = cropState.w + 'px';
    cropBox.style.height = cropState.h + 'px';
    cropInfo.textContent = `${Math.round(cropState.w / scale)} × ${Math.round(cropState.h / scale)} px`;
  }

  function clampCropState() {
    const CW = cropCanvas.width, CH = cropCanvas.height;
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

  function getPos(e) {
    const r = canvasWrap.getBoundingClientRect();
    const c = e.touches ? e.touches[0] : e;
    return {
      x: Math.max(0, Math.min(c.clientX - r.left, cropCanvas.width)),
      y: Math.max(0, Math.min(c.clientY - r.top,  cropCanvas.height))
    };
  }

  canvasWrap.addEventListener('mousedown', startDrag);
  canvasWrap.addEventListener('touchstart', startDrag, { passive: false });

  function startDrag(e) {
    e.preventDefault();
    const pos = getPos(e);
    const tgt = e.target;
    if (tgt.classList.contains('crop-handle')) {
      dragMode = tgt.dataset.handle;
    } else if (tgt === cropBox) {
      dragMode = 'move';
    } else {
      dragMode = 'draw';
      cropState = { x: pos.x, y: pos.y, w: 0, h: 0 };
      cropBox.style.display = 'block';
    }
    dragStart = { ...pos };
    boxStart  = { ...cropState };
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup',   endDrag);
    window.addEventListener('touchmove', onDrag,  { passive: false });
    window.addEventListener('touchend',  endDrag);
  }

  function onDrag(e) {
    e.preventDefault();
    const pos = getPos(e);
    const dx = pos.x - dragStart.x;
    const dy = pos.y - dragStart.y;
    const CW = cropCanvas.width, CH = cropCanvas.height;

    if (dragMode === 'draw') {
      let x = Math.min(dragStart.x, pos.x);
      let y = Math.min(dragStart.y, pos.y);
      let w = Math.abs(dx);
      let h = Math.abs(dy);
      if (aspect) {
        w = Math.min(w, CW - x);
        h = w / aspect;
        if (y + h > CH) { h = CH - y; w = h * aspect; }
        if (pos.y < dragStart.y) y = dragStart.y - h;
        y = Math.max(0, y);
      }
      cropState = { x, y, w, h };
    } else if (dragMode === 'move') {
      cropState.x = Math.max(0, Math.min(boxStart.x + dx, CW - boxStart.w));
      cropState.y = Math.max(0, Math.min(boxStart.y + dy, CH - boxStart.h));
      cropState.w = boxStart.w;
      cropState.h = boxStart.h;
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
    clampCropState();
    showCropBox();
  }

  function endDrag() {
    dragMode = null;
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup',   endDrag);
    window.removeEventListener('touchmove', onDrag);
    window.removeEventListener('touchend',  endDrag);
    if (cropState.w < 5 || cropState.h < 5) {
      cropState = { x: 0, y: 0, w: cropCanvas.width, h: cropCanvas.height };
      showCropBox();
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
      if (baseImg) {
        
        const nx = Math.round(rx / censorScale);
        const ny = Math.round(ry / censorScale);
        const nw = Math.round(rw / censorScale);
        const nh = Math.round(rh / censorScale);
        ctx.drawImage(baseImg, nx, ny, nw, nh, rx, ry, rw, rh);
      }
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

  
  const censorModal      = document.getElementById('censorModal');
  const censorCanvas     = document.getElementById('censorCanvas');
  const censorCanvasWrap = document.getElementById('censorCanvasWrap');
  const censorInfo       = document.getElementById('censorInfo');
  const censorCtx        = censorCanvas.getContext('2d');

  let censorIdx       = null;
  let censorScale     = 1;
  let censorType      = 'pixelate';
  let censorStrength  = 5;

  const censorStrengthSlider = document.getElementById('censorStrengthSlider');
  const censorStrengthVal    = document.getElementById('censorStrengthVal');
  const censorStrengthGroup  = document.getElementById('censorStrengthGroup');

  censorStrengthSlider.addEventListener('input', () => {
    censorStrength = parseInt(censorStrengthSlider.value);
    censorStrengthVal.textContent = censorStrength;
  });
  let censorRegions   = [];   
  let censorDragStart = null;
  let censorDragCurrent = null;
  let censorDragging  = false;

  function openCensorModal(idx) {
    censorIdx = idx;
    const src = sourceFiles[idx];
    censorRegions = src.censors ? [...src.censors] : [];

    const srcImg = new Image();
    srcImg.onload = () => {
      const maxW = Math.min(1060, window.innerWidth - 32);
      const maxH = Math.min(window.innerHeight - 180, window.innerHeight * 0.72);
      censorScale = Math.min(maxW / srcImg.naturalWidth, maxH / srcImg.naturalHeight, 1);
      censorCanvas.width  = Math.round(srcImg.naturalWidth  * censorScale);
      censorCanvas.height = Math.round(srcImg.naturalHeight * censorScale);

      
      censorCanvas._baseImg = srcImg;
      redrawCensorCanvas();
      censorModal.style.display = 'flex';
      censorInfo.textContent = 'drag to select region';
    };
    srcImg.src = src.dataUrl;

    
    document.querySelectorAll('#censorTypeGroup .pill').forEach(b => b.classList.remove('active'));
    document.querySelector('#censorTypeGroup .pill[data-censor="pixelate"]').classList.add('active');
    censorType = 'pixelate';
    censorStrength = 5;
    censorStrengthSlider.value = 5;
    censorStrengthVal.textContent = '5';
    censorStrengthGroup.style.display = 'flex';
  }

  function redrawCensorCanvas() {
    const img = censorCanvas._baseImg;
    if (!img) return;
    censorCtx.clearRect(0, 0, censorCanvas.width, censorCanvas.height);
    censorCtx.drawImage(img, 0, 0, censorCanvas.width, censorCanvas.height);

    
    censorRegions.forEach(r => {
      const rx = Math.round(r.x * censorScale);
      const ry = Math.round(r.y * censorScale);
      const rw = Math.round(r.w * censorScale);
      const rh = Math.round(r.h * censorScale);
      applyCensorRegion(censorCtx, censorCanvas, rx, ry, rw, rh, r.type, r.strength);
    });

    
    if (censorDragging && censorDragStart && censorDragCurrent) {
      const x = Math.min(censorDragStart.x, censorDragCurrent.x);
      const y = Math.min(censorDragStart.y, censorDragCurrent.y);
      const w = Math.abs(censorDragCurrent.x - censorDragStart.x);
      const h = Math.abs(censorDragCurrent.y - censorDragStart.y);
      censorCtx.strokeStyle = '#d4f04e';
      censorCtx.lineWidth = 2;
      censorCtx.setLineDash([6, 3]);
      censorCtx.strokeRect(x, y, w, h);
      censorCtx.setLineDash([]);
      censorInfo.textContent = `${Math.round(w/censorScale)} × ${Math.round(h/censorScale)} px`;
    }
  }

  
  document.querySelectorAll('#censorTypeGroup .pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#censorTypeGroup .pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      censorType = btn.dataset.censor;
      censorStrengthGroup.style.display = censorType === 'blackbox' ? 'none' : 'flex';
    });
  });

  
  function getCensorPos(e) {
    const r = censorCanvasWrap.getBoundingClientRect();
    const c = e.touches ? e.touches[0] : e;
    return {
      x: Math.max(0, Math.min(c.clientX - r.left, censorCanvas.width)),
      y: Math.max(0, Math.min(c.clientY - r.top,  censorCanvas.height))
    };
  }

  censorCanvasWrap.addEventListener('mousedown', startCensorDrag);
  censorCanvasWrap.addEventListener('touchstart', startCensorDrag, { passive: false });

  function startCensorDrag(e) {
    e.preventDefault();
    censorDragStart   = getCensorPos(e);
    censorDragCurrent = { ...censorDragStart };
    censorDragging    = true;
    window.addEventListener('mousemove', onCensorDrag);
    window.addEventListener('mouseup',   endCensorDrag);
    window.addEventListener('touchmove', onCensorDrag,  { passive: false });
    window.addEventListener('touchend',  endCensorDrag);
  }

  function onCensorDrag(e) {
    e.preventDefault();
    censorDragCurrent = getCensorPos(e);
    redrawCensorCanvas();
  }

  function endCensorDrag(e) {
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
          x: Math.round(x / censorScale),
          y: Math.round(y / censorScale),
          w: Math.round(w / censorScale),
          h: Math.round(h / censorScale),
          type: censorType,
          strength: censorStrength
        });
      }
    }
    censorDragging    = false;
    censorDragStart   = null;
    censorDragCurrent = null;
    redrawCensorCanvas();
    censorInfo.textContent = censorRegions.length
      ? `${censorRegions.length} region${censorRegions.length > 1 ? 's' : ''} — drag to add more`
      : 'drag to select region';
  }

  document.getElementById('censorUndoBtn').addEventListener('click', () => {
    censorRegions.pop();
    redrawCensorCanvas();
    censorInfo.textContent = censorRegions.length
      ? `${censorRegions.length} region${censorRegions.length > 1 ? 's' : ''} — drag to add more`
      : 'drag to select region';
  });

  document.getElementById('censorClearBtn').addEventListener('click', () => {
    censorRegions = [];
    redrawCensorCanvas();
    censorInfo.textContent = 'drag to select region';
  });

  document.getElementById('censorApplyBtn').addEventListener('click', () => {
    if (censorIdx === null) return;
    sourceFiles[censorIdx].censors = [...censorRegions];

    const idxToRender = censorIdx;
    closeCensorModal();
    buildPreviewUrl(idxToRender, url => {
      sourceFiles[idxToRender].previewUrl = url;
      renderSourceCard(idxToRender);
    });
  });

  document.getElementById('censorModalClose').addEventListener('click', closeCensorModal);
  let censorOverlayMousedown = false;
  censorModal.addEventListener('mousedown', e => { censorOverlayMousedown = e.target === censorModal; });
  censorModal.addEventListener('mouseup',   e => { if (censorOverlayMousedown && e.target === censorModal) closeCensorModal(); censorOverlayMousedown = false; });

  function closeCensorModal() {
    censorModal.style.display = 'none';
    censorIdx = null;
    censorCanvas._baseImg = null;
  }

  
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
    if (e.key === 'Escape') lightbox.classList.remove('open');
  });
