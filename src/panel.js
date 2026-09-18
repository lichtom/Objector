/**
 * Panel Window Script - 独立面板窗口（舞台/角色/输出/音频）
 * 通过 URL 参数 ?type=stage|sprites|output|audio 决定显示哪个面板
 */
(function () {
  const params = new URLSearchParams(location.search);
  const panelType = params.get('type') || 'stage';
  const W = 480, H = 360;

  // 显示对应面板
  document.getElementById(panelType + '-body').style.display = 'flex';
  const labels = { stage: '舞台', sprites: '角色', output: '输出', audio: '音频' };
  document.getElementById('panel-label').textContent = labels[panelType] || panelType;
  document.title = 'Objector - ' + (labels[panelType] || panelType);

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

  // ==================== 舞台面板（纯渲染 + 输入转发） ====================
  if (panelType === 'stage') {
    const canvas = document.getElementById('stage-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = W;
    canvas.height = H;
    let _sprites = [];
    let _dirty = true;
    let _imgCache = {}; // costumeDataUrl -> Image

    // --- 渲染函数 ---
    function renderStage() {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      _sprites.forEach(s => {
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

    // 渲染循环
    function renderLoop() {
      if (_dirty) { _dirty = false; renderStage(); }
      requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);

    // --- 接收编辑器推送的精灵数据 ---
    window.api.onPanelUpdate((data) => {
      if (data.type === 'stage') {
        _sprites = data.sprites || [];
        _dirty = true;
      } else if (data.type === 'title') {
        document.getElementById('pname').textContent = data.name || '未命名项目';
      }
    });

    // --- 输入捕获：通过 IPC 转发给编辑器 ---
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
  }

  // ==================== 角色面板 ====================
  if (panelType === 'sprites') {
    let _sprites = [];
    let _activeIdx = 0;

    function renderSprites() {
      const list = document.getElementById('sprite-list');
      list.innerHTML = '';
      _sprites.forEach((s, i) => {
        const thumb = document.createElement('div');
        thumb.className = 'sprite-thumb' + (i === _activeIdx ? ' active' : '');
        const icon = s.costumeDataUrl ? '🖼️' : '▲';
        thumb.innerHTML = `<span style="font-size:24px;">${icon}</span><span class="sprite-thumb-name">${s.name || '精灵' + (i + 1)}</span>`;
        thumb.addEventListener('click', () => {
          window.api.panelAction('select-sprite', i);
        });
        list.appendChild(thumb);
      });
    }

    window.api.onPanelUpdate((data) => {
      if (data.type === 'sprites') {
        _sprites = data.sprites || [];
        _activeIdx = data.activeIdx || 0;
        renderSprites();
      }
      if (data.type === 'title') {
        document.getElementById('pname').textContent = data.name || '未命名项目';
      }
    });

    document.getElementById('btn-add-sprite').addEventListener('click', () => {
      window.api.panelAction('add-sprite');
    });
    document.getElementById('btn-upload-costume').addEventListener('click', () => {
      window.api.panelAction('upload-costume');
    });
    document.getElementById('btn-set-costume').addEventListener('click', () => {
      window.api.panelAction('set-costume');
    });
    document.getElementById('btn-clear-costume').addEventListener('click', () => {
      window.api.panelAction('clear-costume');
    });
  }

  // ==================== 输出面板 ====================
  if (panelType === 'output') {
    const logEl = document.getElementById('output-log');

    window.api.onPanelUpdate((data) => {
      if (data.type === 'output') {
        if (data.action === 'append') {
          logEl.textContent += data.text;
          logEl.scrollTop = logEl.scrollHeight;
        } else if (data.action === 'clear') {
          logEl.textContent = '';
        } else if (data.action === 'set') {
          logEl.textContent = data.text || '';
          logEl.scrollTop = logEl.scrollHeight;
        }
      }
      if (data.type === 'title') {
        document.getElementById('pname').textContent = data.name || '未命名项目';
      }
    });

    document.getElementById('btn-clear-output').addEventListener('click', () => {
      logEl.textContent = '';
      window.api.panelAction('clear-output');
    });
  }

  // ==================== 音频面板 ====================
  if (panelType === 'audio') {
    let _audioFiles = [];

    function renderAudioList() {
      const list = document.getElementById('audio-list');
      if (_audioFiles.length === 0) {
        list.innerHTML = '<div class="audio-empty">暂无音频文件</div>';
        return;
      }
      list.innerHTML = '';
      _audioFiles.forEach((f, i) => {
        const item = document.createElement('div');
        item.className = 'audio-item';
        item.innerHTML = `<span style="margin-right:4px;">🔊</span><span class="audio-name">${f}</span>
          <button class="audio-btn" data-idx="${i}" data-act="play">▶</button>
          <button class="audio-btn del" data-idx="${i}" data-act="del">✕</button>`;
        list.appendChild(item);
      });
      list.querySelectorAll('.audio-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.idx);
          const act = e.target.dataset.act;
          if (act === 'play') window.api.panelAction('play-audio', _audioFiles[idx]);
          else if (act === 'del') window.api.panelAction('delete-audio', _audioFiles[idx]);
        });
      });
    }

    window.api.onPanelUpdate((data) => {
      if (data.type === 'audio-list') {
        _audioFiles = data.files || [];
        renderAudioList();
      }
      if (data.type === 'title') {
        document.getElementById('pname').textContent = data.name || '未命名项目';
      }
    });

    document.getElementById('btn-add-audio').addEventListener('click', () => {
      window.api.panelAction('add-audio');
    });
    document.getElementById('btn-stop-all-audio').addEventListener('click', () => {
      window.api.panelAction('stop-all-audio');
    });
    // 初始请求音频列表
    window.api.panelAction('request-audio-list');
  }
})();
