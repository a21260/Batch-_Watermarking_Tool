// ================================
//  初始化 & DOM 元素取得
// ================================

// --- 登入密碼（保留註解，功能如需啟用請把註解移除） ---
const PASSWORD = "6655";
function checkPassword() {
  const input = document.getElementById("password").value;
  if (input === PASSWORD) {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app").style.display = "block";
  } else {
    document.getElementById("error").textContent = "密碼錯誤";
  }
}
document.getElementById("password").addEventListener("keydown", function (e) {
  if (e.key === "Enter") checkPassword();
});

// --- 彈窗相關元素 ---
const awardModal = document.getElementById('awardModal');
const awardUploadBtn = document.getElementById('awardUploadBtn');
const awardCancelBtn = document.getElementById('awardCancel');
const awardApplyBtn = document.getElementById('awardApply');
const awardToggleContainer = document.getElementById('awardToggleContainer');
const awardToggle = document.getElementById('awardToggle');
const awardModalEl = document.getElementById('awardModal');

// --- 其他 UI 元素 ---
const imageInput = document.getElementById('imageInput');
const previewContainer = document.getElementById('preview');
const clearAllBtn = document.getElementById('clearAllBtn');
const imageUploadBtn = document.getElementById('imageUploadBtn');


const logoToggleContainer = document.getElementById('logoToggleContainer');
const logoToggle = document.getElementById('logoToggle');
const partnoToggleContainer = document.getElementById('partnoToggleContainer');
const partnoToggle = document.getElementById('partnoToggle');

// --- 下載按鈕（新版：兩顆） ---
const downloadCompressedBtn = document.getElementById('downloadCompressed');
const downloadHighQualityBtn = document.getElementById('downloadHighQuality');

// --- Go Top ---
const goTopBtn = document.getElementById('goTopBtn');

// ================================
//  全域變數與設定
// ================================

// 輸出目標尺寸（橫式 / 直式）
const targetSize = {
  landscape: [1840, 1160],
  portrait: [1160, 1840]
};

// LOGO 浮水印圖片路徑
const watermarkPaths = {
  white: './watermark-white.png',
  black: './watermark-black.png'
};

// 下載 zip 用的暫存
let imagesData = [];

// 記錄每張圖片 LOGO 位置（拖曳）
const watermarkPositions = {};

// 品號（左下角）內容：由檔名產生
function extractPartNumbers(filename) {
  let name = filename.replace(/\.[^/.]+$/, '');
  name = name.replace(/\s*\(\d+\)\s*$/, '');
  name = name.trim();
  return `# ${name}`;
}

// 得獎浮水印（四種組合）的 Image 物件
let awardOverlays = {
  landscape: { dark: null, light: null },
  portrait: { dark: null, light: null }
};

// 是否顯示主畫面的得獎浮水印切換
let showApplyWard = false;

// 三個功能開關的邏輯狀態（與 UI 同步）
let applyAward = false;
let showLogo = true;
let showPartNo = true;

// 開關預設狀態（UI）
awardToggle.checked = false;
logoToggle.checked = true;
partnoToggle.checked = true;

// 實績照快取（允許同名共存 → 使用唯一 id）
window.filesCache = {};

// 1MB 壓縮品質序列
const QUALITY_LEVELS_1M = [1, 0.98, 0.95, 0.92, 0.9, 0.85, 0.8];
const MAX_FILE_SIZE = 1024 * 1024; // 1MB

// ================================
//  工具函式（檢查、狀態、繪製共用）
// ================================

/** 驗證圖片長寬比（允許 ±1.5% 誤差） */
function validateAspect(width, height, type) {
  const ratio = width / height;
  const targetRatio = type === 'landscape' ? (1840 / 1160) : (1160 / 1840);
  return Math.abs(ratio - targetRatio) / targetRatio <= 0.015;
}

/** 四個得獎浮水印槽位是否都已填滿 */
function checkAllSlotsFilled() {
  return (
    awardOverlays.landscape.dark &&
    awardOverlays.landscape.light &&
    awardOverlays.portrait.dark &&
    awardOverlays.portrait.light
  );
}

/** 是否已有任何實績照 */
function hasAnyPhotos() {
  return !!previewContainer.querySelector('.canvas-container');
}

/** 更新「套用」按鈕的可用狀態（在彈窗內） */
function updateApplyButtonState() {
  awardApplyBtn.disabled = !checkAllSlotsFilled();
}

/** 更新下載按鈕顯示 */
function updateDownloadButtonsVisibility() {
  const displayValue = hasAnyPhotos() ? 'inline-block' : 'none';

  if (downloadCompressedBtn) {
    downloadCompressedBtn.style.display = displayValue;
  }
  if (downloadHighQualityBtn) {
    downloadHighQualityBtn.style.display = displayValue;
  }
}

/** 重新繪製所有 canvas（依每個卡片自身的黑/白狀態） */
function redrawAllCanvases() {
  document.querySelectorAll('.canvas-container').forEach(container => {
    const fileId = container.dataset.fileId;
    const file = filesCache[fileId];
    const style = container.querySelector('.switch-color.active')?.dataset.color || 'white';
    if (file) renderCanvas(file, style, container);
  });
}

/** 顯示/隱藏三個切換開關容器（並在「顯示時」設定預設狀態） */
function updateToggleVisibility() {
  const photos = hasAnyPhotos();
  const awardsReady = checkAllSlotsFilled();

  // LOGO、品號：有實績照就顯示（預設開啟）
  if (photos) {
    logoToggleContainer.style.display = 'flex';
    partnoToggleContainer.style.display = 'flex';

    if (!logoToggle.checked) {
      logoToggle.checked = true;
      showLogo = true;
    }
    if (!partnoToggle.checked) {
      partnoToggle.checked = true;
      showPartNo = true;
    }
  } else {
    logoToggleContainer.style.display = 'none';
    partnoToggleContainer.style.display = 'none';
  }

  // 得獎浮水印：需要「有實績照」且「四張齊全」
  if (photos && awardsReady) {
    awardToggleContainer.style.display = 'flex';
    showApplyWard = true;

    // 一顯示就預設啟用
    if (!awardToggle.checked) {
      awardToggle.checked = true;
      applyAward = true;
    }
  } else {
    awardToggleContainer.style.display = 'none';
    awardToggle.checked = false;
    applyAward = false;
  }
}

/** 完整重置（等同「清空」） */
function fullReset() {
  // 清畫面與暫存
  previewContainer.innerHTML = '';
  imagesData = [];
  filesCache = {};

  for (const k in watermarkPositions) {
    delete watermarkPositions[k];
  }

  // 清得獎浮水印與彈窗內容
  awardOverlays = {
    landscape: { dark: null, light: null },
    portrait: { dark: null, light: null }
  };

  document.querySelectorAll('#awardModal .slot .slot-preview').forEach(preview => {
    preview.innerHTML = '';
  });

  document.querySelectorAll('#awardModal .slot input[type="file"]').forEach(input => {
    input.value = '';
  });

  updateApplyButtonState();

  // 重置開關邏輯與 UI
  showApplyWard = false;
  applyAward = false;
  showLogo = true;
  showPartNo = true;

  awardToggle.checked = false;
  logoToggle.checked = true;
  partnoToggle.checked = true;

  // 收起所有切換容器
  awardToggleContainer.style.display = 'none';
  logoToggleContainer.style.display = 'none';
  partnoToggleContainer.style.display = 'none';

  // 收起下載按鈕
  updateDownloadButtonsVisibility();
}

/** 產生唯一 id（允許同名檔共存） */
function genFileId(file) {
  return `${file.name}__${Date.now()}__${Math.random().toString(36).slice(2, 7)}`;
}

/** 依模式取得 zip 檔名 */
function getZipFileName() {
  return awardToggle.checked ? '已上浮水印+得獎.zip' : '已上浮水印.zip';
}

/** 將 canvas 依指定 JPEG 品質輸出成 blob */
function canvasToJpegBlob(canvas, quality) {
  return new Promise(resolve => {
    canvas.toBlob(resolve, 'image/jpeg', quality);
  });
}

/** 取得 1MB 限制 blob */
async function getCompressedBlob(canvas, fileName) {
  let lastBlob = null;

  for (const quality of QUALITY_LEVELS_1M) {
    const blob = await canvasToJpegBlob(canvas, quality);
    lastBlob = blob;

    if (blob && blob.size <= MAX_FILE_SIZE) {
      return { blob, name: fileName };
    }
  }

  // 降到 0.8 還超過就接受
  return { blob: lastBlob, name: fileName };
}

/** 取得高畫質 blob */
async function getHighQualityBlob(canvas, fileName) {
  const blob = await canvasToJpegBlob(canvas, 1);
  return { blob, name: fileName };
}

// ================================
// 事件綁定：彈窗開關 & 上傳得獎浮水印
// ================================

// 開啟「上傳得獎浮水印」彈窗
awardUploadBtn.addEventListener('click', () => {
  awardModal.style.display = 'block';
});

// 關閉彈窗（取消）
awardCancelBtn.addEventListener('click', () => {
  awardModal.style.display = 'none';
});

// 點背景關閉
awardModal.addEventListener('click', (e) => {
  if (e.target === awardModal) {
    awardModal.style.display = 'none';
  }
});

// 彈窗內：上傳四槽的任一張
awardModalEl.addEventListener('change', (e) => {
  if (!e.target.matches('.slot input[type="file"]')) return;

  const file = e.target.files[0];
  if (!file) return;

  const slot = e.target.closest('.slot');
  const type = slot.dataset.type;
  const color = slot.dataset.color;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      if (!validateAspect(img.width, img.height, type)) {
        alert(`${file.name} 比例不符，請重新上傳`);
        e.target.value = '';
        updateApplyButtonState();
        return;
      }

      // 存 overlay 並預覽
      awardOverlays[type][color] = img;

      const previewDiv = slot.querySelector('.slot-preview');
      previewDiv.innerHTML = '';
      previewDiv.appendChild(img.cloneNode(true));

      updateApplyButtonState();
      updateToggleVisibility();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);

  // 允許同一檔再次選取觸發
  e.target.value = '';
});

// 彈窗內：「套用」按鈕
awardApplyBtn.addEventListener('click', () => {
  awardModal.style.display = 'none';

  if (hasAnyPhotos() && checkAllSlotsFilled()) {
    awardToggleContainer.style.display = 'flex';
    awardToggle.checked = true;
    applyAward = true;
  }

  redrawAllCanvases();
});

// ================================
// 事件綁定：上傳實績照（累加，不清空舊的）
// ================================
imageInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []);
  files.forEach(file => handleOneFile(file));
  e.target.value = '';
});

// ================================
// 事件綁定：拖曳上傳實績照（綁在上傳按鈕本身）
// ================================

// 防止拖曳時瀏覽器直接開啟檔案
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  imageUploadBtn.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
});

// 拖進來時高亮
['dragenter', 'dragover'].forEach(eventName => {
  imageUploadBtn.addEventListener(eventName, () => {
    imageUploadBtn.classList.add('dragover');
  });
});

// 拖離開 / 放下後取消高亮
['dragleave', 'drop'].forEach(eventName => {
  imageUploadBtn.addEventListener(eventName, () => {
    imageUploadBtn.classList.remove('dragover');
  });
});

// 放下檔案後直接加入預覽
imageUploadBtn.addEventListener('drop', (e) => {
  const files = Array.from(e.dataTransfer.files || []);

  files
    .filter(file => file.type.startsWith('image/')) // 只接受圖片
    .forEach(file => handleOneFile(file));
});

// ================================
// 事件綁定：三個主畫面切換開關
// ================================
awardToggle.addEventListener('change', () => {
  applyAward = awardToggle.checked;
  redrawAllCanvases();
});

logoToggle.addEventListener('change', () => {
  showLogo = logoToggle.checked;
  redrawAllCanvases();
});

partnoToggle.addEventListener('change', () => {
  showPartNo = partnoToggle.checked;
  redrawAllCanvases();
});

// ================================
// 事件綁定：刪除單張（若刪到 0 張 → 等同清空）
// ================================
previewContainer.addEventListener('click', (e) => {
  const btn = e.target.closest('.delete-btn');
  if (!btn) return;

  const card = btn.closest('.canvas-container');
  if (!card) return;

  const fileId = card.dataset.fileId;
  const label = card.querySelector('.filename-label');
  const displayName = label ? label.textContent : null;

  if (fileId && filesCache[fileId]) {
    delete filesCache[fileId];
  }

  if (displayName) {
    const idx = imagesData.findIndex(d => d.name === displayName);
    if (idx !== -1) {
      imagesData.splice(idx, 1);
    }
  }

  card.remove();

  // 刪到 0 張 → 相當於清空
  if (!hasAnyPhotos()) {
    fullReset();
    return;
  }

  updateToggleVisibility();
  updateDownloadButtonsVisibility();
});

// ================================
// 事件綁定：清空全部（= 重整）
// ================================
clearAllBtn.addEventListener('click', () => {
  fullReset();
});

// ================================
// 功能函式：建立/更新單張卡片並渲染
// ================================
function handleOneFile(file) {
  const fileId = genFileId(file);
  filesCache[fileId] = file;

  // 建立卡片容器
  const container = document.createElement('div');
  container.className = 'canvas-container';
  container.dataset.fileId = fileId;

  // 工具列：黑/白切換
  const toolbar = document.createElement('div');
  toolbar.className = 'canvas-toolbar';

  const whiteBtn = document.createElement('button');
  whiteBtn.className = 'switch-color';
  whiteBtn.dataset.color = 'white';
  whiteBtn.textContent = '白';

  const blackBtn = document.createElement('button');
  blackBtn.className = 'switch-color';
  blackBtn.dataset.color = 'black';
  blackBtn.textContent = '黑';

  toolbar.appendChild(whiteBtn);
  toolbar.appendChild(blackBtn);
  container.appendChild(toolbar);

  // 右上角垃圾桶
  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn';
  delBtn.innerHTML = `<img class="icon" src="./trash can.png"/>`;
  container.appendChild(delBtn);

  // 加進預覽區（累加）
  previewContainer.appendChild(container);

  // 初始渲染 + 預設白色啟用
  renderCanvas(file, 'white', container);
  whiteBtn.classList.add('active');

  // 黑白切換
  whiteBtn.addEventListener('click', () => {
    const currentFile = filesCache[container.dataset.fileId];
    renderCanvas(currentFile, 'white', container);
    whiteBtn.classList.add('active');
    blackBtn.classList.remove('active');
  });

  blackBtn.addEventListener('click', () => {
    const currentFile = filesCache[container.dataset.fileId];
    renderCanvas(currentFile, 'black', container);
    blackBtn.classList.add('active');
    whiteBtn.classList.remove('active');
  });

  updateToggleVisibility();
  updateDownloadButtonsVisibility();
}

// ================================
// 功能函式：渲染 Canvas（含得獎浮水印、LOGO、品號）
// ================================
function renderCanvas(file, style, container) {
  const reader = new FileReader();

  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const watermarkImg = new Image();
      watermarkImg.onload = () => {
        const savedPos = watermarkPositions[file.name];
        const canvas = createCanvasWithDrag(img, watermarkImg, file.name, style, savedPos);

        // 移除舊畫布與檔名
        container.querySelector('canvas')?.remove();
        container.querySelector('.filename-label')?.remove();

        // 加入新畫布
        container.appendChild(canvas);

        // 檔名標籤
        const label = document.createElement('div');
        label.className = 'filename-label';
        label.textContent = file.name;
        container.appendChild(label);

        // 更新 imagesData（僅作暫存，不影響下載邏輯）
        canvas._getBlobCompressed().then(({ blob, name }) => {
          const i = imagesData.findIndex(d => d.name === name);
          if (i !== -1) {
            imagesData.splice(i, 1);
          }
          imagesData.push({ blob, name });
        });
      };
      watermarkImg.src = watermarkPaths[style];
    };
    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
}

// ================================
// 功能函式：建立可拖曳 LOGO 的 Canvas（支援得獎浮水印）
// ================================
function createCanvasWithDrag(img, watermarkImg, fileName, style, initialPos) {
  const isLandscape = img.width >= img.height;
  const [targetW, targetH] = isLandscape ? targetSize.landscape : targetSize.portrait;

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');

  // 背景圖縮放填滿
  const scale = Math.max(targetW / img.width, targetH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const imgX = (targetW - drawW) / 2;
  const imgY = (targetH - drawH) / 2;

  // LOGO 預設尺寸與位置
  const watermarkW = 285;
  const watermarkH = watermarkW * (watermarkImg.height / watermarkImg.width);
  let wmX = initialPos?.x ?? (targetW - watermarkW) / 2;
  let wmY = initialPos?.y ?? (targetH - watermarkH) / 2;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function draw() {
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(img, imgX, imgY, drawW, drawH);

    // 得獎浮水印（全幅）
    if (applyAward) {
      const awardImg = isLandscape
        ? (style === 'black' ? awardOverlays.landscape.dark : awardOverlays.landscape.light)
        : (style === 'black' ? awardOverlays.portrait.dark : awardOverlays.portrait.light);

      if (awardImg) {
        ctx.drawImage(awardImg, 0, 0, targetW, targetH);
      }
    }

    // LOGO
    if (showLogo) {
      ctx.drawImage(watermarkImg, wmX, wmY, watermarkW, watermarkH);
    }

    // 品號（左下角）
    if (showPartNo) {
      ctx.fillStyle = style === 'black' ? '#000' : '#fff';
      ctx.font = '23px "Helvetica Neue Light", "Helvetica Neue", Helvetica, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(extractPartNumbers(fileName), 46.5, targetH - 35);
    }
  }

  draw();

  // 拖曳事件（LOGO）
  canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (x >= wmX && x <= wmX + watermarkW && y >= wmY && y <= wmY + watermarkH) {
      dragging = true;
      offsetX = x - wmX;
      offsetY = y - wmY;
      canvas.style.cursor = 'grabbing';
    }
  });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if ((x >= wmX && x <= wmX + watermarkW && y >= wmY && y <= wmY + watermarkH) || dragging) {
      canvas.style.cursor = 'grab';
    } else {
      canvas.style.cursor = 'default';
    }

    if (dragging) {
      wmX = x - offsetX;
      wmY = y - offsetY;
      draw();
    }
  });

  canvas.addEventListener('mouseup', () => {
    dragging = false;
    canvas.style.cursor = 'default';
    watermarkPositions[fileName] = { x: wmX, y: wmY };
  });

  // 下載用：1MB 壓縮版
  canvas._getBlobCompressed = async () => {
    draw();
    return await getCompressedBlob(canvas, fileName);
  };

  // 下載用：高畫質版
  canvas._getBlobHighQuality = async () => {
    draw();
    return await getHighQualityBlob(canvas, fileName);
  };

  return canvas;
}

// ================================
// 功能函式：下載所有圖片（保持當前套用狀態）
// ================================
const usedNames = new Map();

function uniqueName(name) {
  if (!usedNames.has(name)) {
    usedNames.set(name, 1);
    return name;
  }

  const n = usedNames.get(name) + 1;
  usedNames.set(name, n);

  const i = name.lastIndexOf('.');
  const base = i >= 0 ? name.slice(0, i) : name;
  const ext = i >= 0 ? name.slice(i) : '';

  return `${base}(${n})${ext}`;
}

/** 共用下載流程 */
async function downloadZip(getBlobMethodName) {
  const zip = new JSZip();
  usedNames.clear();

  const canvases = document.querySelectorAll('canvas');

  for (const canvas of canvases) {
    const getBlobFn = canvas[getBlobMethodName];
    if (typeof getBlobFn === 'function') {
      const { blob, name } = await getBlobFn();
      zip.file(uniqueName(name), blob);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = getZipFileName();
  a.click();
}

// 1M 檔案大小下載
if (downloadCompressedBtn) {
  downloadCompressedBtn.addEventListener('click', async () => {
    await downloadZip('_getBlobCompressed');
  });
}

// 高畫質下載
if (downloadHighQualityBtn) {
  downloadHighQualityBtn.addEventListener('click', async () => {
    await downloadZip('_getBlobHighQuality');
  });
}

// ================================
// Go Top 按鈕功能
// ================================
if (goTopBtn) {
  window.addEventListener('scroll', () => {
    if (document.documentElement.scrollTop > 200 || document.body.scrollTop > 200) {
      goTopBtn.style.display = 'block';
    } else {
      goTopBtn.style.display = 'none';
    }
  });

  goTopBtn.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  });
}