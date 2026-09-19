/**
 * Panel Window Script - 独立面板窗口（舞台+输出合并）
 */
(function () {
  const W = 480, H = 360;

  // ==================== 窗口控制按钮 ====================
  let _isPinned = false;
  document.getElementById('btn-pin').addEventListener('click', () => {
    _isPinned = !_isPinned;
    document.getElementById('btn-pin').classList.toggle('pinned', _isPinned);
    window.api.panelSetAlwaysOnTop(_isPinned);
  });
  document.getElementById('btn-minimize').addEventListener('click', () => {
    window.api.panelMinimize();
  });
  document.getElementById('btn-maximize').addEventListener('click', () => {
    window.api.panelMaximize();
  });
  document.getElementById('btn-close').addEventListener('click', () => {
    window.api.panelClose();
  });

  // ==================== 分割条拖拽 ====================
  const divider = document.getElementById('panel-divider');
  const stageArea = document.getElementById('stage-area');
  const outputArea = document.getElementById('output-area');
  let _dragging = false;

  divider.addEventListener('mousedown', (e) => {
    _dragging = true;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (!_dragging) return;
    const bodyRect = document.body.getBoundingClientRect();
    const titlebarH = 28;
    const divH = 4;
    const totalH = bodyRect.height - titlebarH - divH;
    const stageH = Math.max(100, Math.min(totalH - 60, e.clientY - titlebarH));
    stageArea.style.flex = 'none';
    stageArea.style.height = stageH + 'px';
    outputArea.style.flex = '1';
  });
  document.addEventListener('mouseup', () => { _dragging = false; });

  // ==================== 舞台渲染 ====================
  const canvas = document.getElementById('stage-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let _sprites = [];
  let _dirty = true;
  let _imgCache = {};
  let _bgImg = null; // 背景图片 Image 对象（来自舞台精灵的贴图）

  function renderStage() {
    ctx.clearRect(0, 0, W, H);
    // 绘制背景（来自舞台精灵的贴图）
    if (_bgImg && _bgImg.complete) {
      // 保持原比例，缩放到不超出屏幕的最大大小
      const imgW = _bgImg.naturalWidth || _bgImg.width;
      const imgH = _bgImg.naturalHeight || _bgImg.height;
      const scaleX = W / imgW;
      const scaleY = H / imgH;
      const scale = Math.min(scaleX, scaleY);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const dx = (W - dw) / 2;
      const dy = (H - dh) / 2;
      ctx.drawImage(_bgImg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
    }
    _sprites.forEach(s => {
      if (s.isStage) return;  // 舞台精灵不渲染为角色
      if (!s.visible) return;
      ctx.save();
      const cx = W / 2 + (s.x || 0);
      const cy = H / 2 - (s.y || 0);
      ctx.translate(cx, cy);
      if (s.rotationStyle === 'allAround') {
        ctx.rotate(((s.direction || 90) - 90) * Math.PI / 180);
      } else if (s.rotationStyle === 'leftRight') {
        if ((s.direction || 90) > 180) ctx.scale(-1, 1);
      }
      const sc = (s.size || 100) / 100;
      ctx.scale(sc, sc);
      if (s.costumeDataUrl) {
        let img = _imgCache[s.costumeDataUrl];
        if (!img) {
          img = new Image();
          img.src = s.costumeDataUrl;
          _imgCache[s.costumeDataUrl] = img;
          img.onload = () => { _dirty = true; };
        } else if (img.complete) {
          const maxDim = 64;
          let dw = img.width, dh = img.height;
          if (dw > maxDim || dh > maxDim) {
            const ratio = Math.min(maxDim / dw, maxDim / dh);
            dw *= ratio; dh *= ratio;
          }
          ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -18); ctx.lineTo(14, 14); ctx.lineTo(-14, 14); ctx.closePath();
        ctx.fillStyle = s.color || '#4ec9b0'; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-4, -4, 3, 0, Math.PI * 2); ctx.arc(4, -4, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#333';
        ctx.beginPath(); ctx.arc(-3, -4, 1.5, 0, Math.PI * 2); ctx.arc(5, -4, 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      if (s.sayText) {
        ctx.save();
        ctx.font = '12px "Microsoft YaHei",sans-serif';
        const tw = ctx.measureText(s.sayText).width;
        const bx = cx + 20, by = cy - 30;
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
        rrect(ctx, bx, by, tw + 16, 24, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#333';
        ctx.fillText(s.sayText, bx + 8, by + 16);
        ctx.restore();
      }
    });
  }

  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }

  function renderLoop() {
    if (_dirty) { _dirty = false; renderStage(); }
    requestAnimationFrame(renderLoop);
  }
  requestAnimationFrame(renderLoop);

  // ==================== 输出面板 ====================
  const logEl = document.getElementById('output-log');
  document.getElementById('btn-clear-output').addEventListener('click', () => {
    logEl.textContent = '';
  });

  // ==================== IPC 接收 ====================
  window.api.onPanelUpdate((data) => {
    if (data.type === 'stage') {
      _sprites = data.sprites || [];
      // 提取舞台精灵的贴图作为背景
      const stageSprite = _sprites.find(s => s.isStage);
      if (stageSprite && stageSprite.costumeDataUrl) {
        if (!_bgImg || _bgImg.src !== stageSprite.costumeDataUrl) {
          const img = new Image();
          img.onload = () => { _dirty = true; };
          img.src = stageSprite.costumeDataUrl;
          _bgImg = img;
        }
      } else {
        if (_bgImg) {
          _bgImg = null;
          _dirty = true;
        }
      }
      _dirty = true;
    } else if (data.type === 'output') {
      if (data.action === 'append') {
        logEl.textContent += data.text;
        logEl.scrollTop = logEl.scrollHeight;
      } else if (data.action === 'clear') {
        logEl.textContent = '';
      } else if (data.action === 'set') {
        logEl.textContent = data.text || '';
        logEl.scrollTop = logEl.scrollHeight;
      }
    } else if (data.type === 'title') {
      document.getElementById('pname').textContent = data.name || '未命名项目';
    }
  });

  // ==================== 输入捕获 ====================
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) / rect.width * W - W / 2);
    const y = Math.round(-((e.clientY - rect.top) / rect.height * H - H / 2));
    window.api.panelInput('mouse-move', { x, y });
  });
  canvas.addEventListener('mousedown', () => { window.api.panelInput('mouse-down', {}); });
  canvas.addEventListener('mouseup', () => { window.api.panelInput('mouse-up', {}); });
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const wx = Math.round((e.clientX - rect.left) / rect.width * W - W / 2);
    const wy = Math.round(-((e.clientY - rect.top) / rect.height * H - H / 2));
    for (let i = _sprites.length - 1; i >= 0; i--) {
      const s = _sprites[i];
      if (!s.visible) continue;
      const dx = wx - (s.x || 0), dy = wy - (s.y || 0);
      const hitRadius = 30 * ((s.size || 100) / 100);
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        window.api.panelInput('sprite-click', { index: i });
        break;
      }
    }
  });
  const keyMap = { ' ': 'space', 'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right', 'Enter': 'enter', 'Shift': 'shift', 'Control': 'control', 'Alt': 'alt' };
  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const keyName = keyMap[e.key] || e.key.toLowerCase();
    window.api.panelInput('key-down', { key: keyName, raw: e.key });
  });
  document.addEventListener('keyup', (e) => {
    const keyName = keyMap[e.key] || e.key.toLowerCase();
    window.api.panelInput('key-up', { key: keyName, raw: e.key });
  });
})();
