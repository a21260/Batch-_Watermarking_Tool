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
const awardModal = document.getElementById('awardModal');                // 得獎浮水印彈窗
const awardUploadBtn = document.getElementById('awardUploadBtn');        // 開啟彈窗按鈕
const awardCancelBtn = document.getElementById('awardCancel');           // 彈窗內「取消」按鈕
const awardApplyBtn = document.getElementById('awardApply');             // 彈窗內「套用」按鈕
const awardToggleContainer = document.getElementById('awardToggleContainer'); // 主畫面切換容器
const awardToggle = document.getElementById('awardToggle');              // 主畫面切換開關
const awardModalEl = document.getElementById('awardModal');              // 彈窗容器本身

// --- 其他 UI 元素 ---
const imageInput = document.getElementById('imageInput');                // 上傳實績照 input
const previewContainer = document.getElementById('preview');             // 預覽容器
const clearAllBtn = document.getElementById('clearAllBtn');              // 清空按鈕

const logoToggleContainer = document.getElementById('logoToggleContainer');
const logoToggle = document.getElementById('logoToggle');
const partnoToggleContainer = document.getElementById('partnoToggleContainer');
const partnoToggle = document.getElementById('partnoToggle');

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
  let name = filename.replace(/\.[^/.]+$/, '');  // 去副檔名
  name = name.replace(/\s*\(\d+\)\s*$/, '');     // 去掉可能的 (2)、(3)
  name = name.trim();
  return `# ${name}`;
}

// 得獎浮水印（四種組合）的 Image 物件
let awardOverlays = {
  landscape: { dark: null, light: null },
  portrait:  { dark: null,  light: null }
};

// 是否顯示主畫面的得獎浮水印切換（你改名後的 flag）
let showApplyWard = false;

// 三個功能開關的邏輯狀態（與 UI 同步）
let applyAward = false;   // 得獎浮水印是否套用
let showLogo = true;      // 是否顯示 LOGO
let showPartNo = true;    // 是否顯示品號

// 開關預設狀態（UI）
awardToggle.checked = false;
logoToggle.checked = true;
partnoToggle.checked = true;

// 實績照快取（允許同名共存 → 使用唯一 id）
window.filesCache = {};   // { [fileId]: File }

// ================================
//  工具函式（檢查、狀態、繪製共用）
// ================================

/** 驗證圖片長寬比（允許 ±1.5% 誤差） */
function validateAspect(width, height, type) {
  const ratio = width / height;
  const targetRatio = type === 'landscape' ? (1840/1160) : (1160/1840);
  return Math.abs(ratio - targetRatio) / targetRatio <= 0.015;
}

/** 四個得獎浮水印槽位是否都已填滿 */
function checkAllSlotsFilled() {
  return (
    awardOverlays.landscape.dark  &&
    awardOverlays.landscape.light &&
    awardOverlays.portrait.dark   &&
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
    // 若第一次顯示，確保為開啟
    if (!logoToggle.checked) { logoToggle.checked = true; showLogo = true; }
    if (!partnoToggle.checked) { partnoToggle.checked = true; showPartNo = true; }
  } else {
    logoToggleContainer.style.display = 'none';
    partnoToggleContainer.style.display = 'none';
  }

  // 得獎浮水印：需要「有實績照」且「四張齊全」
  if (photos && awardsReady) {
    awardToggleContainer.style.display = 'flex';
    showApplyWard = true;
    // 規則：一顯示就預設啟用
    if (!awardToggle.checked) {
      awardToggle.checked = true;
      applyAward = true;
    }
  } else {
    awardToggleContainer.style.display = 'none';
    // 若不滿足條件則關閉套用狀態
    awardToggle.checked = false;
    applyAward = false;
  }
}

/** 完整重置（等同「清空」→ 包含得獎浮水印與所有 UI 狀態） */
function fullReset() {
  // 清畫面 & 暫存
  previewContainer.innerHTML = '';
  imagesData = [];
  filesCache = {};
  for (const k in watermarkPositions) delete watermarkPositions[k];

  // 清得獎浮水印與彈窗內容
  awardOverlays = {
    landscape: { dark: null, light: null },
    portrait:  { dark: null,  light: null }
  };
  document.querySelectorAll('#awardModal .slot .slot-preview').forEach(p => p.innerHTML = '');
  document.querySelectorAll('#awardModal .slot input[type="file"]').forEach(i => i.value = '');
  updateApplyButtonState(); // 會變 disabled

  // 重置開關邏輯與 UI
  showApplyWard = false;
  applyAward = false;
  showLogo = true;
  showPartNo = true;

  awardToggle.checked = false;
  logoToggle.checked = true;
  partnoToggle.checked = true;

  // 收起所有切換容器（等上傳再顯示）
  awardToggleContainer.style.display = 'none';
  logoToggleContainer.style.display  = 'none';
  partnoToggleContainer.style.display= 'none';

  // 下載按鈕收起
  document.getElementById('downloadAll').style.display = 'none';
}

/** 產生唯一 id（允許同名檔共存） */
function genFileId(file) {
  return `${file.name}__${Date.now()}__${Math.random().toString(36).slice(2,7)}`;
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
  if (e.target === awardModal) awardModal.style.display = 'none';
});

// 彈窗內：上傳四槽的任一張
awardModalEl.addEventListener('change', (e) => {
  if (!e.target.matches('.slot input[type="file"]')) return;

  const file = e.target.files[0];
  if (!file) return;

  const slot = e.target.closest('.slot');
  const type = slot.dataset.type;     // landscape / portrait
  const color = slot.dataset.color;   // dark / light

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

      // 檢查是否可按「套用」
      updateApplyButtonState();

      // ★ 關鍵：如果此時已經有實績照上傳，且四張終於齊了 → 讓主畫面出現「得獎浮水印開關」預設開啟
      updateToggleVisibility();
      if (hasAnyPhotos() && checkAllSlotsFilled()) {
        // 立即重繪（如果當前頁面已有預覽）
        // redrawAllCanvases();
      }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);

  // 允許同一檔再次選取觸發
  e.target.value = '';
});

// 彈窗內：「套用」按鈕（關閉彈窗、顯示主畫面切換、預設開啟、重繪）
awardApplyBtn.addEventListener('click', () => {
  awardModal.style.display = 'none';

  // 條件允許時顯示 & 預設開啟
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
  e.target.value = ''; // 讓同一檔再次選取也觸發 change
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

  if (fileId && filesCache[fileId]) delete filesCache[fileId];
  if (displayName) {
    const idx = imagesData.findIndex(d => d.name === displayName);
    if (idx !== -1) imagesData.splice(idx, 1);
  }

  card.remove();

  // 刪到 0 張 → 相當於「清空」
  if (!hasAnyPhotos()) {
    fullReset();
    return;
  }

  // 尚有圖片 → 更新切換顯示（LOGO/品號保留；得獎需視齊全狀態）
  updateToggleVisibility();
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
  // 準備唯一 id 與快取
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

  // 切換事件
  whiteBtn.addEventListener('click', () => {
    const f = filesCache[container.dataset.fileId];
    renderCanvas(f, 'white', container);
    whiteBtn.classList.add('active');
    blackBtn.classList.remove('active');
  });
  blackBtn.addEventListener('click', () => {
    const f = filesCache[container.dataset.fileId];
    renderCanvas(f, 'black', container);
    blackBtn.classList.add('active');
    whiteBtn.classList.remove('active');
  });

  // 有上傳實績照 → 顯示 LOGO/品號切換；若得獎四張已齊，亦顯示得獎切換（預設開）
  updateToggleVisibility();

  // 顯示下載按鈕
  document.getElementById('downloadAll').style.display = 'inline-block';
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
        const savedPos = watermarkPositions[file.name]; // 讀取上次拖曳位置（以檔名為索引）
        const canvas = createCanvasWithDrag(img, watermarkImg, file.name, style, savedPos);

        // 移除舊畫布與檔名
        container.querySelector('canvas')?.remove();
        container.querySelector('.filename-label')?.remove();

        // 加入新的畫布
        container.appendChild(canvas);

        // 檔名標籤
        const label = document.createElement('div');
        label.className = 'filename-label';
        label.textContent = file.name;
        container.appendChild(label);

        // 更新 imagesData（下載 zip 用）
        canvas._getBlob().then(({ blob, name }) => {
          const i = imagesData.findIndex(d => d.name === name);
          if (i !== -1) imagesData.splice(i, 1);
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

  // 縮放背景圖充滿
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
  let offsetX = 0, offsetY = 0;

  // 真正繪製
  function draw() {
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(img, imgX, imgY, drawW, drawH);

    // 得獎浮水印（全幅）
    if (applyAward) {
      const awardImg = isLandscape
        ? (style === 'black' ? awardOverlays.landscape.dark : awardOverlays.landscape.light)
        : (style === 'black' ? awardOverlays.portrait.dark : awardOverlays.portrait.light);
      if (awardImg) ctx.drawImage(awardImg, 0, 0, targetW, targetH);
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

  // 匯出成 Blob（下載用）
  canvas._getBlob = () => new Promise(resolve => {
    draw(); // 確保輸出的是最新畫面
    canvas.toBlob(blob => resolve({ blob, name: fileName }), 'image/jpeg', 0.95);
  });
  return canvas;
}

// ================================
// 功能函式：下載所有圖片（保持當前套用狀態）
// ================================
const usedNames = new Map(); // key: 原始檔名, value: 使用次數

function uniqueName(name) {
  if (!usedNames.has(name)) {
    usedNames.set(name, 1);
    return name; // 第一次出現，直接用
  }
  const n = usedNames.get(name) + 1;
  usedNames.set(name, n);
  const i = name.lastIndexOf('.');
  const base = i >= 0 ? name.slice(0, i) : name;
  const ext  = i >= 0 ? name.slice(i) : '';
  return `${base}(${n})${ext}`; // 例如 a.jpg -> a(2).jpg, a(3).jpg ...
}

document.getElementById('downloadAll').addEventListener('click', async () => {
  const zip = new JSZip();
  usedNames.clear(); // 每次下載前清空一次

  const canvases = document.querySelectorAll('canvas');
  for (const canvas of canvases) {
    if (typeof canvas._getBlob === 'function') {
      const { blob, name } = await canvas._getBlob(); // _getBlob 會回傳原始檔名
      zip.file(uniqueName(name), blob);               // ★ 用唯一化檔名存入
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(content);
  a.download = awardToggle.checked ? '已上浮水印+得獎.zip' : '已上浮水印.zip';
  a.click();
});



