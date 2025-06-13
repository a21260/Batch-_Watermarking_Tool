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

const targetSize = {
  landscape: [1840, 1160],
  portrait: [1160, 1840]
};

const watermarkPaths = {
  white: './watermark-white.png',
  black: './watermark-black.png'
};

let imagesData = [];
const watermarkPositions = {}; // 記錄每張圖片的浮水印座標

function extractPartNumbers(filename) {
  // 1. 去掉副檔名 (.jpg、.png 等)
  let name = filename.replace(/\.[^/.]+$/, '');

  // 2. 去掉最後面的 (數字) 和其前後空白
  name = name.replace(/\s*\(\d+\)\s*$/, '');

  // 3. 去掉尾端空白
  name = name.trim();

  return `# ${name}`;
}

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

  // 保險：fallback 用右下角
  let wmX = initialPos?.x ?? (targetW - watermarkW) / 2;
  let wmY = initialPos?.y ?? (targetH - watermarkH) / 2;

  let dragging = false;
  let offsetX = 0, offsetY = 0;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, imgX, imgY, drawW, drawH);
    ctx.drawImage(watermarkImg, wmX, wmY, watermarkW, watermarkH);
    ctx.fillStyle = style === 'black' ? '#000' : '#fff';
    ctx.font = '23px "Helvetica Neue Light", "Helvetica Neue", Helvetica, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(extractPartNumbers(fileName), 46.5, targetH - 35);
  }

  draw();

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
    // 記住座標
    watermarkPositions[fileName] = { x: wmX, y: wmY };
  });

  canvas._getBlob = () => new Promise(resolve => {
    draw(); // 再畫一次以確保是最後狀態
    canvas.toBlob(blob => resolve({ blob, name: fileName }), 'image/jpeg', 0.95);
  });

  return canvas;
}

function renderCanvas(file, style, container) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const watermarkImg = new Image();
      watermarkImg.onload = () => {
        const savedPos = watermarkPositions[file.name]; // 傳入舊位置
        const canvas = createCanvasWithDrag(img, watermarkImg, file.name, style, savedPos);
        container.querySelector('canvas')?.remove();
        container.querySelector('.filename-label')?.remove();
        container.appendChild(canvas);

        const label = document.createElement('div');
        label.className = 'filename-label';
        label.textContent = file.name;
        container.appendChild(label);

        canvas._getBlob().then(({ blob, name }) => {
          const index = imagesData.findIndex(d => d.name === name);
          if (index !== -1) imagesData.splice(index, 1);
          imagesData.push({ blob, name });
        });
      };
      watermarkImg.src = watermarkPaths[style]; // ⬅️ 保險：load 事件在 src 後才註冊
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleFiles(event) {
  const files = Array.from(event.target.files);
  const preview = document.getElementById('preview');
  preview.innerHTML = '';
  imagesData = [];

  files.forEach(file => {
    const container = document.createElement('div');
    container.className = 'canvas-container';

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
    preview.appendChild(container);

    renderCanvas(file, 'white', container);
    whiteBtn.classList.add('active');

    whiteBtn.addEventListener('click', () => {
      renderCanvas(file, 'white', container);
      whiteBtn.classList.add('active');
      blackBtn.classList.remove('active');
    });

    blackBtn.addEventListener('click', () => {
      renderCanvas(file, 'black', container);
      blackBtn.classList.add('active');
      whiteBtn.classList.remove('active');
    });
  });
}

document.getElementById('imageInput').addEventListener('change', handleFiles);

document.getElementById('downloadAll').addEventListener('click', async () => {
  const zip = new JSZip();
  const canvases = document.querySelectorAll('canvas');
  if (canvases.length === 0) return alert('請先上傳圖片');

  for (const canvas of canvases) {
    if (typeof canvas._getBlob === 'function') {
      const { blob, name } = await canvas._getBlob();
      zip.file(name, blob);
    }
  }

  zip.generateAsync({ type: 'blob' }).then(content => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = '已上浮水印.zip';
    a.click();
  });
});
