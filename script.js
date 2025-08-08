// ================================
//  初始化 & DOM 元素取得
// ================================
// --- 登入密碼 ---
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
const awardModalEl = document.getElementById('awardModal');              // 彈窗容器本身
const logoToggleContainer = document.getElementById('logoToggleContainer');
const logoToggle = document.getElementById('logoToggle');
const partnoToggleContainer = document.getElementById('partnoToggleContainer');
const partnoToggle = document.getElementById('partnoToggle');


// --- 實績照上傳元素 ---
const imageInput = document.getElementById('imageInput');                // 上傳實績照 input
const previewContainer = document.getElementById('preview');             // 預覽容器
const awardToggle = document.getElementById('awardToggle');              // 主畫面切換開關

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

// 紀錄處理後的圖片資料（下載 zip 用）
let imagesData = [];

// 紀錄每張圖片 LOGO 浮水印的座標（拖曳用）
const watermarkPositions = {};

//品號處理
function extractPartNumbers(filename) {  
let name = filename.replace(/\.[^/.]+$/, '');
name = name.replace(/\s*\(\d+\)\s*$/, '');
name = name.trim();
return `# ${name}`;
}

// 得獎浮水印 Image 物件儲存（四種組合）
let awardOverlays = {
  landscape: { dark: null, light: null },
  portrait: { dark: null, light: null }
};

// 是否顯示主畫面得獎浮水印切換開關的Flag
let showApplyWard = false;

// 切換開關預設狀態
awardToggle.checked = false;
let applyAward = false;
let showLogo = true; 
let showPartNo = true;

// 全域快取實績照檔案（key = 檔名, value = File 物件）
window.filesCache = {};

// ================================
//  工具函式
// ================================
/**
 * 驗證圖片長寬比
 * @param {number} width - 圖片寬度
 * @param {number} height - 圖片高度
 * @param {string} type - 'landscape' 或 'portrait'
 * @returns {boolean} 是否通過驗證（允許 ±1.5% 誤差）
 */
function validateAspect(width, height, type) {
  const ratio = width / height;
  const targetRatio = type === 'landscape'
    ? (1840 / 1160)
    : (1160 / 1840);
  return Math.abs(ratio - targetRatio) / targetRatio <= 0.015;
}

/**
 * 檢查四個得獎浮水印槽位是否都有有效圖片
 * @returns {boolean}
 */
function checkAllSlotsFilled() {
  const awardSlots = document.querySelectorAll('.slot');
  for (let slot of awardSlots) {
    const type = slot.dataset.type;
    const color = slot.dataset.color;
    if (!awardOverlays[type][color]) return false;
  }
  return true;
}

/**
 * 更新「套用」按鈕的啟用狀態
 * 四個槽位都填滿才會啟用
 */
function updateApplyButtonState() {
  awardApplyBtn.disabled = !checkAllSlotsFilled();
}

// ================================
// 事件綁定：彈窗開關
// ================================
// 開啟「上傳得獎浮水印」彈窗
awardUploadBtn.addEventListener('click', () => {
  awardModal.style.display = 'block';
});

// 關閉彈窗（取消按鈕）
awardCancelBtn.addEventListener('click', () => {
  awardModal.style.display = 'none';
});

// 點擊背景區域關閉彈窗
awardModal.addEventListener('click', (e) => {
  if (e.target === awardModal) {
    awardModal.style.display = 'none';
  }
});

// ================================
// 事件綁定：「套用」按鈕
// ================================
awardApplyBtn.addEventListener('click', () => {
  // 關閉彈窗
  awardModal.style.display = 'none';

  // 開啟得獎浮水印套用
  awardToggle.checked = true;
  applyAward = true;

  // 確認條件才顯示主畫面切換按鈕
  if (Object.keys(filesCache).length > 0 && checkAllSlotsFilled()) {
    awardToggleContainer.style.display = 'flex';
  }

  // 重新渲染所有已上傳的實績照
  document.querySelectorAll('.canvas-container').forEach(container => {
    const fileName = container.querySelector('.filename-label')?.textContent;
    const style = container.querySelector('.switch-color.active')?.dataset.color || 'white';
    if (fileName && filesCache[fileName]) {
      renderCanvas(filesCache[fileName], style, container);
    }
  });
});

// ================================
// 事件綁定：上傳得獎浮水印檔案
// ================================
awardModalEl.addEventListener('change', (e) => {
  if (e.target.matches('.slot input[type="file"]')) {
    const file = e.target.files[0];
    if (!file) return;

    const slot = e.target.closest('.slot');
    const type = slot.dataset.type;
    const color = slot.dataset.color;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // 驗證比例
        if (!validateAspect(img.width, img.height, type)) {
          alert(`${file.name} 比例不符，請重新上傳`);
          return;
        }

        // 存到對應 overlay
        awardOverlays[type][color] = img;

        // 更新槽位預覽
        const previewDiv = slot.querySelector('.slot-preview');
        previewDiv.innerHTML = '';
        previewDiv.appendChild(img.cloneNode());

        // 更新按鈕狀態
        updateApplyButtonState();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// ================================
// 事件綁定：上傳實績照
// ================================
imageInput.addEventListener('change', handleFiles);

// ================================
// 事件綁定：主畫面切換黑白（同步套用得獎浮水印）
// ================================
awardToggle.addEventListener('change', () => {
  applyAward = awardToggle.checked;

  // 重新渲染所有圖片（依當前黑白模式）
  document.querySelectorAll('.canvas-container').forEach(container => {
    const fileName = container.querySelector('.filename-label')?.textContent;
    const file = filesCache[fileName];
    const style = container.querySelector('.switch-color.active')?.dataset.color;
    if (file) renderCanvas(file, style, container);
  });
});
logoToggle.addEventListener('change', () => {
showLogo = logoToggle.checked;
  // 重繪所有 canvas
  document.querySelectorAll('.canvas-container').forEach(container => {
    const fileName = container.querySelector('.filename-label')?.textContent;
    const file = filesCache[fileName];
    const style = container.querySelector('.switch-color.active')?.dataset.color || 'white';
    if (file) renderCanvas(file, style, container);
  });
});

partnoToggle.addEventListener('change', () => {
  showPartNo = partnoToggle.checked;
  // 重繪所有 canvas
  document.querySelectorAll('.canvas-container').forEach(container => {
    const fileName = container.querySelector('.filename-label')?.textContent;
    const file = filesCache[fileName];
    const style = container.querySelector('.switch-color.active')?.dataset.color || 'white';
    if (file) renderCanvas(file, style, container);
  });
});

// ================================
// 功能函式：處理實績照上傳與預覽生成
// ================================
function handleFiles(event) {
  const files = Array.from(event.target.files);
  previewContainer.innerHTML = ''; // 清空舊預覽
  imagesData = [];

  files.forEach(file => {
    // 存檔到快取，方便之後重繪
    filesCache[file.name] = file;

    // 建立容器
    const container = document.createElement('div');
    container.className = 'canvas-container';

    // 建立顏色切換工具列
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
    previewContainer.appendChild(container);

    // 初始渲染白色版
    renderCanvas(file, 'white', container);
    whiteBtn.classList.add('active');

    // 白色按鈕事件
    whiteBtn.addEventListener('click', () => {
      renderCanvas(file, 'white', container);
      whiteBtn.classList.add('active');
      blackBtn.classList.remove('active');
    });

    // 黑色按鈕事件
    blackBtn.addEventListener('click', () => {
      renderCanvas(file, 'black', container);
      blackBtn.classList.add('active');
      whiteBtn.classList.remove('active');
    });

    // 如果設定允許，顯示主畫面切換按鈕
    if (showApplyWard) {
      awardToggleContainer.style.display = 'flex';
    }

    // 顯示 LOGO / 品號切換（有實績照就顯示）
    logoToggleContainer.style.display = 'flex';
    partnoToggleContainer.style.display = 'flex';

    // 顯示下載按鈕
    document.getElementById('downloadAll').style.display = 'inline-block';
  });
}
// ================================
// 功能函式：渲染 Canvas（含得獎浮水印 & LOGO）
// ================================
function renderCanvas(file, style, container) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const watermarkImg = new Image();
      watermarkImg.onload = () => {
        const savedPos = watermarkPositions[file.name]; // 讀取上次拖曳位置
        const canvas = createCanvasWithDrag(img, watermarkImg, file.name, style, savedPos);

        // 移除舊 canvas 與檔名標籤
        container.querySelector('canvas')?.remove();
        container.querySelector('.filename-label')?.remove();

        // 加入新的 canvas
        container.appendChild(canvas);

        // 檔名標籤
        const label = document.createElement('div');
        label.className = 'filename-label';
        label.textContent = file.name;
        container.appendChild(label);

        // 更新 imagesData（下載 zip 用）
        canvas._getBlob().then(({ blob, name }) => {
          const index = imagesData.findIndex(d => d.name === name);
          if (index !== -1) imagesData.splice(index, 1);
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

  const scale = Math.max(targetW / img.width, targetH / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  const imgX = (targetW - drawW) / 2;
  const imgY = (targetH - drawH) / 2;

  const watermarkW = 285;
  const watermarkH = watermarkW * (watermarkImg.height / watermarkImg.width);
  let wmX = initialPos?.x ?? (targetW - watermarkW) / 2;
  let wmY = initialPos?.y ?? (targetH - watermarkH) / 2;

  let dragging = false;
  let offsetX = 0, offsetY = 0;

  // 繪製函式
  function draw() {
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(img, imgX, imgY, drawW, drawH);

    // 畫得獎浮水印（全幅）
    if (applyAward) {
      const awardImg = isLandscape
        ? (style === 'black' ? awardOverlays.landscape.dark : awardOverlays.landscape.light)
        : (style === 'black' ? awardOverlays.portrait.dark : awardOverlays.portrait.light);
      if (awardImg) ctx.drawImage(awardImg, 0, 0, targetW, targetH);
    }

    // 畫 LOGO 浮水印
    if (showLogo) {
      ctx.drawImage(watermarkImg, wmX, wmY, watermarkW, watermarkH);
    }

    // 畫檔名文字
    if (showPartNo) {
      ctx.fillStyle = style === 'black' ? '#000' : '#fff';
      ctx.font = '23px "Helvetica Neue Light", "Helvetica Neue", Helvetica, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(extractPartNumbers(fileName), 46.5, targetH - 35);
    }
  }

  draw();

  // 滑鼠事件：開始拖曳
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

  // 滑鼠事件：拖曳中
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

  // 滑鼠事件：結束拖曳
  canvas.addEventListener('mouseup', () => {
    dragging = false;
    canvas.style.cursor = 'default';
    watermarkPositions[fileName] = { x: wmX, y: wmY };
  });

  // 匯出 Blob 用
  canvas._getBlob = () => new Promise(resolve => {
    draw();
    canvas.toBlob(blob => resolve({ blob, name: fileName }), 'image/jpeg', 0.95);
  });
  return canvas;
}
// ================================
// 功能函式：下載所有圖片（保持當前套用狀態）
// ================================
document.getElementById('downloadAll').addEventListener('click', async () => {
  const zip = new JSZip();
  const canvases = document.querySelectorAll('canvas');

  for (const canvas of canvases) {
    if (typeof canvas._getBlob === 'function') {
      const { blob, name } = await canvas._getBlob();
      zip.file(name, blob);
    }
  }

  // 判斷檔名
  let zipName = '已上浮水印.zip';
  if (applyAward) { // 或用 applyAward 判斷
    zipName = '已上浮水印+得獎.zip';
  }

  zip.generateAsync({ type: 'blob' }).then(content => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = zipName;
    a.click();
  });
});


