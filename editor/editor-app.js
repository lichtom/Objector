/**
 * 编辑器窗口入口 - 初始化编辑器模块，绑定 UI 事件
 */
window.EditorApp = (function () {
  /**
   * Mobile detection and landscape orientation handling
   */
  function initMobileDetection() {
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || ('ontouchstart' in window && navigator.maxTouchPoints > 1);

    if (!isMobile) return;

    document.body.classList.add('is-mobile');

    function checkOrientation() {
      var isPortrait = window.innerHeight > window.innerWidth;
      document.body.classList.toggle('is-mobile-portrait', isPortrait);
    }

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', function() {
      setTimeout(checkOrientation, 100);
    });

    // Try to lock orientation via Screen Orientation API
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(function() {});
      }
    } catch(e) {}

    // Inject mobile landscape CSS
    if (!document.getElementById('mobile-landscape-css')) {
      var style = document.createElement('style');
      style.id = 'mobile-landscape-css';
      style.textContent = [
        '@media screen and (orientation:portrait) and (max-width:900px) {',
        '  html body.is-mobile { transform:rotate(90deg); transform-origin:0 0; width:100vh; height:100vw; position:absolute; top:0; left:100%; overflow:hidden; }',
        '}',
      ].join('\n');
      document.head.appendChild(style);
    }
  }

  // Run mobile detection immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileDetection);
  } else {
    initMobileDetection();
  }

  /**
   * 自定义 Prompt 对话框（替代 Electron 中禁用的 window.prompt）
   * @param {string} message - 提示文本
   * @param {string} defaultValue - 默认值
   * @returns {Promise<string|null>} 用户输入或 null（取消）
   */
  window.showCustomPrompt = function(message, defaultValue) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('custom-prompt');
      const title = document.getElementById('custom-prompt-title');
      const input = document.getElementById('custom-prompt-input');
      const okBtn = document.getElementById('custom-prompt-ok');
      const cancelBtn = document.getElementById('custom-prompt-cancel');
      if (!overlay || !title || !input || !okBtn || !cancelBtn) {
        resolve(null);
        return;
      }
      title.textContent = message || i18n.t('dialog.prompt');
      input.value = defaultValue || '';
      overlay.classList.remove('hidden');
      setTimeout(() => { input.focus(); input.select(); }, 50);

      function cleanup() {
        overlay.classList.add('hidden');
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        input.onkeydown = null;
        overlay.onclick = null;
      }
      okBtn.onclick = () => { cleanup(); resolve(input.value); };
      cancelBtn.onclick = () => { cleanup(); resolve(null); };
      input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); cleanup(); resolve(input.value); }
        else if (e.key === 'Escape') { e.preventDefault(); cleanup(); resolve(null); }
      };
      overlay.onclick = (e) => { if (e.target === overlay) { cleanup(); resolve(null); } };
    });
  };

  // switchTab kept as no-op for backward compatibility
  function switchTab(tab) {
    if (tab === 'debug') DevMode.refreshWatchPanel();
  }
  window.switchTab = switchTab;

  /** 加载扩展文件（通过文件对话框）并保存到项目 extensions 目录 */
  async function loadExtensionDialog() {
    const filePath = await window.api.selectExtensionFile();
    if (!filePath) return;

    const result = await ExtensionManager.loadFromFile(filePath);
    if (result.ok) {
      // 保存到项目 extensions 目录
      if (EditorState.projectPath && result.id) {
        const extDir = EditorState.projectPath + '/extensions';
        await window.api.ensureDir(extDir);
        const ext = filePath.endsWith('.js') ? '.js' : (filePath.endsWith('.py') ? '.py' : '.json');
        const content = await window.api.readFile(filePath);
        if (content) {
          await window.api.writeFile(extDir + '/' + result.id + ext, content);
          console.log(`扩展已保存到 extensions/${result.id}${ext}`);
        }
      }
      Palette.init();
      document.getElementById('status-text').textContent = i18n.t('status.extLoaded');
      setTimeout(() => {
        document.getElementById('status-text').textContent = i18n.t('status.ready');
      }, 2000);
    } else {
      alert(i18n.t('status.extFailed'));
    }
  }

  /** 加载项目目录下的扩展 */
  async function loadProjectExtensions() {
    if (!EditorState.projectPath) return;
    const count = await ExtensionManager.loadFromProject(EditorState.projectPath);
    if (count > 0) {
      Palette.init();
      console.log(`已加载 ${count} 个扩展`);
    }
  }

  /** 加载项目目录下的声音 */
  async function loadProjectSounds() {
    if (!EditorState.projectPath) return;
    const count = await SoundManager.loadFromProject(EditorState.projectPath);
    if (count > 0) {
      console.log(`已加载 ${count} 个声音`);
      document.getElementById('status-text').textContent = i18n.t('status.soundsLoaded', null).replace('{n}', count);
      setTimeout(() => {
        document.getElementById('status-text').textContent = i18n.t('status.ready');
      }, 2000);
    }
  }

  /** 上传图片到项目造型库 */
  async function uploadCostumeDialog() {
    const filePath = await window.api.selectImageFile();
    if (!filePath) return;

    const name = await CostumeManager.uploadCostume(filePath);
    if (name) {
      document.getElementById('status-text').textContent = i18n.t('status.costumeUploaded', null).replace('{name}', name);
      refreshCostumeLibrary();
      setTimeout(() => {
        document.getElementById('status-text').textContent = i18n.t('status.ready');
      }, 2000);
    } else {
      alert(i18n.t('status.uploadFailed'));
    }
  }

  /** 更换当前精灵的贴图（从造型库选择） */
  async function setCostumeDialog() {
    const names = CostumeManager.getAllNames();
    if (names.length === 0) {
      alert(i18n.t('dialog.emptyCostumeLib'));
      return;
    }

    // 显示造型选择对话框
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-width:500px;width:90%;text-align:left;">
        <h2 style="text-align:center;">${i18n.t('dialog.selectCostume')}</h2>
        <div id="costume-picker" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;max-height:400px;overflow:auto;padding:8px;">
          ${names.map(n => `
            <div class="costume-item" data-name="${n}" style="cursor:pointer;text-align:center;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-tertiary);">
              <img src="file://${CostumeManager.getFilePath(n)}" style="width:48px;height:48px;object-fit:contain;display:block;margin:0 auto;">
              <span style="font-size:10px;color:var(--text-muted);display:block;margin-top:4px;word-break:break-all;">${n}</span>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
          <button id="costume-cancel" class="tb-btn">${i18n.t('dialog.cancel')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#costume-cancel').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });

    overlay.querySelectorAll('.costume-item').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.dataset.name;
        const idx = StageManager.getActiveSpriteIdx();
        const ok = StageManager.setSpriteCostumeByName(idx, name);
        if (ok) {
          const sprite = StageManager.getActiveSprite();
          document.getElementById('status-text').textContent = i18n.t('status.costumeApplied', null).replace('{name}', sprite.name);
        }
        document.body.removeChild(overlay);
        setTimeout(() => {
          document.getElementById('status-text').textContent = i18n.t('status.ready');
        }, 2000);
      });
    });
  }

  /** 刷新造型库显示（在角色面板中） */
  function refreshCostumeLibrary() {
    const container = document.getElementById('costume-library');
    if (!container) return;

    const names = CostumeManager.getAllNames();
    if (names.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:8px;">' + i18n.t('sprites.emptyCostume') + '</div>';
      return;
    }

    container.innerHTML = '';
    names.forEach(name => {
      const div = document.createElement('div');
      div.className = 'costume-thumb';
      div.innerHTML = `
        <img src="file://${CostumeManager.getFilePath(name)}" style="width:32px;height:32px;object-fit:contain;">
        <span style="font-size:9px;color:var(--text-muted);display:block;word-break:break-all;">${name}</span>
      `;
      div.title = name;
      // 单击：应用到当前精灵
      div.addEventListener('click', () => {
        const idx = StageManager.getActiveSpriteIdx();
        StageManager.setSpriteCostumeByName(idx, name);
        document.getElementById('status-text').textContent = i18n.t('status.costumeApplied', null).replace('{name}', name);
        setTimeout(() => { document.getElementById('status-text').textContent = i18n.t('status.ready'); }, 1500);
      });
      // 右键：删除造型
      div.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        if (confirm(i18n.t('dialog.confirmDeleteCostume', null).replace('{name}', name))) {
          await CostumeManager.deleteCostume(name);
          refreshCostumeLibrary();
        }
      });
      container.appendChild(div);
    });
  }
  window.refreshCostumeLibrary = refreshCostumeLibrary;

  /** 清除当前精灵的贴图 */
  function clearCostume() {
    const idx = StageManager.getActiveSpriteIdx();
    StageManager.clearSpriteCostume(idx);
    document.getElementById('status-text').textContent = i18n.t('status.costumeCleared');
    setTimeout(() => {
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }, 2000);
  }

  /** 更新右侧 3 个窗口标题中的项目名 */
  function updateRwinTitles() {
    const name = EditorState.projectName || (i18n.isEnglish() ? 'Untitled' : '未命名项目');
    document.querySelectorAll('.rwin-pname').forEach(el => { el.textContent = name; });
  }

  // ==================== 独立面板窗口通信 ====================
  let _panelsOpened = false;
  let _stagePushTimer = null; // 执行期间高频推送精灵数据到舞台面板
  let _lastStageJSON = '';    // 脏检查：只在数据变化时发送

  function _startStagePushTimer() {
    if (_stagePushTimer) return;
    _stagePushTimer = setInterval(() => { _pushPanelSprites(); }, 33); // ~30fps，足够流畅
  }

  function _stopStagePushTimer() {
    if (_stagePushTimer) { clearInterval(_stagePushTimer); _stagePushTimer = null; }
    _lastStageJSON = '';
  }

  /** 推送精灵数据到面板窗口（带脏检查） */
  function _pushPanelSprites() {
    if (!_panelsOpened || !window.api || !window.api.sendPanelUpdate) return;
    const sprites = (typeof StageManager !== 'undefined') ? StageManager.getSprites() : [];
    const activeIdx = (typeof StageManager !== 'undefined') ? StageManager.getActiveSpriteIdx() : 0;
    // 轻量序列化：只包含关键字段用于脏检查
    const quickCheck = sprites.map(s => `${s.x|0},${s.y|0},${s.direction|0},${s.visible?1:0},${s.sayText||''}`).join(';');
    if (quickCheck === _lastStageJSON) return; // 数据没变，跳过发送
    _lastStageJSON = quickCheck;
    const data = sprites.map(s => ({
      name: s.name, x: s.x || 0, y: s.y || 0,
      direction: s.direction || 90, size: s.size || 100,
      visible: s.visible !== false, color: s.color || '#4ec9b0',
      rotationStyle: s.rotationStyle || 'allAround', sayText: s.sayText || '',
      costumeDataUrl: s.costumeImage ? s.costumeImage.src : null,
      isStage: s.isStage || false,  // 标记舞台精灵
    }));
    window.api.sendPanelUpdate({ type: 'stage', sprites: data });
    window.api.sendPanelUpdate({ type: 'sprites', sprites: data, activeIdx });
  }

  /** 推送项目标题到面板 */
  function _pushPanelTitle() {
    if (!_panelsOpened || !window.api || !window.api.sendPanelUpdate) return;
    window.api.sendPanelUpdate({ type: 'title', name: EditorState.projectName || '' });
  }

  /** 推送音频列表到编辑器本地渲染 */
  async function _pushAudioList() {
    const listEl = document.getElementById('audio-list');
    if (!listEl) return;
    if (!EditorState.projectPath) return;
    try {
      const files = await window.api.listDir(EditorState.projectPath + '/sounds');
      const audioFiles = (files || []).filter(f => /\.(mp3|wav|ogg|m4a|aac)$/i.test(f));
      _renderAudioList(audioFiles);
    } catch(e) {
      _renderAudioList([]);
    }
  }

  /** 渲染音频列表到编辑器 */
  function _renderAudioList(audioFiles) {
    const listEl = document.getElementById('audio-list');
    if (!listEl) return;
    if (audioFiles.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:8px;font-size:11px;">暂无音频</div>';
      return;
    }
    listEl.innerHTML = '';
    audioFiles.forEach((f, i) => {
      const item = document.createElement('div');
      item.className = 'audio-item';
      item.innerHTML = `<span class="audio-name">${f}</span>
        <button class="audio-btn" data-idx="${i}" data-act="play">▶</button>
        <button class="audio-btn del" data-idx="${i}" data-act="del"><img src="../icons/窗口操作图标/关闭.svg" class="tb-icon" style="height:10px;margin:0;"></button>`;
      listEl.appendChild(item);
    });
    listEl.querySelectorAll('.audio-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.dataset.idx);
        const act = e.currentTarget.dataset.act;
        if (act === 'play' && typeof SoundManager !== 'undefined') {
          SoundManager.play(audioFiles[idx]);
        } else if (act === 'del') {
          _deleteAudioFile(audioFiles[idx]);
        }
      });
    });
  }

  /** 添加音频文件 */
  async function _addAudioFile() {
    if (!EditorState.projectPath) return;
    const filePath = await window.api.selectAudioFile();
    if (!filePath) return;
    try {
      const fileName = filePath.replace(/\\/g, '/').split('/').pop();
      const dest = EditorState.projectPath + '/sounds/' + fileName;
      await window.api.copyFile(filePath, dest);
      if (typeof SoundManager !== 'undefined') {
        await SoundManager.loadSound(dest);
      }
      _pushAudioList();
    } catch(e) {
      console.warn('[Audio] 添加音频失败:', e);
    }
  }

  /** 删除音频文件 */
  async function _deleteAudioFile(fileName) {
    if (!EditorState.projectPath || !fileName) return;
    try {
      await window.api.deleteFile(EditorState.projectPath + '/sounds/' + fileName);
      _pushAudioList();
    } catch(e) {
      console.warn('[Audio] 删除音频失败:', e);
    }
  }

  /** 打开面板并监听操作（普通模式 + 高级模式） */
  function _initPanels() {
    console.log('[Panel] _initPanels called, projectMode:', EditorState.projectMode, 'api:', !!window.api, 'openPanels:', !!(window.api && window.api.openPanels));
    if (_panelsOpened) { console.log('[Panel] already opened, skip'); return; }
    if (!window.api || !window.api.openPanels) { console.warn('[Panel] API not available'); return; }
    const _pm0 = EditorState.projectMode || 'normal';
    if (_pm0 !== 'normal' && _pm0 !== 'advanced' && _pm0 !== 'extension' && !_pm0.startsWith('code-')) { console.log('[Panel] mode ' + _pm0 + ' 不打开面板, skip'); return; }
    console.log('[Panel] Opening panels...');
    window.api.openPanels().then(() => {
      _panelsOpened = true;
      console.log('[Panel] Panels opened successfully');
      setTimeout(() => { _pushPanelTitle(); _pushPanelSprites(); _pushAudioList();
        // 推送渲染模式给面板窗口
        const rm = (typeof EditorState !== 'undefined' && EditorState.renderMode) || '2d';
        if (window.api && window.api.sendPanelUpdate) {
          window.api.sendPanelUpdate({ type: 'render-mode', renderMode: rm });
        }
      }, 600);
    }).catch(e => console.warn('[Panel] openPanels failed:', e));
    // 监听面板操作
    if (window.api.onPanelAction) {
      window.api.onPanelAction((action, data) => {
        if (action === 'select-sprite' && typeof StageManager !== 'undefined') {
          StageManager.setActiveSprite(data); _pushPanelSprites();
        } else if (action === 'add-sprite' && typeof StageManager !== 'undefined') {
          const s = StageManager.addSprite((i18n.isEnglish() ? 'Sprite' : '精灵') + (StageManager.getSprites().length + 1));
          const idx = StageManager.getSprites().indexOf(s);
          if (idx >= 0) StageManager.setActiveSprite(idx);
          _pushPanelSprites();
        } else if (action === 'upload-costume' && typeof uploadCostumeDialog === 'function') uploadCostumeDialog();
        else if (action === 'set-costume' && typeof setCostumeDialog === 'function') setCostumeDialog();
        else if (action === 'clear-costume' && typeof clearCostume === 'function') clearCostume();
        else if (action === 'clear-output') {
          if (typeof Executor !== 'undefined') Executor.clearOutput();
          const logEl = document.getElementById('output-log');
          if (logEl) logEl.textContent = '';
        }
        // 音频面板操作
        else if (action === 'request-audio-list') _pushAudioList();
        else if (action === 'play-audio' && typeof SoundManager !== 'undefined') SoundManager.play(data);
        else if (action === 'stop-all-audio' && typeof SoundManager !== 'undefined') SoundManager.stopAll();
        else if (action === 'add-audio') _addAudioFile();
        else if (action === 'delete-audio') _deleteAudioFile(data);
        // 面板请求渲染模式（面板窗口重建后的安全保障）
        else if (action === 'request-render-mode') {
          const rm = (typeof EditorState !== 'undefined' && EditorState.renderMode) || '2d';
          if (window.api && window.api.sendPanelUpdate) {
            window.api.sendPanelUpdate({ type: 'render-mode', renderMode: rm });
          }
        }
      });
    }
  }

  /** 显示项目所有代码文件 */
  async function showAllCodeDialog() {
    if (!EditorState.projectPath) {
      alert(i18n.t('status.openProjectFirst'));
      return;
    }

    const files = await window.api.readDirRecursive(EditorState.projectPath);
    if (!files || files.length === 0) {
      alert(i18n.t('status.projectEmpty'));
      return;
    }

    // 过滤文本类文件
    const textFiles = files.filter(f => /\.(json|js|ts|txt|md|html|css|xml|csv)$/i.test(f.path));

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-width:800px;width:90%;max-height:85vh;text-align:left;display:flex;flex-direction:column;">
        <h2 style="text-align:center;">${i18n.t('dialog.codeViewer', null).replace('{n}', textFiles.length)}</h2>
        <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;">
          ${textFiles.map((f, i) => `<button class="tb-btn code-file-tab${i === 0 ? ' active' : ''}" data-idx="${i}" style="font-size:11px;padding:3px 8px;">${f.path}</button>`).join('')}
        </div>
        <div style="flex:1;overflow:auto;background:var(--bg-primary);border-radius:6px;border:1px solid var(--border);">
          <pre id="code-viewer" style="padding:12px;font-family:'Cascadia Code','Consolas',monospace;font-size:12px;color:var(--text-primary);white-space:pre-wrap;word-break:break-all;line-height:1.6;margin:0;"></pre>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
          <button id="code-copy" class="tb-btn">${i18n.t('dialog.copyFile')}</button>
          <button id="code-close" class="tb-btn">${i18n.t('dialog.close')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const viewer = overlay.querySelector('#code-viewer');
    let currentIdx = 0;

    function showFile(idx) {
      currentIdx = idx;
      const f = textFiles[idx];
      viewer.textContent = `// 📄 ${f.path}\n${'='.repeat(60)}\n\n${f.content}`;
      overlay.querySelectorAll('.code-file-tab').forEach((btn, i) => {
        btn.classList.toggle('active', i === idx);
      });
    }

    showFile(0);

    overlay.querySelectorAll('.code-file-tab').forEach(btn => {
      btn.addEventListener('click', () => showFile(Number(btn.dataset.idx)));
    });

    overlay.querySelector('#code-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(textFiles[currentIdx].content).then(() => {
        overlay.querySelector('#code-copy').textContent = i18n.t('dialog.copied');
        setTimeout(() => { overlay.querySelector('#code-copy').textContent = i18n.t('dialog.copyFile'); }, 1500);
      });
    });

    overlay.querySelector('#code-close').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
  }

  /** 保存项目到本地 ZIP（使用 File System Access API + JSZip） */
  async function saveProjectToLocal() {
    if (!EditorState.projectPath) {
      alert(i18n.t('status.openProjectFirst'));
      return;
    }

    // 检查浏览器支持
    if (!window.showDirectoryPicker) {
      alert(i18n.isEnglish()
        ? 'Your browser does not support File System Access API. Please use Chrome/Edge.'
        : '您的浏览器不支持 File System Access API，请使用 Chrome 或 Edge。');
      return;
    }

    const projectName = EditorState.projectName || 'project';
    document.getElementById('status-text').textContent = i18n.isEnglish() ? 'Saving to local...' : '正在保存到本地...';

    try {
      // 先保存到 VFS
      await ProjectManager.saveProject();
      EditorState._isDirty = false;
      EditorState._blocksSnapshot = JSON.stringify(EditorState.blocks);

      // 选择保存文件夹
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

      // 收集当前项目的所有文件
      const projectPath = EditorState.projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
      const vfsPrefix = 'vfs:';
      const vfsbPrefix = 'vfsb:';
      const projectPrefix = projectPath + '/';
      const zip = new JSZip();

      // 遍历 localStorage 收集项目文件
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        let filePath = null;
        let isBinary = false;

        if (key.startsWith(vfsPrefix) && !key.endsWith('/__dir__')) {
          filePath = key.slice(vfsPrefix.length);
        } else if (key.startsWith(vfsbPrefix)) {
          filePath = key.slice(vfsbPrefix.length);
          isBinary = true;
        }

        if (!filePath || !filePath.startsWith(projectPrefix)) continue;

        const relativePath = filePath.slice(projectPrefix.length);
        const content = localStorage.getItem(key);
        if (!content) continue;

        if (isBinary) {
          // base64 data URL 转二进制
          try {
            const base64Data = content.split(',')[1];
            if (base64Data) {
              zip.file(relativePath, base64Data, { base64: true });
            }
          } catch (e) {
            console.warn('[saveToLocal] 无法解码二进制文件:', relativePath, e);
          }
        } else {
          zip.file(relativePath, content);
        }
      }

      // 生成 ZIP Blob
      const zipBlob = await zip.generateAsync({ type: 'uint8array' });

      // 在选择的文件夹中创建 ZIP 文件
      const zipFileName = projectName + '.zip';
      const fileHandle = await dirHandle.getFileHandle(zipFileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(zipBlob);
      await writable.close();

      document.getElementById('status-text').textContent =
        (i18n.isEnglish() ? 'Saved to local: ' : '已保存到本地: ') + zipFileName;
      setTimeout(() => {
        document.getElementById('status-text').textContent = i18n.t('status.ready');
      }, 3000);

    } catch (e) {
      if (e.name === 'AbortError') {
        // 用户取消了文件夹选择
        document.getElementById('status-text').textContent = i18n.t('status.ready');
        return;
      }
      console.error('[saveToLocal] 保存失败:', e);
      alert((i18n.isEnglish() ? 'Save to local failed: ' : '保存到本地失败: ') + e.message);
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }
  }

  /** 显示发布弹窗（美观替代 prompt） */
  function showPublishDialog(projectName, options, onConfirm, onCancel) {
    options = options || {};
    const overlay = document.createElement('div');
    overlay.className = 'publish-dialog-overlay';
    const isEN = i18n.isEnglish();
    const isExt = options.isExtension;
    const existingProject = options.existingProject;
    const existingExtension = options.existingExtension;

    // 已发布警告 (项目)
    let existingProjectHtml = '';
    if (existingProject) {
      var warnTitle = isEN ? 'This project has been published before' : '该作品曾经发布过';
      var warnDesc = existingProject.description ? CommunityAPI.escapeHtml(existingProject.description).slice(0, 60) : (isEN ? 'No description' : '无描述');
      var updateLabel = isEN ? 'Update existing (overwrite)' : '更新已有作品\uff08覆盖\uff09';
      var copyLabel = isEN ? 'Create a new copy' : '创建新副本';
      existingProjectHtml =
        '<div class="publish-warning">' +
          '<span class="publish-warning-icon">⚠️</span>' +
          '<div>' +
            '<div class="publish-warning-title">' + warnTitle + '</div>' +
            '<div class="publish-warning-desc">「' + CommunityAPI.escapeHtml(existingProject.title) + '」 - ' + warnDesc + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="publish-choice">' +
          '<label class="publish-radio">' +
            '<input type="radio" name="project-action" value="update" checked />' +
            '<span>' + updateLabel + '</span>' +
          '</label>' +
          '<label class="publish-radio">' +
            '<input type="radio" name="project-action" value="copy" />' +
            '<span>' + copyLabel + '</span>' +
          '</label>' +
        '</div>';
    }

    // 已发布警告 (扩展)
    let existingExtHtml = '';
    if (existingExtension) {
      var extWarnTitle = isEN ? 'This extension has been published before' : '该扩展曾经发布过';
      var extWarnDesc = existingExtension.description ? CommunityAPI.escapeHtml(existingExtension.description).slice(0, 60) : (isEN ? 'No description' : '无描述');
      var extUpdateLabel = isEN ? 'Update existing extension' : '更新已有扩展\uff08覆盖\uff09';
      var extCopyLabel = isEN ? 'Create a new extension' : '创建新扩展';
      existingExtHtml =
        '<div class="publish-warning">' +
          '<span class="publish-warning-icon">⚠️</span>' +
          '<div>' +
            '<div class="publish-warning-title">' + extWarnTitle + '</div>' +
            '<div class="publish-warning-desc">「' + CommunityAPI.escapeHtml(existingExtension.name) + '」 v' + CommunityAPI.escapeHtml(existingExtension.version || '1.0.0') + ' - ' + extWarnDesc + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="publish-choice">' +
          '<label class="publish-radio">' +
            '<input type="radio" name="ext-action" value="update" checked />' +
            '<span>' + extUpdateLabel + '</span>' +
          '</label>' +
          '<label class="publish-radio">' +
            '<input type="radio" name="ext-action" value="copy" />' +
            '<span>' + extCopyLabel + '</span>' +
          '</label>' +
        '</div>';
    }

    // 扩展项目发布方式选择
    let publishModeHtml = '';
    if (isExt) {
      var modeExtOnly = isEN ? 'Extension only' : '仅发布扩展';
      var modeBoth = isEN ? 'Extension + Project' : '发布扩展 + 作品';
      publishModeHtml =
        '<div class="publish-mode-section">' +
          '<label class="publish-mode-label">' + (isEN ? 'Publish Mode' : '发布方式') + '</label>' +
          '<div class="publish-choice">' +
            '<label class="publish-radio">' +
              '<input type="radio" name="publish-mode" value="ext_only" checked />' +
              '<span>' + modeExtOnly + '</span>' +
            '</label>' +
            '<label class="publish-radio">' +
              '<input type="radio" name="publish-mode" value="both" />' +
              '<span>' + modeBoth + '</span>' +
            '</label>' +
          '</div>' +
        '</div>';
    }

    // 版本号输入 (仅扩展项目显示)
    let versionHtml = '';
    if (isExt) {
      versionHtml =
        '<div class="publish-field publish-field-version">' +
          '<label>' + (isEN ? 'Version' : '版本号') + '</label>' +
          '<input type="text" id="publish-version" value="1.0.0" maxlength="20" />' +
        '</div>';
    }

    overlay.innerHTML =
      '<div class="publish-dialog">' +
        '<div class="publish-dialog-header">' +
          '<h3>\ud83d\ude80 ' + (isEN ? 'Publish to Community' : '发布到社区') + '</h3>' +
          '<button class="publish-close" type="button">&times;</button>' +
        '</div>' +
        '<div class="publish-dialog-body">' +
          publishModeHtml +
          existingExtHtml +
          existingProjectHtml +
          '<div class="publish-field">' +
            '<label>' + (isEN ? 'Title' : '作品标题') + '</label>' +
            '<input type="text" id="publish-title" value="' + CommunityAPI.escapeHtml(projectName) + '" maxlength="100" />' +
          '</div>' +
          versionHtml +
          '<div class="publish-field">' +
            '<label>' + (isEN ? 'Description' : '作品描述') + '</label>' +
            '<textarea id="publish-desc" rows="4" placeholder="' + (isEN ? 'Describe your project...' : '为你的作品写一段描述...') + '"></textarea>' +
            '<div class="publish-char-count"><span id="desc-count">0</span>/500</div>' +
          '</div>' +
        '</div>' +
        '<div class="publish-dialog-footer">' +
          '<button class="publish-btn publish-btn-cancel" type="button">' + (isEN ? 'Cancel' : '取消') + '</button>' +
          '<button class="publish-btn publish-btn-confirm" type="button">' + (isEN ? 'Publish' : '发布') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // 字符计数
    const descEl = overlay.querySelector('#publish-desc');
    const countEl = overlay.querySelector('#desc-count');
    descEl.addEventListener('input', () => { countEl.textContent = descEl.value.length; });

    // 关闭
    function close() {
      overlay.remove();
      if (onCancel) onCancel();
    }
    overlay.querySelector('.publish-close').addEventListener('click', close);
    overlay.querySelector('.publish-btn-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // 确认
    overlay.querySelector('.publish-btn-confirm').addEventListener('click', () => {
      const title = overlay.querySelector('#publish-title').value.trim();
      const desc = descEl.value.trim();
      if (!title) {
        overlay.querySelector('#publish-title').style.borderColor = 'var(--red, #f38ba8)';
        return;
      }
      let version = '1.0.0';
      if (isExt) {
        version = overlay.querySelector('#publish-version').value.trim() || '1.0.0';
      }
      // 发布模式
      let publishMode = 'project';
      if (isExt) {
        const modeRadios = overlay.querySelectorAll('input[name="publish-mode"]');
        modeRadios.forEach(r => { if (r.checked) publishMode = r.value; });
      }
      // 项目 action
      let projectAction = 'create';
      if (existingProject) {
        overlay.querySelectorAll('input[name="project-action"]').forEach(r => { if (r.checked) projectAction = r.value; });
      }
      // 扩展 action
      let extAction = 'create';
      if (existingExtension) {
        overlay.querySelectorAll('input[name="ext-action"]').forEach(r => { if (r.checked) extAction = r.value; });
      }
      overlay.remove();
      onConfirm({
        title, description: desc, version,
        publishMode,
        projectAction, projectExistingId: existingProject ? existingProject.id : null,
        extAction, extExistingId: existingExtension ? existingExtension.id : null,
        extId: options.extId || null,
      });
    });
  }

  /** 发布项目到社区 */
  async function publishToCommunity() {
    if (!EditorState.projectPath) {
      alert(i18n.t('status.openProjectFirst'));
      return;
    }

    if (typeof CommunityAPI === 'undefined') {
      alert(i18n.isEnglish()
        ? 'Community module not loaded. Please check your network connection.'
        : '社区模块未加载，请检查网络连接。');
      return;
    }

    CommunityAPI.init();
    if (!CommunityAPI.isConfigured()) {
      alert(i18n.isEnglish()
        ? 'Community is not configured yet. Please set up Supabase first.'
        : '社区尚未配置，请先设置 Supabase。');
      return;
    }

    // 恢复登录状态
    await CommunityAPI.restoreSession();

    if (!CommunityAPI.getUser()) {
      alert(i18n.isEnglish()
        ? 'Please login from the home page before publishing.'
        : '请先回到主页登录，然后再发布。');
      return;
    }

    const projectName = EditorState.projectName || '未命名项目';
    const isExtension = EditorState.projectMode === 'extension';

    // 检测是否已发布过同名作品
    let existingProject = null;
    let existingExtension = null;
    let extId = null;
    try {
      existingProject = await CommunityAPI.getUserProjectByTitle(CommunityAPI.getUser().id, projectName);
    } catch (e) {
      console.warn('[publish] 检查已有作品失败:', e);
    }

    // 如果是扩展项目，收集扩展文件并检测已有扩展
    let extensionFileContent = null;
    if (isExtension) {
      const projectPath = EditorState.projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
      const vfsPrefix = 'vfs:';
      const extDir = projectPath + '/extensions/';

      // 收集扩展目录下的文件
      let extFiles = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key.startsWith(vfsPrefix)) continue;
        const filePath = key.slice(vfsPrefix.length);
        if (filePath.startsWith(extDir) && !filePath.endsWith('/__dir__')) {
          const fileName = filePath.slice(extDir.length);
          const content = localStorage.getItem(key);
          if (content) {
            extFiles.push({ name: fileName, content: content });
          }
        }
      }

      // 取第一个扩展文件作为主要内容
      if (extFiles.length > 0) {
        // 尝试解析 JSON 提取 extId 和 version
        try {
          const parsed = JSON.parse(extFiles[0].content);
          extId = parsed.id || parsed.ext_id || projectName.replace(/\s+/g, '_').toLowerCase();
        } catch (e) {
          extId = projectName.replace(/\s+/g, '_').toLowerCase();
        }
        extensionFileContent = extFiles[0].content;
      }

      // 检测已有扩展
      if (extId) {
        try {
          existingExtension = await CommunityAPI.getUserExtensionByName(CommunityAPI.getUser().id, projectName);
        } catch (e) {
          console.warn('[publish] 检查已有扩展失败:', e);
        }
      }
    }

    // 显示发布弹窗
    showPublishDialog(projectName, {
      isExtension,
      existingProject,
      existingExtension,
      extId,
    }, async (formData) => {
      document.getElementById('status-text').textContent = i18n.isEnglish() ? 'Publishing to community...' : '正在发布到社区...';

      try {
        // 先保存到 VFS
        await ProjectManager.saveProject();
        EditorState._isDirty = false;
        EditorState._blocksSnapshot = JSON.stringify(EditorState.blocks);

        let projectId = null;
        let extResultId = null;

        // ===== 发布扩展 =====
        if (isExtension && (formData.publishMode === 'ext_only' || formData.publishMode === 'both')) {
          // 重新收集扩展文件（发布时可能已修改）
          let currentExtFileContent = extensionFileContent;
          if (!currentExtFileContent) {
            const pp = EditorState.projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
            const vfsPfx = 'vfs:';
            const eDir = pp + '/extensions/';
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (!k.startsWith(vfsPfx)) continue;
              const fp = k.slice(vfsPfx.length);
              if (fp.startsWith(eDir) && !fp.endsWith('/__dir__')) {
                const c = localStorage.getItem(k);
                if (c) { currentExtFileContent = c; break; }
              }
            }
          }

          if (!currentExtFileContent) {
            const noFileMsg = i18n.isEnglish()
              ? 'No extension files found in extensions/ directory. Please create and save at least one .json / .js / .py file.'
              : '未找到扩展文件。请在 extensions/ 目录下新建并保存至少一个 .json / .js / .py 文件。';
            alert(noFileMsg);
            document.getElementById('status-text').textContent = i18n.t('status.ready');
            return;
          }

          let extResult;
          if (formData.extAction === 'update' && formData.extExistingId) {
            extResult = await CommunityAPI.updateExtension(formData.extExistingId, {
              name: formData.title,
              description: formData.description,
              version: formData.version,
            }, currentExtFileContent);
            extResultId = formData.extExistingId;
          } else {
            extResult = await CommunityAPI.publishExtension(
              formData.title,
              formData.extId || projectName.replace(/\s+/g, '_').toLowerCase(),
              formData.description,
              formData.version,
              currentExtFileContent
            );
            extResultId = extResult.data?.id;
          }

          if (extResult.error) {
            const extErrMsg = (i18n.isEnglish() ? 'Extension publish failed: ' : '扩展发布失败: ') + (extResult.error.message || extResult.error);
            if (formData.publishMode === 'ext_only') {
              alert(extErrMsg);
              document.getElementById('status-text').textContent = i18n.t('status.ready');
              return;
            } else {
              console.warn('[publish]', extErrMsg);
            }
          }
        }

        // ===== 发布作品 =====
        if (!isExtension || formData.publishMode === 'both') {
          // 收集项目文件并生成 ZIP
          const projectPath = EditorState.projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
          const vfsPrefix = 'vfs:';
          const vfsbPrefix = 'vfsb:';
          const projectPrefix = projectPath + '/';
          const zip = new JSZip();
          let mainJsonData = null;
          let projectRenderMode = '2d';

          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            let filePath = null;
            let isBinary = false;

            if (key.startsWith(vfsPrefix) && !key.endsWith('/__dir__')) {
              filePath = key.slice(vfsPrefix.length);
            } else if (key.startsWith(vfsbPrefix)) {
              filePath = key.slice(vfsbPrefix.length);
              isBinary = true;
            }

            if (!filePath || !filePath.startsWith(projectPrefix)) continue;

            const relativePath = filePath.slice(projectPrefix.length);
            const content = localStorage.getItem(key);
            if (!content) continue;

            if ((relativePath === 'main.json' || relativePath === 'scripts/main.json') && !isBinary) {
              mainJsonData = content;
            }

            if (isBinary) {
              try {
                const base64Data = content.split(',')[1];
                if (base64Data) zip.file(relativePath, base64Data, { base64: true });
              } catch (e) {
                console.warn('[publish] 无法解码二进制文件:', relativePath, e);
              }
            } else {
              zip.file(relativePath, content);
            }
          }

          // 读取 project.json 获取渲染模式
          try {
            const cfgStr = localStorage.getItem('vfs:' + projectPath + '/project.json');
            if (cfgStr) {
              const cfg = JSON.parse(cfgStr);
              if (cfg.renderMode) projectRenderMode = cfg.renderMode;
            }
          } catch(e) {}

          const zipBlob = new Blob([await zip.generateAsync({ type: 'uint8array' })], { type: 'application/zip' });

          if (formData.projectAction === 'update' && formData.projectExistingId) {
            const projResult = await CommunityAPI.updateProject(formData.projectExistingId, {
              title: formData.title,
              description: formData.description,
              json_data: mainJsonData,
              render_mode: projectRenderMode,
            }, zipBlob);
            projectId = formData.projectExistingId;
            if (projResult.error) {
              alert((i18n.isEnglish() ? 'Project publish failed: ' : '作品发布失败: ') + (projResult.error.message || projResult.error));
              document.getElementById('status-text').textContent = i18n.t('status.ready');
              return;
            }
          } else {
            const projResult = await CommunityAPI.publishProject({
              title: formData.title,
              description: formData.description,
              json_data: mainJsonData,
              render_mode: projectRenderMode,
              is_public: true
            }, zipBlob);
            projectId = projResult.data?.id || projResult.data?.[0]?.id;
            if (projResult.error) {
              alert((i18n.isEnglish() ? 'Project publish failed: ' : '作品发布失败: ') + (projResult.error.message || projResult.error));
              document.getElementById('status-text').textContent = i18n.t('status.ready');
              return;
            }
          }
        }

        // 成功
        const isEN = i18n.isEnglish();
        let successMsg;
        if (isExtension && formData.publishMode === 'ext_only') {
          successMsg = isEN ? 'Extension published!' : '扩展已发布！';
        } else if (isExtension && formData.publishMode === 'both') {
          successMsg = isEN ? 'Extension & project published!' : '扩展与作品已发布！';
        } else {
          successMsg = isEN ? 'Published to community!' : '已发布到社区！';
        }

        document.getElementById('status-text').textContent = successMsg;
        setTimeout(() => {
          document.getElementById('status-text').textContent = i18n.t('status.ready');
        }, 3000);

        // 查看
        let viewUrl = null;
        if (projectId) {
          viewUrl = '../community/project-detail.html?id=' + projectId;
        } else if (extResultId) {
          viewUrl = '../community/extension-detail.html?id=' + extResultId;
        }

        if (viewUrl && confirm((isEN ? 'Published! View in community?' : '发布成功！是否在社区中查看？'))) {
          window.open(viewUrl, '_blank');
        }

      } catch (e) {
        console.error('[publish] 发布失败:', e);
        alert((i18n.isEnglish() ? 'Publish failed: ' : '发布失败: ') + e.message);
        document.getElementById('status-text').textContent = i18n.t('status.ready');
      }
    });
  }

  // ============================================================
  // 高级模式 (Godot-style) 初始化
  // ============================================================
  let _codeMirrorInstance = null;
  let _spriteScripts = {}; // scene -> { index -> JS code }  按场景存储
  let _spriteBlocks = {};  // scene -> { index -> blocks }  按场景存储（像JS代码一样独立于sprite对象）
  let _nodeScripts = {};   // scene -> { nodeId -> JS code }  按场景存储
  let _advancedInitialized = false;
  let _editorSpriteIdx = -1;  // 当前编辑器关联的精灵索引（不依赖 SceneGraph 选中状态）
  let _jsSaveTimer = null;    // JS 防抖保存定时器（模块级，切换标签时可清除）

  // ========== 精灵标签页系统 ==========
  let _spriteTabs = [];       // [{spriteIdx, spriteName}]
  let _activeTabIdx = -1;     // 当前激活的标签页索引
  let _currentSubTab = 'blocks'; // 当前子标签: 'blocks' | 'js'

  /** 获取当前场景名（用于存储 key） */
  function _curScene() {
    return (typeof EditorState !== 'undefined' && EditorState._currentSceneName) ? EditorState._currentSceneName : 'main';
  }
  /** 获取当前场景的精灵脚本对象 */
  function _getSceneScripts() {
    const s = _curScene();
    if (!_spriteScripts[s]) _spriteScripts[s] = {};
    return _spriteScripts[s];
  }
  /** 获取当前场景的节点脚本对象 */
  function _getSceneNodeScripts() {
    const s = _curScene();
    if (!_nodeScripts[s]) _nodeScripts[s] = {};
    return _nodeScripts[s];
  }

  /** 设置编辑器当前关联的精灵索引（供 SceneTree.selectNode 调用） */
  function setEditorSpriteIdx(idx) { _editorSpriteIdx = idx; }
  /** 获取编辑器当前关联的精灵索引 */
  function getEditorSpriteIdx() { return _editorSpriteIdx; }

  function initAdvancedMode() {
    if (_advancedInitialized) return;
    _advancedInitialized = true;

    const mainLayout = document.getElementById('main-layout');
    const advancedLayout = document.getElementById('advanced-layout');
    if (!mainLayout || !advancedLayout) return;

    // 将面板恢复到 main-layout（可能被 MC 模式或其他模式移走了）
    const palettePanel = document.getElementById('palette-panel');
    const editorPanel = document.getElementById('editor-panel');
    if (palettePanel && palettePanel.parentNode !== mainLayout) {
      mainLayout.insertBefore(palettePanel, mainLayout.firstChild);
    }
    if (editorPanel && editorPanel.parentNode !== mainLayout) {
      palettePanel?.parentNode?.insertBefore(editorPanel, palettePanel.nextSibling);
    }

    // 切换布局
    mainLayout.classList.add('hidden');
    advancedLayout.classList.remove('hidden');

    // 将 palette 和 editor 移入 script-blocks-content
    const blocksContent = document.getElementById('script-blocks-content');
    if (palettePanel && blocksContent) blocksContent.appendChild(palettePanel);
    if (editorPanel && blocksContent) blocksContent.appendChild(editorPanel);

    // 舞台和输出使用独立面板窗口（与普通模式相同）
    _lastStageJSON = '';
    _initPanels();

    // 初始化 SceneGraph（场景图核心）
    const renderMode = (typeof EditorState !== 'undefined' && EditorState.renderMode) || '2d';
    if (typeof SceneGraph !== 'undefined') {
      SceneGraph.init(renderMode);
      if (typeof StageManager !== 'undefined') {
        StageManager.syncFromSceneGraph();
      }
    }

    // 初始化场景树、检查器和文件系统
    if (typeof SceneTree !== 'undefined') SceneTree.init();
    if (typeof Inspector !== 'undefined') Inspector.init();
    if (typeof FileSystemDock !== 'undefined') FileSystemDock.init();

    // 初始化积木画布
    setTimeout(() => {
      if (typeof EditorCanvas !== 'undefined') {
        EditorCanvas.resize();
        EditorCanvas.render();
      }
    }, 100);

    // 初始化 CodeMirror（JS 代码编辑器）
    const jsEditorEl = document.getElementById('js-editor');
    if (jsEditorEl && typeof CodeMirror !== 'undefined' && !_codeMirrorInstance) {
      _codeMirrorInstance = CodeMirror(jsEditorEl, {
        mode: 'javascript',
        theme: 'material-darker',
        lineNumbers: true,
        tabSize: 2,
        indentWithTabs: false,
        matchBrackets: true,
        autoCloseBrackets: true,
        value: '// 在此编写 JavaScript 代码\n// 可用对象：sprite（当前角色）、globalVars（全局变量）\n',
      });
      // 实时保存 JS 代码到当前标签页的精灵
      _codeMirrorInstance.on('change', () => {
        if (_activeTabIdx < 0) return;
        const tab = _spriteTabs[_activeTabIdx];
        if (!tab) return;
        const sp = _getSceneScripts();
        sp[tab.spriteIdx] = _codeMirrorInstance.getValue();
        clearTimeout(_jsSaveTimer);
        _jsSaveTimer = setTimeout(() => {
          if (EditorState.projectMode === 'advanced' && EditorState.projectPath) {
            _saveSceneJsScripts();
          }
        }, 1500);
      });
    }

    // 子标签切换（积木 / JS）
    const subTabBtns = document.querySelectorAll('#sprite-script-tabs .script-tab');
    subTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        _currentSubTab = btn.dataset.tab;
        subTabBtns.forEach(t => t.classList.toggle('active', t === btn));
        const blocksEl = document.getElementById('script-blocks-content');
        const jsEl = document.getElementById('script-js-content');
        if (_currentSubTab === 'blocks') {
          if (blocksEl) blocksEl.classList.remove('hidden');
          if (jsEl) jsEl.classList.add('hidden');
          setTimeout(() => {
            if (typeof EditorCanvas !== 'undefined') { EditorCanvas.resize(); EditorCanvas.render(); }
          }, 50);
        } else {
          if (blocksEl) blocksEl.classList.add('hidden');
          if (jsEl) jsEl.classList.remove('hidden');
          if (_codeMirrorInstance) setTimeout(() => _codeMirrorInstance.refresh(), 50);
        }
      });
    });

    // 自动选中第一个节点
    setTimeout(() => {
      if (typeof SceneGraph !== 'undefined' && typeof Inspector !== 'undefined') {
        const root = SceneGraph.getRoot();
        if (root && root.children && root.children.length > 0) {
          SceneTree.selectNode(root.children[0]);
        } else if (root) {
          Inspector.showNode(root.id);
        }
      }
    }, 100);

    // 注册 JS 脚本回调（周期性执行，与积木和事件循环同步）
    if (typeof Executor !== 'undefined' && Executor.setPostStartCallback) {
      Executor.setPostStartCallback(async () => {
        await runAdvancedScripts();
      });
      console.log('[高级模式] JS 脚本回调已注册');
    } else {
      console.warn('[高级模式] Executor 或 setPostStartCallback 不可用!');
    }

    console.log('[高级模式] Godot 式编辑器已初始化');
  }

  /** 初始化数据分析模式 */
  function initDataMode() {
    if (typeof DataAnalysis !== 'undefined') {
      DataAnalysis.init();
    }
    console.log('[数据分析模式] 已初始化');
  }

  /** 初始化 Minecraft 模组开发模式 */
  function initMinecraftMode() {
    if (typeof MinecraftMod !== 'undefined') {
      MinecraftMod.init();
    }
    console.log('[Minecraft 模组模式] 已初始化');
  }

  /** 初始化 microbit 硬件模式 */
  let _microbitInited = false;
  let _pythonRefreshTimer = null;
  function initMicrobitMode(mode) {
    const subMode = (mode || EditorState.projectMode || '').replace('microbit-', ''); // 'realtime' | 'upload'
    console.log('[microbit] 初始化开始, subMode:', subMode, 'projectMode:', EditorState.projectMode, '已初始化:', _microbitInited);
  
    // 确认 projectMode 已设置
    if (!EditorState.projectMode || !EditorState.projectMode.startsWith('microbit')) {
      console.warn('[microbit] projectMode 未设置或不是 microbit:', EditorState.projectMode);
    }
  
    // 多次延迟刷新 Palette，确保不被其他模块覆盖
    const refreshPalette = (delay, label) => {
      setTimeout(() => {
        if (typeof Palette !== 'undefined') {
          try {
            Palette.init();
            console.log('[microbit] Palette刷新[' + label + '] 成功, projectMode:', EditorState.projectMode);
          } catch(e) {
            console.warn('[microbit] Palette刷新[' + label + '] 失败:', e);
          }
        }
      }, delay);
    };
    refreshPalette(0, 'immediate');
    refreshPalette(200, '200ms');
    refreshPalette(600, '600ms');
    refreshPalette(1500, '1500ms');
  
    // 添加配对设备按钮（两种模式都有）
    _addMicrobitPairBtn(subMode === 'realtime');
  
    if (subMode === 'upload') {
      // 上传模式: 隐藏运行/停止按钮
      const btnRun = document.getElementById('btn-run');
      const btnStop = document.getElementById('btn-stop');
      if (btnRun) btnRun.style.display = 'none';
      if (btnStop) btnStop.style.display = 'none';
      
      // 上传模式: 隐藏角色/音频栏，显示 Python 代码栏
      const spriteSection = document.getElementById('sprite-section');
      const audioSection = document.getElementById('audio-section');
      const codeSection = document.getElementById('microbit-code-section');
      if (spriteSection) spriteSection.style.display = 'none';
      if (audioSection) audioSection.style.display = 'none';
      if (codeSection) codeSection.classList.remove('hidden');
      
      // 上传模式: 右侧栏左右分栏 (左=代码, 右=模拟器)
      const rightPanel = document.getElementById('right-panel');
      if (rightPanel) rightPanel.classList.add('microbit-upload-layout');
      
      // 绑定刷新/复制按钮
      const refreshBtn = document.getElementById('btn-refresh-python');
      const copyBtn = document.getElementById('btn-copy-python');
      if (refreshBtn && !refreshBtn._bound) {
        refreshBtn._bound = true;
        refreshBtn.addEventListener('click', _refreshPythonCode);
      }
      if (copyBtn && !copyBtn._bound) {
        copyBtn._bound = true;
        copyBtn.addEventListener('click', () => {
          const output = document.getElementById('microbit-python-output');
          if (output) {
            output.select();
            document.execCommand('copy');
            copyBtn.textContent = '✓';
            setTimeout(() => { copyBtn.textContent = '📋'; }, 1000);
          }
        });
      }
      
      // 自动刷新 Python 代码
      _refreshPythonCode();
      _setupAutoRefreshPython();
      
      // 上传模式额外添加“编译并烧录”按钮
      _addMicrobitFlashBtn();
    } else if (subMode === 'realtime') {
      // 实时模式: 隐藏角色/音频栏 (microbit 不依赖舞台角色)
      const spriteSection = document.getElementById('sprite-section');
      const audioSection = document.getElementById('audio-section');
      if (spriteSection) spriteSection.style.display = 'none';
      if (audioSection) audioSection.style.display = 'none';
    }

    // 初始化 microbit 模拟器 (实时模式 + 上传模式 共用)
    _initMicrobitSimulator();
  
    _microbitInited = true;
    console.log('[microbit] 初始化完成');
  }

  /** 初始化 microbit 模拟器: 挂载 UI + 启用 Bridge 模拟器模式 */
  function _initMicrobitSimulator() {
    const container = document.getElementById('microbit-sim-container');
    if (!container) {
      console.warn('[microbit] simulator container not found');
      return;
    }
    container.classList.remove('hidden');
    if (typeof MicrobitSimulator !== 'undefined') {
      // 避免重复 init
      if (!MicrobitSimulator.isReady()) {
        MicrobitSimulator.init(container);
        console.log('[microbit] simulator UI initialized');
      }
    } else {
      console.warn('[microbit] MicrobitSimulator not loaded');
    }
    // 启用 Bridge 的模拟器回退 (未连接真实设备时命令发往模拟器)
    if (typeof MicrobitBridge !== 'undefined') {
      MicrobitBridge.enableSimulator();
    }
  }

  /** 刷新 Python 代码显示 */
  function _refreshPythonCode() {
    const output = document.getElementById('microbit-python-output');
    if (!output) return;
    try {
      const blocks = EditorState.blocks || {};
      if (typeof MicrobitCompiler !== 'undefined') {
        const code = MicrobitCompiler.compile(blocks);
        output.value = code;
      } else {
        output.value = '# MicrobitCompiler 未加载\n';
      }
    } catch(e) {
      output.value = '# 编译错误: ' + e.message;
    }
  }

  /** 设置积木变化时自动刷新 Python 代码 */
  function _setupAutoRefreshPython() {
    // 清除旧定时器
    if (_pythonRefreshTimer) clearInterval(_pythonRefreshTimer);
    // 监听积木变化，延迟刷新
    const _scheduleRefresh = () => {
      if (_pythonRefreshTimer) clearTimeout(_pythonRefreshTimer);
      _pythonRefreshTimer = setTimeout(_refreshPythonCode, 500);
    };
    // 监听编辑器画布的 DOM 变化
    const editorPanel = document.getElementById('editor-panel');
    if (editorPanel) {
      const observer = new MutationObserver(_scheduleRefresh);
      observer.observe(editorPanel, { childList: true, subtree: true, attributes: true });
    }
    // 备用: 定时刷新 (2秒)
    setInterval(_refreshPythonCode, 2000);
  }
  
  /** 在工具栏添加配对设备按钮（实时模式+上传模式都有） */
  function _addMicrobitPairBtn(isRealtime) {
    // 防止重复添加
    let btn = document.getElementById('mb-pair-btn');
    if (btn) btn.remove();
    btn = document.createElement('button');
    btn.id = 'mb-pair-btn';
    btn.className = 'tb-btn';
    btn.style.cssText = 'margin-left:8px;font-size:12px;';
  
    const _updateBtn = (connected) => {
      if (connected) {
        btn.textContent = '🔗 micro:bit 已连接';
        btn.title = '点击断开连接';
        btn.style.background = 'var(--green, #a6e3a1)';
        btn.style.color = '#1e1e2e';
        btn.onclick = () => {
          if (typeof MicrobitBridge !== 'undefined') {
            MicrobitBridge.disconnect();
            _updateBtn(false);
          }
        };
      } else {
        btn.textContent = '🔌 配对设备';
        btn.title = '连接 micro:bit 设备';
        btn.style.background = '';
        btn.style.color = '';
        btn.onclick = () => {
          if (typeof MicrobitBridge !== 'undefined') {
            MicrobitBridge.showConnectDialog(async () => {
              _updateBtn(true);
              // 实时模式：配对成功后烧录 main.hex
              if (isRealtime) {
                console.log('[microbit] 实时模式手动配对成功, 烧录 main.hex...');
                try {
                  const flashResult = await MicrobitBridge.flashMainHex();
                  if (flashResult.ok) {
                    console.log('[microbit] 实时固件烧录成功:', flashResult.path);
                  } else {
                    console.warn('[microbit] 实时固件烧录失败:', flashResult.error);
                    alert('⚠️ 串口连接成功，但固件烧录失败:\n' + (flashResult.error || '未知错误'));
                  }
                } catch (e) {
                  console.warn('[microbit] 烧录固件异常:', e);
                }
              }
            });
          }
        };
      }
    };
  
    // 如果是实时模式且已连接，显示已连接状态
    if (isRealtime && typeof MicrobitBridge !== 'undefined' && MicrobitBridge.isConnected()) {
      _updateBtn(true);
    } else {
      _updateBtn(false);
    }
  
    const toolbar = document.getElementById('toolbar') || document.querySelector('.toolbar');
    if (toolbar) {
      toolbar.appendChild(btn);
      console.log('[microbit] 配对按钮已添加到工具栏');
    } else {
      console.warn('[microbit] 未找到工具栏元素，尝试延迟添加...');
      setTimeout(() => {
        const tb = document.getElementById('toolbar') || document.querySelector('.toolbar');
        if (tb) { tb.appendChild(btn); console.log('[microbit] 配对按钮延迟添加成功'); }
        else console.error('[microbit] 工具栏不存在！');
      }, 500);
    }

    // 实时模式：自动弹出连接对话框
    if (isRealtime && typeof MicrobitBridge !== 'undefined' && !MicrobitBridge.isConnected()) {
      setTimeout(() => {
        MicrobitBridge.showConnectDialog(async () => {
          _updateBtn(true);
          console.log('[microbit] 实时模式已连接, 开始烧录 main.hex 固件...');
          // 配对成功后自动烧录实时模式固件
          try {
            const flashResult = await MicrobitBridge.flashMainHex();
            if (flashResult.ok) {
              console.log('[microbit] 实时固件烧录成功:', flashResult.path);
            } else {
              console.warn('[microbit] 实时固件烧录失败:', flashResult.error);
              alert('⚠️ 串口连接成功，但固件烧录失败:\n' + (flashResult.error || '未知错误') + '\n\n请确保 micro:bit 已通过 USB 连接，并检查 micro:bit 是否显示为 USB 驱动器。');
            }
          } catch (e) {
            console.warn('[microbit] 烧录固件异常:', e);
          }
        });
      }, 500);
    }
  }

  /** 在工具栏添加“编译并烧录”按钮 */
  function _addMicrobitFlashBtn() {
    let btn = document.getElementById('mb-flash-btn');
    if (btn) return;
    btn = document.createElement('button');
    btn.id = 'mb-flash-btn';
    btn.className = 'tb-btn tb-run';
    btn.style.cssText = 'margin-left:8px;font-size:12px;';
    btn.textContent = '📥 编译并烧录';
    btn.title = '将积木编译为 MicroPython，合并到预编译固件，烧录到 micro:bit';
    btn.onclick = async () => {
      if (typeof MicrobitCompiler === 'undefined' || typeof MicrobitBridge === 'undefined') {
        alert('microbit 模块未加载'); return;
      }
      btn.textContent = '⏳ 编译中...';
      btn.disabled = true;
      try {
        const blocks = EditorState.blocks || {};
        const pyCode = MicrobitCompiler.compile(blocks);
        console.log('[microbit] 编译 MicroPython 代码:\n', pyCode);

        // 更新 Python 代码面板
        const output = document.getElementById('microbit-python-output');
        if (output) output.value = pyCode;

        // 通过新 API: 编译 + 合并 + 拖拽烧录
        btn.textContent = '⏳ 合并固件...';
        const result = await MicrobitBridge.compileAndFlash(pyCode);
        
        if (result.ok) {
          if (result.path) {
            alert('✅ 烧录成功！\n\n已复制到: ' + result.path);
          } else if (result.combinedHex) {
            alert('✅ 编译成功！\n\n合并 hex 已保存到:\n' + result.combinedHex + '\n\n' + (result.message || '请手动复制到 micro:bit USB 驱动器。'));
          }
        } else {
          alert('❌ 烧录失败: ' + (result.error || '未知错误'));
        }
      } catch(e) {
        alert('编译烧录失败: ' + e.message);
      }
      btn.textContent = '📥 编译并烧录';
      btn.disabled = false;
    };
    const toolbar = document.getElementById('toolbar') || document.querySelector('.toolbar');
    if (toolbar) {
      toolbar.appendChild(btn);
      console.log('[microbit] 烧录按钮已添加到工具栏');
    } else {
      setTimeout(() => {
        const tb = document.getElementById('toolbar') || document.querySelector('.toolbar');
        if (tb) tb.appendChild(btn);
      }, 500);
    }
  }

  /** 初始化代码编程模式 */
  let _codeEditor = null;
  let _codeModeInitialized = false;
  let _hintDebounce = null;

  /** 注册代码自动补全 */
  function _registerCodeHints(editor, cmMode) {
    // 语言关键词字典
    const keywords = {
      'python': [
        'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
        'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
        'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is',
        'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try',
        'while', 'with', 'yield',
        // 内建函数
        'abs', 'all', 'any', 'bin', 'bool', 'bytes', 'callable', 'chr',
        'classmethod', 'compile', 'complex', 'delattr', 'dict', 'dir',
        'divmod', 'enumerate', 'eval', 'exec', 'filter', 'float', 'format',
        'frozenset', 'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex',
        'id', 'input', 'int', 'isinstance', 'issubclass', 'iter', 'len',
        'list', 'locals', 'map', 'max', 'memoryview', 'min', 'next',
        'object', 'oct', 'open', 'ord', 'pow', 'print', 'property', 'range',
        'repr', 'reversed', 'round', 'set', 'setattr', 'slice', 'sorted',
        'staticmethod', 'str', 'sum', 'super', 'tuple', 'type', 'vars', 'zip',
        // 常用模块
        'os', 'sys', 'math', 'random', 'time', 'datetime', 'json', 're',
        'collections', 'itertools', 'functools', 'pathlib', 'subprocess',
      ],
      'javascript': [
        'arguments', 'await', 'break', 'case', 'catch', 'class', 'const',
        'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export',
        'extends', 'false', 'finally', 'for', 'function', 'if', 'import',
        'in', 'instanceof', 'let', 'new', 'null', 'of', 'return', 'static',
        'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'undefined',
        'var', 'void', 'while', 'with', 'yield',
        // 全局对象
        'console', 'document', 'window', 'Math', 'JSON', 'Array', 'Object',
        'String', 'Number', 'Boolean', 'Date', 'RegExp', 'Map', 'Set',
        'Promise', 'Symbol', 'Proxy', 'Reflect', 'parseInt', 'parseFloat',
        'isNaN', 'isFinite', 'setTimeout', 'setInterval', 'clearTimeout',
        'clearInterval', 'fetch', 'alert', 'prompt', 'confirm',
      ],
      'text/x-alb': [
        // ALB 语法关键字
        'if', 'when', 'while', 'for-i', 'cond', 'let', 'let*', 'letrec', 'const', 'define',
        'set', 'func', 'do', 'def', 'try', 'match', 'quote', 'list', 'struct', 'export',
        // Objector 游戏 API
        'move', 'turn_right', 'turn_left', 'goto_xy', 'set_x', 'set_y', 'get_x', 'get_y',
        'say', 'say_for', 'think', 'clear_say', 'show', 'hide', 'set_size', 'change_size',
        'set_sprite', 'sprite_name', 'key_pressed', 'mouse_x', 'mouse_y', 'mouse_down',
        'random_int', 'get_var', 'set_var', 'change_var', 'has_var', 'play_sound',
        'touching_edge', 'touching_sprite', 'distance_to', 'timer_now', 'print', 'log',
      ],
    };

    // Objector 游戏 API（所有语言通用, 附加到补全字典）
    const GAME_API_WORDS = [
      'sprite', 'stage', 'globalVars',
      'move', 'turn_right', 'turn_left', 'turnRight', 'turnLeft', 'goto_xy', 'goTo',
      'set_x', 'set_y', 'get_x', 'get_y', 'change_x', 'change_y', 'set_x', 'set_y',
      'say', 'say_for', 'sayFor', 'think', 'clear_say', 'show', 'hide',
      'set_size', 'change_size', 'setSize', 'point_in_direction', 'bounce_edge',
      'set_sprite', 'sprite_name', 'sprite_count', 'key_pressed', 'mouse_x', 'mouse_y',
      'mouse_down', 'random_int', 'get_var', 'set_var', 'change_var', 'has_var',
      'play_sound', 'stop_sounds', 'set_volume', 'touching_edge', 'touching_sprite',
      'distance_to', 'sprite_x', 'sprite_y', 'timer_now', 'stage_width', 'stage_height', 'log',
      'thread_spawn', 'thread_kill', 'thread_list', 'thread_id',
    ];
    const words = (keywords[cmMode] || keywords['javascript']).concat(GAME_API_WORDS.filter(w => !(keywords[cmMode] || []).includes(w)));

    // 已安装扩展的 code_exp API（每次补全时动态读取, 新装扩展无需重新注册）
    // JS/Python: h.hello → 补全 h 与 hello; ALB: h_hello
    function _extApiWords() {
      const out = [];
      if (typeof ExtensionManager === 'undefined' || !ExtensionManager.getCodeExpApis) return out;
      try {
        ExtensionManager.getCodeExpApis().forEach(ext => {
          out.push(ext.objName);
          Object.keys(ext.fns).forEach(k => {
            const ce = ext.fns[k].def.code_exp || {};
            if (cmMode === 'text/x-alb') { if (ce.ALB) out.push(ext.objName + '_' + ce.ALB); }
            else if (cmMode === 'python') { if (ce.python) out.push(ce.python); }
            else { if (ce.JavaScript) out.push(ce.JavaScript); }
          });
        });
      } catch (e) { /* ignore */ }
      return out.filter(w => w && !words.includes(w));
    }

    // 自定义 hint 函数
    function wordHint(cm) {
      const cur = cm.getCursor();
      const token = cm.getTokenAt(cur);
      let start = token.start;
      let end = cur.ch;
      const word = token.string.slice(0, end - start);

      if (!word || word.length < 1) return null;

      const list = words.concat(_extApiWords()).filter(w => w.startsWith(word) && w !== word);

      // 也从当前文档提取标识符
      const docText = cm.getValue();
      const docWords = docText.match(/\b[a-zA-Z_]\w*\b/g) || [];
      const uniqueDocWords = [...new Set(docWords)].filter(w => w.startsWith(word) && w !== word && !list.includes(w));

      const allList = [...list, ...uniqueDocWords].sort().slice(0, 50);

      if (allList.length === 0) return null;

      return {
        list: allList,
        from: CodeMirror.Pos(cur.line, start),
        to: CodeMirror.Pos(cur.line, end),
      };
    }

    // 注册到 CodeMirror
    CodeMirror.registerHelper('hint', cmMode.includes('python') ? 'python' : 'javascript-custom', wordHint);

    // 输入时自动弹出补全（防抖 300ms）; 重复注册（切换语言）时先移除旧监听, 避免叠加
    let debounceTimer = null;
    if (editor._codeHintHandler) editor.off('inputRead', editor._codeHintHandler);
    const inputReadHandler = (cm, change) => {
      if (change.text[0] && /^[a-zA-Z_]$/.test(change.text[0])) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          const cur = cm.getCursor();
          const token = cm.getTokenAt(cur);
          if (token.string.length >= 2 && /^[a-zA-Z_]\w*$/.test(token.string)) {
            cm.showHint({ hint: wordHint, completeSingle: false });
          }
        }, 300);
      }
    };
    editor.on('inputRead', inputReadHandler);
    editor._codeHintHandler = inputReadHandler;
  }

  /** 代码编程模式: 每个角色独立存储代码（角色名 -> { python, javascript, alb }） */
  let _codeScripts = {};
  /** 当前代码语言配置键（'code-python' | 'code-js' | 'code-alb'）
   *  注意: 不能依赖 EditorState.projectMode —— initCodeMode 在 loadProject 之前被调用时它还没赋值 */
  let _codeLangKey = 'code-python';
  /** 落盘闸门: 磁盘角色代码恢复完成前禁止 _persistCodeScripts 回写。
   *  否则项目加载时 restoreSprites 触发的角色切换回调会用示例模板覆盖 config.codeScripts（"保存后再加载退回示例"的根因） */
  let _codeScriptsRestored = false;

  /** 是否为代码编程模式项目（兼容旧的裸 'code' 值） */
  function _isCodeProjectMode() {
    const m = String(EditorState.projectMode || '');
    return m === 'code' || m.indexOf('code-') === 0;
  }

  /** 把 project.json 里的 mode 归一化为 CODE_LANG_CONFIG 键 */
  function _normalizeCodeModeKey(mode) {
    const m = String(mode || '');
    if (CODE_LANG_CONFIG[m]) return m;
    if (m === 'code-javascript' || m === 'js' || m === 'javascript' || m === 'code-js') return 'code-js';
    if (m === 'py' || m === 'python' || m === 'code-py') return 'code-python';
    if (m === 'alb' || m === 'code-alb') return 'code-alb';
    return '';
  }

  /** runner 名 -> 语言配置项 */
  function _cfgForRunner(runner) {
    const key = _normalizeCodeModeKey(runner);
    return CODE_LANG_CONFIG[key] || CODE_LANG_CONFIG[_codeLangKey] || CODE_LANG_CONFIG['code-python'];
  }

  /** 文本是否正好是某个语言的示例模板（未编辑过的初始代码） */
  function _isTemplateText(runner, text) {
    if (typeof text !== 'string') return false;
    return Object.keys(CODE_LANG_CONFIG).some(k =>
      (!runner || CODE_LANG_CONFIG[k].runner === runner) && text === CODE_LANG_CONFIG[k].template);
  }

  /** 编辑器里当前显示的是哪个角色的代码（切换回调时活动角色已指向新角色, 不能用它写回） */
  let _codeEditorOwner = '';
  /** 当前活动角色名（代码存储 key） */
  function _activeCodeKey() {
    if (typeof StageManager === 'undefined') return '';
    const s = StageManager.getActiveSprite();
    return s ? String(s.name) : '';
  }

  /** 角色切换时保存/加载对应代码（只在编辑器状态触发, 运行期间 CodeRuntime 绑定角色） */
  function _onCodeSpriteSelected() {
    if (!_isCodeProjectMode()) return;
    if (typeof CodeRuntime !== 'undefined' && CodeRuntime.isRunning && CodeRuntime.isRunning()) return;
    _syncAllSpriteCode();     // 先把上个角色的编辑写回它自己（_codeEditorOwner）
    const name = _activeCodeKey();
    if (!name) return;
    const cur = (typeof StageManager !== 'undefined' && StageManager.getActiveSprite) ? StageManager.getActiveSprite() : null;
    if (cur && cur.isStage) return;        // 舞台不承载代码: 不播种/不切编辑器归属, 避免生成无意义的"舞台"条目
    _ensureSpriteCodeLoaded(name);
    _applySpriteCodeToEditor(name);
    if (_codeScriptsRestored) _persistCodeScripts(); // 切换角色时自动落盘（闸门打开后）
  }

  /** 把编辑器当前内容写回它所属角色的存储条目 */
  function _syncCurrentCode() {
    if (!_codeEditor) return;
    const name = _codeEditorOwner || _activeCodeKey();
    const runner = _codeCfg().runner;
    if (!name || !runner) return;
    if (!_codeEditorOwner) {
      // 尚无明确归属时活动角色是舞台 → 不回写（舞台不承载代码）
      const cur = (typeof StageManager !== 'undefined' && StageManager.getActiveSprite) ? StageManager.getActiveSprite() : null;
      if (cur && cur.isStage) return;
    }
    if (!_codeScripts[name]) _codeScripts[name] = {};
    const val = _codeEditor.getValue();
    const prev = _codeScripts[name][runner];
    // 保护: 编辑器仍停留在"未修改的示例模板", 而该角色已存有真实代码时不覆盖
    // （加载项目 / 切换语言的时序差异会让模板短暂占据编辑器, 直接写回会丢代码）
    if (prev != null && prev !== val && _isTemplateText(runner, val)) return;
    _codeScripts[name][runner] = val;
  }

  /** 补齐所有角色的代码条目, 并把编辑器内容写回所属角色（保存/运行/切角色前调用） */
  function _syncAllSpriteCode() {
    if (!_codeEditor) return;
    if (typeof StageManager === 'undefined') return;
    const runner = _codeCfg().runner;
    const sprites = StageManager.getSprites() || [];
    for (const s of sprites) {
      if (s.isStage) continue;
      const name = String(s.name);
      if (!_codeScripts[name] || _codeScripts[name][runner] == null) _seedSpriteCode(name, runner);
    }
    _syncCurrentCode();
  }

  /** 初始化角色代码条目: 旧项目迁移 scripts/main.<ext> → 只给第一个非舞台角色; 否则用模板 */
  function _seedSpriteCode(name, runner) {
    if (_codeScripts[name] && _codeScripts[name][runner] != null) return;
    const cfg = _cfgForRunner(runner);
    if (!_codeScripts[name]) _codeScripts[name] = {};
    _codeScripts[name][runner] = cfg.template;
    if (!EditorState.projectPath) return;
    const firstIdx = (StageManager.getSprites() || []).findIndex(s => !s.isStage);
    const curIdx = StageManager.getActiveSpriteIdx();
    if (curIdx !== firstIdx) return;
    const ext = cfg.ext;
    window.api.readFile(EditorState.projectPath + '/scripts/main.' + ext).then(legacy => {
      if (legacy && String(legacy).trim() && _codeScripts[name] && _codeScripts[name][runner] === cfg.template) {
        _codeScripts[name][runner] = legacy;
        if (name === (_codeEditorOwner || _activeCodeKey()) && runner === _codeCfg().runner && _codeEditor && _codeEditor.getValue() === cfg.template) {
          _codeApplying = true;
          try { _codeEditor.setValue(legacy); } finally { _codeApplying = false; }
        }
      }
    }).catch(() => {});
  }

  /** 确保角色代码条目存在（含旧版单文件异步迁移） */
  function _ensureSpriteCodeLoaded(name) {
    _seedSpriteCode(name, _codeCfg().runner);
  }

  /** 把某角色某语言的代码载入编辑器 */
  let _codeApplying = false;
  function _applySpriteCodeToEditor(name) {
    if (!_codeEditor) return;
    const runner = _codeCfg().runner;
    const cfg = _codeCfg();
    const code = (_codeScripts[name] && _codeScripts[name][runner] != null) ? _codeScripts[name][runner] : cfg.template;
    if (_codeEditor.getValue() !== code) {
      _codeApplying = true;                 // 程序载入不算用户编辑, 不标脏/不回写
      try { _codeEditor.setValue(code); } finally { _codeApplying = false; }
    }
    _codeEditorOwner = name;                // 从此刻起编辑器属于该角色
    setTimeout(() => { if (_codeEditor) _codeEditor.refresh(); }, 100);
  }

  /** 获取所有角色的代码（用于项目保存: config.codeScripts） */
  function getAllCodeScripts() {
    _syncCurrentCode();
    const out = {};
    Object.keys(_codeScripts).forEach(k => { out[k] = { ..._codeScripts[k] }; });
    return out;
  }

  /** 批量设置角色代码（项目加载时恢复） */
  function setAllCodeScripts(scripts) {
    _codeScripts = scripts || {};
    // 清洗脏数据: 旧版本曾因语言误判把 A 语言的示例模板存进 B 语言的键,
    // 加载时把"内容其实是某语言未修改模板"的条目归位为该语言自己的模板
    Object.keys(_codeScripts).forEach(name => {
      const entry = _codeScripts[name] || {};
      Object.keys(entry).forEach(runner => {
        const own = _cfgForRunner(runner);
        if (!own || entry[runner] === own.template) return;
        if (_isTemplateText(null, entry[runner])) entry[runner] = own.template;
      });
    });
  }

  /** 代码模式运行: 为每个角色构建代码源（编辑器里的内容已写回存储, 统一按角色读取） */
  function getSpriteCodeSources() {
    _syncAllSpriteCode();
    const runner = _codeCfg().runner;
    const entries = [];
    const sprites = (typeof StageManager !== 'undefined') ? (StageManager.getSprites() || []) : [];
    sprites.forEach((s, i) => {
      if (s.isStage) return;
      const name = String(s.name);
      entries.push({
        name,
        idx: i,
        getCode: () => (_codeScripts[name] && _codeScripts[name][runner]) || '',
      });
    });
    return entries;
  }

  /** 角色名 → 安全文件名（替换 Windows/Linux 非法字符, 加载时按同样规则反查匹配） */
  function _safeCodeFileName(name) {
    const s = String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '');
    return s || 'sprite';
  }

  const _RUNNER_EXT = { python: 'py', javascript: 'js', alb: 'alb' };

  /**
   * 把所有角色的代码落盘（返回是否成功）:
   *  ① 每个角色独立文件 scripts/<场景名>/<角色名>.<py|js|alb> —— 按场景存储
   *  ② project.json 的 config.codeScripts —— 兼容导出/旧加载链路
   */
  async function _persistCodeScripts() {
    if (!EditorState.projectPath || !_isCodeProjectMode()) return false;
    if (!_codeScriptsRestored) return false; // 磁盘代码尚未恢复, 禁止回写（防模板覆盖用户代码）
    try {
      const all = getAllCodeScripts();
      // 1) 每角色独立代码文件 —— 按场景存储到 scripts/<sceneName>/
      const sceneName = (typeof EditorState !== 'undefined' && EditorState._currentSceneName) ? EditorState._currentSceneName : 'main';
      const codeDir = EditorState.projectPath + '/scripts/' + sceneName;
      if (window.api.ensureDir) await window.api.ensureDir(codeDir);
      const writes = [];
      Object.keys(all).forEach(name => {
        if (name === '舞台') return;        // 舞台不承载代码
        const entry = all[name] || {};
        Object.keys(entry).forEach(runner => {
          const ext = _RUNNER_EXT[runner];
          if (!ext || entry[runner] == null) return;
          writes.push(window.api.writeFile(codeDir + '/' + _safeCodeFileName(name) + '.' + ext, String(entry[runner])));
        });
      });
      // 2) project.json（保留其它字段, 仅更新 codeScripts/codeLang）
      const p = EditorState.projectPath + '/project.json';
      const cfgStr = await window.api.readFile(p);
      const config = cfgStr ? JSON.parse(cfgStr) : {};
      config.codeScripts = all;
      config.codeLang = _codeCfg().runner; // 记录语言, 兼容 mode 为裸 'code' 的项目
      writes.push(window.api.writeFile(p, JSON.stringify(config, null, 2)));
      const results = await Promise.all(writes);
      const failed = results.find(r => r && r.error);   // write-file 失败时返回 {error} 而不抛异常
      if (failed) { console.warn('[代码编程模式] 写入失败:', failed.error); return false; }
      return true;
    } catch (e) {
      console.warn('[代码编程模式] 写入代码失败:', e);
      return false;
    }
  }

  /**
   * 在精灵恢复(会触发角色切换回调)之前, 从磁盘恢复按角色代码并打开落盘闸门:
   * project.json 的 config.codeScripts → 再叠加 scripts/<sceneName>/ 独立文件（文件是逐次自动保存的最新内容, 优先）
   * 兼容旧版: 也尝试从 code/ 目录加载
   */
  async function _restoreCodeScriptsFromDisk(config, folder) {
    try {
      if (config && config.codeScripts && typeof config.codeScripts === 'object') setAllCodeScripts(config.codeScripts);
      // 收集角色名（来自 project.json 的 sprites + 已有存储键）
      const names = [];
      (Array.isArray(config && config.sprites) ? config.sprites : []).forEach(s => {
        const n = String((s && s.name) || '');
        if (n && n !== '舞台' && names.indexOf(n) < 0) names.push(n);
      });
      Object.keys(_codeScripts).forEach(k => { if (k !== '舞台' && names.indexOf(k) < 0) names.push(k); });
      // 加载场景名（用于构建脚本目录路径）
      const sceneName = (config && config.mainScene) 
        ? config.mainScene.replace(/^scenes\//, '').replace(/\.scene\.json$/, '') 
        : 'main';
      // 叠加 scripts/<sceneName>/ 独立文件（优先）和 code/ 独立文件（兼容旧版）
      if (window.api.listDir) {
        const extToRunner = { py: 'python', js: 'javascript', alb: 'alb' };
        const dirs = [
          folder + '/scripts/' + sceneName,  // 新版: 按场景存储
          folder + '/code',                   // 旧版: 兼容
        ];
        for (const codeDir of dirs) {
          let files;
          try { files = await window.api.listDir(codeDir); } catch { continue; }
          for (const f of files || []) {
            const dot = f.lastIndexOf('.');
            if (dot <= 0) continue;
            const runner = extToRunner[f.slice(dot + 1).toLowerCase()];
            if (!runner) continue;
            const base = f.slice(0, dot);
            const name = names.find(n => _safeCodeFileName(n) === base);
            if (!name) continue;
            const content = await window.api.readFile(codeDir + '/' + f);
            if (content == null) continue;
            if (!_codeScripts[name]) _codeScripts[name] = {};
            _codeScripts[name][runner] = String(content);
          }
        }
      }
    } catch (e) {
      console.warn('[代码编程模式] 恢复角色代码失败:', e);
    } finally {
      _codeScriptsRestored = true; // 无论成败都打开闸门, 否则用户将永远存不了盘
    }
  }

  /**
   * 场景切换钩子: 保存当前场景的所有状态（积木 + JS脚本 + 代码）
   * 在切换场景前调用，确保当前场景数据不丢失
   * 保存后清空内存中的积木，防止新场景加载时被旧数据覆盖
   */
  async function saveCurrentSceneState() {
    if (!EditorState.projectPath) return;
    try {
      // 0. 必须先保存当前标签页数据（在 syncFromSceneGraph 重建精灵之前）
      _saveCurrentTabData();
      // 1. 将 _spriteBlocks 同步到 SceneGraph 节点（保存前确保场景文件包含正确的积木）
      _syncBlocksToSceneGraph();
      // 2. 同步精灵属性到 SceneGraph 并保存场景文件
      if (typeof StageManager !== 'undefined' && StageManager.syncToSceneGraph) {
        StageManager.syncToSceneGraph();
      }
      if (typeof FileSystemDock !== 'undefined' && FileSystemDock.saveCurrentScene) {
        const sceneName = (EditorState._currentSceneName) || 'main';
        await FileSystemDock.saveCurrentScene(sceneName);
      }
      // 3. 高级模式: 保存 JS 脚本到场景目录
      if (EditorState.projectMode === 'advanced') {
        await _saveSceneJsScripts();
      }
      // 4. 代码模式: 保存代码到场景目录
      if (_isCodeProjectMode()) {
        _syncAllSpriteCode();
        await _persistCodeScripts();
      }
    } catch (e) {
      console.warn('[场景保存] 保存场景状态失败:', e);
    }
  }

  /** 将 _spriteBlocks 同步到 SceneGraph 节点的 blocks 字段（保存场景文件前调用） */
  function _syncBlocksToSceneGraph() {
    if (typeof SceneGraph === 'undefined' || typeof StageManager === 'undefined') return;
    const scene = _curScene();
    const sceneBlocks = _spriteBlocks[scene] || {};
    const sprites = StageManager.getSprites();
    sprites.forEach((sprite, idx) => {
      if (!sprite._sceneNodeId) return;
      const node = SceneGraph.getNode(sprite._sceneNodeId);
      if (!node) return;
      if (sceneBlocks[idx] !== undefined) {
        node.blocks = JSON.parse(JSON.stringify(sceneBlocks[idx]));
      }
    });
  }

  /** 从场景文件数据中提取积木到 _spriteBlocks（加载场景后调用） */
  function _loadBlocksFromSceneData(sceneData) {
    if (!sceneData || !sceneData.nodes) return;
    const scene = _curScene();
    if (!_spriteBlocks[scene]) _spriteBlocks[scene] = {};
    const sprites = (typeof StageManager !== 'undefined') ? StageManager.getSprites() : [];
    // 根据 SceneGraph 节点的 spriteRef 映射索引
    Object.values(sceneData.nodes).forEach(node => {
      if (node.type === 'Sprite2D' && node.spriteRef != null && node.blocks) {
        _spriteBlocks[scene][node.spriteRef] = JSON.parse(JSON.stringify(node.blocks));
      }
    });
    console.log('[场景加载] 已加载积木数据:', scene, '精灵数:', Object.keys(_spriteBlocks[scene]).length);
  }

  /** 是否有活跃的标签页（供 scene-tree.js 判断是否应跳过编辑器操作） */
  function _hasActiveTabs() { return _spriteTabs.length > 0; }

  /** 将 _spriteBlocks 中当前场景的积木写回精灵对象（运行前调用，确保 executor 能读到积木） */
  function _flushBlocksToSprites() {
    if (typeof StageManager === 'undefined') return;
    const scene = _curScene();
    // 先保存当前标签页的最新积木
    _saveCurrentTabData();
    const sceneBlocks = _spriteBlocks[scene] || {};
    const sprites = StageManager.getSprites();
    Object.keys(sceneBlocks).forEach(idxStr => {
      const idx = parseInt(idxStr);
      if (sprites[idx]) {
        sprites[idx].blocks = JSON.parse(JSON.stringify(sceneBlocks[idx]));
      }
    });
  }

  /** 保存当前场景的 JS 脚本到 scripts/<sceneName>/ 目录 */
  async function _saveSceneJsScripts() {
    if (!EditorState.projectPath || !window.api || !window.api.writeFile || !window.api.ensureDir) return;
    try {
      const sceneName = (EditorState._currentSceneName) || 'main';
      const scriptDir = EditorState.projectPath + '/scripts/' + sceneName;
      await window.api.ensureDir(scriptDir);
      const sprites = (typeof StageManager !== 'undefined') ? StageManager.getSprites() : [];
      const sceneScripts = _getSceneScripts();
      for (let i = 0; i < sprites.length; i++) {
        if (sprites[i].isStage) continue;
        const code = sceneScripts[i] || '';
        if (code.trim()) {
          const fileName = _safeCodeFileName(sprites[i].name) + '.js';
          await window.api.writeFile(scriptDir + '/' + fileName, code);
        }
      }
    } catch (e) {
      console.warn('[JS脚本保存] 保存失败:', e);
    }
  }

  /**
   * 场景切换钩子: 加载新场景的 JS 脚本
   * 在切换场景后调用，恢复新场景的脚本数据
   */
  async function loadSceneScripts(sceneName) {
    if (!EditorState.projectPath || !window.api || !window.api.readFile || !window.api.listDir) return;
    try {
      const scriptDir = EditorState.projectPath + '/scripts/' + sceneName;
      const files = await window.api.listDir(scriptDir).catch(() => []);
      if (!files || files.length === 0) return;
      // 初始化该场景的脚本存储
      if (!_spriteScripts[sceneName]) _spriteScripts[sceneName] = {};
      if (!_nodeScripts[sceneName]) _nodeScripts[sceneName] = {};
      // 获取当前精灵列表以匹配文件名
      const sprites = (typeof StageManager !== 'undefined') ? StageManager.getSprites() : [];
      for (const f of files) {
        if (!f.endsWith('.js')) continue;
        const base = f.slice(0, -3);
        const content = await window.api.readFile(scriptDir + '/' + f);
        if (content == null) continue;
        // 尝试匹配精灵名
        const spriteIdx = sprites.findIndex(s => !s.isStage && _safeCodeFileName(s.name) === base);
        if (spriteIdx >= 0) {
          _spriteScripts[sceneName][spriteIdx] = String(content);
        }
      }
      console.log('[场景加载] 已加载场景脚本:', sceneName, '文件数:', files.length);
    } catch (e) {
      console.warn('[场景加载] 加载场景脚本失败:', e);
    }
  }

  /**
   * 打开精灵脚本标签页（主编辑器中间区域，包含积木 + JS 两个子 tab）
   * 通过右键菜单"编辑脚本"调用
   * @param {number} spriteIdx - 精灵索引
   * @param {string} spriteName - 精灵名称
   */
  function openSpriteScriptEditor(spriteIdx, spriteName) {
    // 如果已有该精灵的脚本标签页，直接切换
    const existingIdx = _spriteTabs.findIndex(t => t.tabType === 'script' && t.spriteIdx === spriteIdx);
    if (existingIdx >= 0) {
      _switchToTab(existingIdx);
      return;
    }
    // 创建新标签页
    _spriteTabs.push({ tabType: 'script', spriteIdx: spriteIdx, spriteName: spriteName || '精灵' });
    _switchToTab(_spriteTabs.length - 1);
  }

  /**
   * 打开节点属性标签页（主编辑器中间区域，显示 Inspector 内容）
   * 通过右键菜单“设置属性”调用
   * @param {string} nodeId - 场景图节点ID
   * @param {string} nodeName - 节点名称
   */
  function openNodeProperties(nodeId, nodeName) {
    // 如果已有该节点的属性标签页，直接切换
    const existingIdx = _spriteTabs.findIndex(t => t.tabType === 'props' && t.nodeId === nodeId);
    if (existingIdx >= 0) {
      _switchToTab(existingIdx);
      return;
    }
    // 创建新属性标签页
    _spriteTabs.push({ tabType: 'props', nodeId: nodeId, nodeName: nodeName || '节点' });
    _switchToTab(_spriteTabs.length - 1);
  }
  
  // ========== 精灵标签页管理 ==========
  
  /** 保存当前标签页的编辑数据 */
  function _saveCurrentTabData() {
    if (_activeTabIdx < 0 || !_spriteTabs[_activeTabIdx]) return;
    const tab = _spriteTabs[_activeTabIdx];
    // 属性标签页不需要保存积木/JS数据
    if (tab.tabType !== 'script') return;
    const scene = _curScene();
    // 保存积木到 _spriteBlocks（像JS代码一样按场景+索引独立存储）
    if (!_spriteBlocks[scene]) _spriteBlocks[scene] = {};
    _spriteBlocks[scene][tab.spriteIdx] = JSON.parse(JSON.stringify(EditorState.blocks || {}));
    // 保存 JS 代码（change handler 已实时保存，这里兆底）
    if (_codeMirrorInstance) {
      const sp = _getSceneScripts();
      sp[tab.spriteIdx] = _codeMirrorInstance.getValue();
    }
  }
  
  /** 切换到指定标签页 */
  function _switchToTab(idx) {
    if (idx < 0 || idx >= _spriteTabs.length) return;
    // 清除 JS 防抖定时器（防止旧定时器在切换后触发写入错误数据）
    clearTimeout(_jsSaveTimer);
    // 保存当前标签页数据
    _saveCurrentTabData();
    // 切换激活标签
    _activeTabIdx = idx;
    const tab = _spriteTabs[idx];

    // 显示编辑区域
    _showEditingUI(true);
    // 渲染标签栏
    _renderSpriteTabs();

    if (tab.tabType === 'script') {
      // === 脚本标签页：恢复积木/JS ===
      const scene = _curScene();
      const sceneBlocks = _spriteBlocks[scene] || {};
      EditorState.blocks = sceneBlocks[tab.spriteIdx]
        ? JSON.parse(JSON.stringify(sceneBlocks[tab.spriteIdx]))
        : {};
      _editorSpriteIdx = tab.spriteIdx;
      // 刷新画布
      setTimeout(() => {
        if (typeof EditorCanvas !== 'undefined') {
          EditorCanvas.resize();
          EditorCanvas.render();
        }
      }, 50);
      // 刷新 CodeMirror
      if (_codeMirrorInstance) {
        const sp = _getSceneScripts();
        const jsCode = sp[tab.spriteIdx] || ('// ' + tab.spriteName + ' 的脚本\n// 可用对象：sprite（当前角色）、globalVars（全局变量）\n\n');
        _codeMirrorInstance.setValue(jsCode);
        setTimeout(() => _codeMirrorInstance && _codeMirrorInstance.refresh(), 50);
      }
      // 刷新 Palette
      if (typeof Palette !== 'undefined') {
        try { Palette.init(); } catch(e) { /* ignore */ }
      }
      // 保持当前子标签可见性
      _updateSubTabVisibility();
    } else if (tab.tabType === 'props') {
      // === 属性标签页：渲染 Inspector 内容 ===
      _editorSpriteIdx = -1;
      const container = document.getElementById('tab-inspector-content');
      if (container && typeof Inspector !== 'undefined' && Inspector.renderInto) {
        Inspector.renderInto(container, tab.nodeId);
      }
    }
  }
  
  /** 关闭标签页 */
  function _closeTab(idx) {
    if (idx < 0 || idx >= _spriteTabs.length) return;
    _spriteTabs.splice(idx, 1);
    if (_spriteTabs.length === 0) {
      _activeTabIdx = -1;
      _showEditingUI(false);
      _renderSpriteTabs();
      EditorState.blocks = {};
      if (_codeMirrorInstance) _codeMirrorInstance.setValue('');
    } else if (_activeTabIdx >= _spriteTabs.length) {
      _switchToTab(_spriteTabs.length - 1);
    } else if (_activeTabIdx === idx) {
      _switchToTab(Math.min(idx, _spriteTabs.length - 1));
    } else if (_activeTabIdx > idx) {
      _activeTabIdx--;
      _renderSpriteTabs();
    }
  }
  
  /** 显示/隐藏编辑区域 */
  function _showEditingUI(show) {
    const scriptTabs = document.getElementById('sprite-script-tabs');
    const blocksContent = document.getElementById('script-blocks-content');
    const jsContent = document.getElementById('script-js-content');
    const propsContent = document.getElementById('script-props-content');
    const placeholder = document.getElementById('script-placeholder');
    if (show) {
      const tab = _spriteTabs[_activeTabIdx];
      if (tab && tab.tabType === 'props') {
        // 属性标签页：显示属性容器，隐藏积木/JS
        if (scriptTabs) scriptTabs.classList.add('hidden');
        if (blocksContent) blocksContent.classList.add('hidden');
        if (jsContent) jsContent.classList.add('hidden');
        if (propsContent) propsContent.classList.remove('hidden');
        if (placeholder) placeholder.classList.add('hidden');
      } else {
        // 脚本标签页：显示积木/JS，隐藏属性
        if (scriptTabs) scriptTabs.classList.remove('hidden');
        if (propsContent) propsContent.classList.add('hidden');
        if (placeholder) placeholder.classList.add('hidden');
        _updateSubTabVisibility();
      }
    } else {
      if (scriptTabs) scriptTabs.classList.add('hidden');
      if (blocksContent) blocksContent.classList.add('hidden');
      if (jsContent) jsContent.classList.add('hidden');
      if (propsContent) propsContent.classList.add('hidden');
      if (placeholder) placeholder.classList.remove('hidden');
    }
  }
  
  /** 更新子标签（积木/JS）的可见性 */
  function _updateSubTabVisibility() {
    const blocksEl = document.getElementById('script-blocks-content');
    const jsEl = document.getElementById('script-js-content');
    if (_currentSubTab === 'blocks') {
      if (blocksEl) blocksEl.classList.remove('hidden');
      if (jsEl) jsEl.classList.add('hidden');
    } else {
      if (blocksEl) blocksEl.classList.add('hidden');
      if (jsEl) jsEl.classList.remove('hidden');
    }
  }
  
  /** 场景切换时清空标签页状态（旧场景的精灵索引不再有效）
   * 注意: 不调用 _saveCurrentTabData()，因为此时精灵可能已是新场景的，
   * 数据已由 saveCurrentSceneState() 在切换前保存。 */
  function _clearTabsOnSceneSwitch() {
    _spriteTabs = [];
    _activeTabIdx = -1;
    _showEditingUI(false);
    _renderSpriteTabs();
    setTimeout(() => {
      if (typeof EditorCanvas !== 'undefined') {
        EditorCanvas.resize();
        EditorCanvas.render();
      }
    }, 50);
  }

  /** 渲染精灵标签栏 */
  function _renderSpriteTabs() {
    const container = document.getElementById('sprite-tabs');
    if (!container) return;
    container.innerHTML = '';
    _spriteTabs.forEach((tab, idx) => {
      const el = document.createElement('div');
      el.className = 'sprite-tab' + (idx === _activeTabIdx ? ' active' : '');
      const icon = tab.tabType === 'props' ? '⚙️ ' : '';
      el.innerHTML = '<span class="sprite-tab-name"></span><span class="sprite-tab-close">&times;</span>';
      el.querySelector('.sprite-tab-name').textContent = icon + (tab.tabType === 'props' ? tab.nodeName : tab.spriteName);
      // 点击标签名切换
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('sprite-tab-close')) return;
        _switchToTab(idx);
      });
      // 点击关闭按钮
      el.querySelector('.sprite-tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        _closeTab(idx);
      });
      container.appendChild(el);
    });
  }

  /** 当前代码语言 runner 名（python | javascript | alb）, 供项目保存时写入 config.codeLang */
  function getCodeLangRunner() {
    return _codeCfg().runner;
  }

  /** 磁盘角色代码是否已恢复完成（供 ProjectManager 全量保存前判断, 防止加载中途用模板覆盖 codeScripts） */
  function isCodeScriptsRestored() {
    return _codeScriptsRestored;
  }

  /** 取当前语言下积木对应的代码片段（内置 API + 扩展 code_exp, 供拖拽转代码） */
  function getBlockCodeSnippet(blockType) {
    if (typeof CodeModeBlocks === 'undefined') return null;
    return CodeModeBlocks.toCode(blockType, _codeCfg().runner);
  }

  /** 把拖入代码框的积木转换为当前语言代码并插入光标处 */
  function insertBlockAsCode(blockType) {
    if (!_codeEditor) return;
    const lines = getBlockCodeSnippet(blockType);
    if (!lines || !lines.length) return;
    _syncCurrentCode();
    const text = lines.join('\n');
    _codeEditor.focus();
    const cur = _codeEditor.getCursor();
    // 已有内容时在下方新起行插入（不覆盖现有代码）
    const atLineEnd = { line: cur.line, ch: _codeEditor.getLine(cur.line).length };
    const prefix = (_codeEditor.getValue() && _codeEditor.getValue().trim()) ? '\n' : '';
    _codeEditor.replaceRange(prefix + text + '\n', atLineEnd);
    _codeEditor.setCursor({ line: atLineEnd.line + prefix.split('\n').length - 1 + lines.length, ch: 0 });
    EditorState._isDirty = true;
    const statusEl = document.getElementById('code-status');
    if (statusEl) {
      statusEl.textContent = '已插入代码';
      setTimeout(() => { if (statusEl && statusEl.textContent === '已插入代码') statusEl.textContent = ''; }, 1500);
    }
  }

  /** 代码编程模式语言配置: 用代码编写 Objector 游戏（渲染进程内解释执行, 保留舞台） */
  const CODE_LANG_CONFIG = {
    'code-python': {
      label: 'Python', cmMode: 'python', ext: 'py', runner: 'python',
      template:
        '# Objector 代码编程 · Python\n' +
        '# 代码每隔一帧执行一次(约10帧/秒), 用 get_var/set_var 在帧之间保持状态\n' +
        '# 常用API: move(10) turn_right(15) say("你好") goto_xy(0,0) key_pressed("space")\n' +
        '# 用 set_sprite("角色名") 切换代码操作的角色\n' +
        '# 多线程: def worker(): ...  t = thread_spawn(worker)  thread_kill(t)  thread_id()\n\n' +
        'if not has_var("started"):\n' +
        '    say("你好, 我是 Python!")\n' +
        '    set_var("started", 1)\n\n' +
        'move(2)\n' +
        'if get_x() > 230:\n' +
        '    set_x(-230)\n',
    },
    'code-javascript': {
      label: 'JavaScript', cmMode: 'javascript', ext: 'js', runner: 'javascript',
      template:
        '// Objector 代码编程 · JavaScript\n' +
        '// 代码每隔一帧执行一次(约30帧/秒), 用 globalVars 在帧之间保持状态\n' +
        '// 对象: sprite(x/y/direction/size/say/move...), stage(鼠标/键盘/角色列表)\n' +
        '// 平铺函数同样可用: say("你好"), move(10), key_pressed("space"), set_var("hp",100)\n' +
        '// 多线程: const t = thread_spawn(() => { ... }, 50); thread_kill(t); thread_id()\n\n' +
        'sprite.x += 2;\n' +
        'if (sprite.x > 230) sprite.x = -230;\n' +
        'if (!globalVars.greeted) { sprite.say("你好, 我是 JavaScript!"); globalVars.greeted = true; }\n',
    },
    'code-alb': {
      label: 'ALB', cmMode: 'text/x-alb', ext: 'alb', runner: 'alb',
      template:
        '; Objector 代码编程 · ALB (Objector 独有语言)\n' +
        '; 代码每隔一帧执行一次(约30帧/秒), 用 get_var/set_var 在帧之间保持状态\n' +
        '; 可用函数: move turn_right say goto_xy key_pressed get_var set_var ...\n' +
        '; 多线程: (thread_spawn (func () (move 1))) 返回线程id; thread_kill id / thread_id\n\n' +
        '(if (== (get_var "started" 0) 0)\n' +
        '    (do (say "你好, 我是 ALB!")\n' +
        '        (set_var "started" 1)))\n\n' +
        '(move 2)\n' +
        '(if (> (get_x) 230) (set_x -230))\n',
    },
  };

  /** 取当前代码语言配置（由 initCodeMode 显式设定, 不依赖 projectMode 的赋值时机） */
  function _codeCfg() {
    return CODE_LANG_CONFIG[_codeLangKey] || CODE_LANG_CONFIG['code-python'];
  }

  /** 代码模式布局: 保留左侧积木栏（拖积木转代码）与右侧角色/音频栏, 中间积木编辑区替换为代码编辑器 */
  function _applyCodeLayout() {
    const mainLayout = document.getElementById('main-layout');
    const codeLayout = document.getElementById('code-layout');
    const rightPanel = document.getElementById('right-panel');
    if (!mainLayout || !codeLayout) return;
    // 隐藏与代码模式互斥的布局
    document.getElementById('advanced-layout')?.classList.add('hidden');
    document.getElementById('data-layout')?.classList.add('hidden');
    document.getElementById('mc-layout')?.classList.add('hidden');
    // 主布局保持显示（保留右侧角色/音频栏, 即"保留舞台等"）
    mainLayout.classList.remove('hidden');
    // 积木栏保留: 拖积木到代码框时自动转换为对应语言的代码
    document.getElementById('palette-panel')?.classList.remove('hidden');
    document.getElementById('editor-panel')?.classList.add('hidden');
    document.getElementById('toolbar')?.classList.add('hidden');
    // 将代码编辑区插入 main-layout 中间位置
    if (codeLayout.parentNode !== mainLayout) mainLayout.insertBefore(codeLayout, rightPanel || null);
    codeLayout.classList.remove('hidden');
    // 舞台使用独立面板窗口（与普通模式相同）
    _lastStageJSON = '';
    _initPanels();
  }

  function initCodeMode(mode, opts) {
    // 先确定语言键: mode 可能是 'code-alb' / 'code-javascript' / 'alb' / 裸 'code'（旧项目）
    _codeLangKey = _normalizeCodeModeKey(mode) || _normalizeCodeModeKey(EditorState.projectMode) || _codeLangKey;
    const cfg = CODE_LANG_CONFIG[_codeLangKey] || CODE_LANG_CONFIG['code-python'];
    _applyCodeLayout();
    console.log(`[代码编程模式] ${cfg.label} (游戏代码编辑, 保留舞台)`);

    // 更新语言标签
    const langLabel = document.getElementById('code-lang-label');
    if (langLabel) langLabel.textContent = cfg.label;

    if (_codeModeInitialized) {
      // 已初始化: 切换语言前先把编辑器内容写回旧语言存储, 再载入当前角色新语言代码
      // opts.restore: 项目刚加载完, 存储中已是磁盘上的真实代码, 不能反向用编辑器内容覆盖
      if (!opts || !opts.restore) _syncCurrentCode();
      if (_codeEditor) {
        try { _codeEditor.setOption('mode', cfg.cmMode); } catch (e) { /* ignore */ }
        try { _codeEditor.setOption('tabSize', cfg.runner === 'python' ? 4 : 2); } catch (e) { /* ignore */ }
        _registerCodeHints(_codeEditor, cfg.cmMode);
        _ensureSpriteCodeLoaded(_activeCodeKey());
        if (_codeEditor) {
          _applySpriteCodeToEditor(_activeCodeKey());
          setTimeout(() => _codeEditor && _codeEditor.refresh(), 100);
        }
        _persistCodeScripts(); // 切语言时自动落盘
      }
      setTimeout(() => { if (_codeEditor) _codeEditor.refresh(); }, 200);
      return;
    }
    _codeModeInitialized = true;

    // 角色切换时保存/加载对应角色的代码
    if (typeof StageManager !== 'undefined' && StageManager.onActiveSpriteChange) {
      StageManager.onActiveSpriteChange(_onCodeSpriteSelected);
    }

    // 角色重命名时迁移代码存储（_codeScripts 键名 + 磁盘文件 + _codeEditorOwner）
    if (typeof StageManager !== 'undefined' && StageManager.onSpriteRename) {
      StageManager.onSpriteRename(async (idx, oldName, newName) => {
        if (!_isCodeProjectMode() || !oldName || !newName || oldName === newName) return;
        // 1) 先把编辑器当前内容写回旧名字的存储
        _syncAllSpriteCode();
        // 2) 迁移 _codeScripts 键: 旧名 → 新名
        if (_codeScripts[oldName]) {
          _codeScripts[newName] = _codeScripts[oldName];
          delete _codeScripts[oldName];
        }
        // 3) 更新编辑器归属
        if (_codeEditorOwner === oldName) _codeEditorOwner = newName;
        // 4) 删除磁盘上旧名的代码文件（异步, 不阻塞）
        if (EditorState.projectPath) {
          const codeDir = EditorState.projectPath + '/code';
          Object.keys(_RUNNER_EXT).forEach(runner => {
            const ext = _RUNNER_EXT[runner];
            if (window.api.deleteFile) window.api.deleteFile(codeDir + '/' + _safeCodeFileName(oldName) + '.' + ext);
          });
        }
        // 5) 立即落盘（新名文件 + project.json）
        _persistCodeScripts();
        console.log('[代码编程模式] 角色重命名:', oldName, '→', newName, '代码已迁移');
      });
    }

    // 角色删除时清理代码存储（_codeScripts 键名 + 磁盘文件）
    if (typeof StageManager !== 'undefined' && StageManager.onSpriteDelete) {
      StageManager.onSpriteDelete(async (idx, name) => {
        if (!_isCodeProjectMode() || !name) return;
        // 1) 删除 _codeScripts 键
        delete _codeScripts[name];
        // 2) 清理编辑器归属
        if (_codeEditorOwner === name) _codeEditorOwner = '';
        // 3) 删除磁盘上的代码文件（异步, 不阻塞）
        if (EditorState.projectPath) {
          const codeDir = EditorState.projectPath + '/code';
          Object.keys(_RUNNER_EXT).forEach(runner => {
            const ext = _RUNNER_EXT[runner];
            if (window.api.deleteFile) window.api.deleteFile(codeDir + '/' + _safeCodeFileName(name) + '.' + ext);
          });
        }
        // 4) 立即落盘（project.json）
        _persistCodeScripts();
        console.log('[代码编程模式] 角色删除:', name, '代码已清理');
      });
    }

    // 初始化 CodeMirror
    const editorWrap = document.getElementById('code-editor-wrap');
    if (editorWrap && typeof CodeMirror !== 'undefined' && !_codeEditor) {
      _codeEditor = CodeMirror(editorWrap, {
        mode: cfg.cmMode,
        theme: 'material-darker',
        lineNumbers: true,
        tabSize: cfg.runner === 'python' ? 4 : 2,
        indentWithTabs: false,
        matchBrackets: true,
        autoCloseBrackets: true,
        value: cfg.template,
        extraKeys: { 'Ctrl-Space': 'autocomplete' },
        hintOptions: { completeSingle: false },
      });

      // 注册语言特定的关键词补全
      _registerCodeHints(_codeEditor, cfg.cmMode);

      // 编辑即同步: 标脏 + 防抖自动回写 config.codeScripts（避免忘记保存/切角色丢代码）
      let _codeSaveTimer = null;
      _codeEditor.on('change', () => {
        if (_codeApplying) return;
        _syncCurrentCode();
        EditorState._isDirty = true;
        clearTimeout(_codeSaveTimer);
        _codeSaveTimer = setTimeout(() => { _syncAllSpriteCode(); _persistCodeScripts(); }, 1200);
      });

      // 延迟刷新确保正确渲染
      setTimeout(() => _codeEditor && _codeEditor.refresh(), 100);
    }

    // 保存: 代码按角色存入内存, 并立即写入 code/<角色>.<ext> 独立文件 + project.json 的 config.codeScripts
    document.getElementById('code-save-btn')?.addEventListener('click', async () => {
      if (!_codeEditor) return;
      _syncAllSpriteCode();
      EditorState._isDirty = true; // 标记未保存, 项目保存(Ctrl+S)时一并持久化
      const ok = await _persistCodeScripts();
      const statusText = document.getElementById('code-status');
      if (statusText) {
        statusText.textContent = ok ? '✓ 已保存' : '✗ 保存失败';
        setTimeout(() => { statusText.textContent = ''; }, 2000);
      }
      document.getElementById('status-text').textContent = ok ? '代码已保存' : '代码保存失败（详见控制台）';
      setTimeout(() => {
        document.getElementById('status-text').textContent = i18n.t('status.ready');
      }, 2000);
    });

    document.getElementById('code-clear-btn')?.addEventListener('click', () => {
      if (!_codeEditor) return;
      if (confirm('确定清空所有代码吗？')) {
        _codeEditor.setValue('');
      }
    });

    // 搜索按钮：触发 CodeMirror 的查找功能
    document.getElementById('code-search-btn')?.addEventListener('click', () => {
      if (_codeEditor) _codeEditor.execCommand('find');
    });

    // 上传造型按钮
    document.getElementById('code-upload-costume-btn')?.addEventListener('click', () => {
      if (typeof uploadCostumeDialog === 'function') uploadCostumeDialog();
    });

    // 舞台按钮：切换舞台面板可见性
    document.getElementById('code-stage-btn')?.addEventListener('click', () => {
      const stagePanel = document.getElementById('stage-panel');
      if (stagePanel) {
        stagePanel.classList.toggle('hidden');
      }
    });

    document.getElementById('code-run-btn')?.addEventListener('click', () => {
      if (!_codeEditor) return;
      const cfg = _codeCfg();
      const outputWrap = document.getElementById('code-output-wrap');
      const outputEl = document.getElementById('code-output');
      const runBtn = document.getElementById('code-run-btn');
      const stopBtn = document.getElementById('code-stop-btn');
      const statusEl = document.getElementById('code-status');

      // 显示输出面板, 清空内容
      outputWrap?.classList.remove('hidden');
      if (outputEl) outputEl.textContent = '';

      // 逐行追加输出（解释器输出可能自带换行）
      const appendLine = (text) => {
        if (!outputEl) return;
        outputEl.textContent += String(text).replace(/\n+$/, '') + '\n';
        outputEl.scrollTop = outputEl.scrollHeight;
      };

      // 在渲染进程内启动代码运行时: 每个角色逐帧执行各自的代码, 线程绑定角色上下文
      const sources = getSpriteCodeSources();
      _persistCodeScripts(); // 运行前落盘, 避免忘记保存
      const ok = (typeof CodeRuntime !== 'undefined') && CodeRuntime.start(cfg.runner, sources, {
        onOutput: appendLine,
        onFrame: () => _pushPanelSprites(), // 每帧把角色数据推送到舞台面板窗口
        onStop: () => { // 运行时因错误自行停止时同步按钮状态
          if (runBtn) runBtn.disabled = false;
          if (stopBtn) stopBtn.disabled = true;
          if (statusEl) statusEl.textContent = '❌ 出错终止';
        },
      });
      if (!ok) {
        appendLine('❌ 运行时启动失败: ' + cfg.label + ' 解释器不可用');
        return;
      }
      if (runBtn) runBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;
      if (statusEl) statusEl.textContent = '运行中...';
    });

    document.getElementById('code-stop-btn')?.addEventListener('click', () => {
      if (typeof CodeRuntime !== 'undefined') CodeRuntime.stop();
      const runBtn = document.getElementById('code-run-btn');
      const stopBtn = document.getElementById('code-stop-btn');
      const statusEl = document.getElementById('code-status');
      if (runBtn) runBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
      if (statusEl) statusEl.textContent = '✓ 已停止';
      // 停止后推送一次最终舞台状态
      _lastStageJSON = '';
      _pushPanelSprites();
      setTimeout(() => { const s = document.getElementById('code-status'); if (s && s.textContent === '✓ 已停止') s.textContent = ''; }, 3000);
    });

    // 载入当前角色的代码（未保存过的角色先做旧版单文件迁移）
    _ensureSpriteCodeLoaded(_activeCodeKey());
    _applySpriteCodeToEditor(_activeCodeKey());

    // 窗口大小改变时刷新
    window.addEventListener('resize', () => {
      if (_codeEditor) setTimeout(() => _codeEditor.refresh(), 100);
    });

    // 在状态栏显示当前语言
    const statusText = document.getElementById('status-text');
    if (statusText) {
      statusText.textContent = `代码编程：${cfg.label}（舞台在舞台窗口运行）`;
    }
  }

  /** 加载已保存的代码文件 */
  async function _loadCodeFile(ext) {
    if (!EditorState.projectPath) return null;
    try {
      return await window.api.readFile(EditorState.projectPath + '/scripts/main.' + ext);
    } catch {
      return null;
    }
  }

  /** 获取代码编辑器实例 */
  function getCodeEditor() {
    return _codeEditor;
  }

  /** 获取当前精灵的 JS 脚本 */
  function getSpriteScript(index) {
    return _getSceneScripts()[index] || '';
  }

  /** 设置当前精灵的 JS 脚本 */
  function setSpriteScript(index, code) {
    _getSceneScripts()[index] = code;
  }

  /** 获取所有精灵脚本（用于保存，按场景） */
  function getAllSpriteScripts() {
    return { ..._spriteScripts };
  }

  /** 批量设置精灵脚本（用于加载，按场景） */
  function setAllSpriteScripts(scripts) {
    _spriteScripts = scripts || {};
  }

  /** 获取 CodeMirror 实例 */
  function getJsEditor() {
    return _codeMirrorInstance;
  }

  /** 获取节点的 JS 脚本（非 Sprite2D 节点） */
  function getNodeScript(nodeId) {
    return _getSceneNodeScripts()[nodeId] || '';
  }

  /** 设置节点的 JS 脚本（非 Sprite2D 节点） */
  function setNodeScript(nodeId, code) {
    _getSceneNodeScripts()[nodeId] = code;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // 全局错误捕获（帮助定位问题）
    window.addEventListener('error', (e) => {
      console.error('[全局错误]', e.message, e.filename, e.lineno);
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('[未处理的Promise拒绝]', e.reason);
    });

    // 加载用户设置的主题和自定义CSS
    try {
      const settings = JSON.parse(localStorage.getItem('objector-settings') || '{}');
      if (settings.theme) {
        document.documentElement.setAttribute('data-theme', settings.theme);
      }
      if (settings.customCss) {
        let styleEl = document.getElementById('custom-style');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'custom-style';
          document.head.appendChild(styleEl);
        }
        styleEl.textContent = settings.customCss;
      }
    } catch (e) {
      console.warn('[设置] 加载主题失败:', e);
    }

    // 应用 i18n 到 DOM
    i18n.applyToDOM();

    // 获取 URL 参数中的渲染模式
    const params = new URLSearchParams(window.location.search);
    const renderMode = params.get('render') || '2d';

    try {
    // 初始化各模块
    console.log('[初始化] EditorCanvas...');
    EditorCanvas.init();
    console.log('[初始化] Palette...');
    Palette.init();

    // 根据渲染模式初始化舞台（离屏 canvas，实际渲染由面板窗口负责）
    if (renderMode === '3d' && typeof Stage3D !== 'undefined') {
      console.log('[初始化] Stage3D (3D 模式)...');
      let stageCanvas = document.getElementById('stage-canvas');
      if (!stageCanvas) {
        stageCanvas = document.createElement('canvas');
        stageCanvas.id = 'stage-canvas';
        stageCanvas.width = 480;
        stageCanvas.height = 360;
        console.log('[初始化] 使用离屏 canvas 供 Stage3D');
      }
      const success = Stage3D.init(stageCanvas);
      if (!success) {
        console.warn('[Stage3D] 初始化失败，回退到 2D 模式');
        StageCanvas.init(stageCanvas);
      }
    } else {
      console.log('[初始化] StageCanvas (2D 模式)...');
      StageCanvas.init(); // 内部自动创建离屏 canvas
    }

    console.log('[初始化] StageManager...');
    StageManager.init();
    console.log('[初始化] FileEditor...');
    FileEditor.init();
    console.log('[初始化] DevMode...');
    DevMode.init();
    console.log('[初始化] 所有模块初始化完成');
    } catch(e) {
      console.error('[初始化失败]', e);
    }

    // 初始化侦测输入：跳过本地画布绑定（canvas 已离屏），仅绑定键盘事件
    document.addEventListener('keydown', (e) => {
      if (typeof SensingInput !== 'undefined' && SensingInput._setKey) {
        const mapped = SensingInput._mapKey ? SensingInput._mapKey(e.key) : e.key.toLowerCase();
        SensingInput._setKey(mapped, true);
      }
    });
    document.addEventListener('keyup', (e) => {
      if (typeof SensingInput !== 'undefined' && SensingInput._setKey) {
        const mapped = SensingInput._mapKey ? SensingInput._mapKey(e.key) : e.key.toLowerCase();
        SensingInput._setKey(mapped, false);
      }
    });
    // 从舞台面板接收 IPC 输入（鼠标/键盘）
    SensingInput.initFromPanel();

    // 初始化扩展计时器
    window.__extTimerStart = Date.now();

    // 获取项目路径和模式：优先从 IPC 获取（避免 file:// URL 中文编码问题），回退到 URL 参数
    let initData = null;
    try {
      if (window.api && window.api.getEditorInit) {
        initData = await window.api.getEditorInit();
      }
    } catch(e) {}
    const projectPath = (initData && initData.path) || params.get('path');
    const projectMode = (initData && initData.mode) || params.get('mode') || 'normal';
    const ipcRenderMode = (initData && initData.render) || params.get('render') || '2d';

    // 保存渲染模式到全局状态
    if (typeof EditorState !== 'undefined') {
      EditorState.renderMode = ipcRenderMode;
    }

    // 如果 IPC 传入的 renderMode 是 3d，但舞台已初始化为 2D，则切换到 3D
    if (ipcRenderMode === '3d' && renderMode !== '3d') {
      console.log('[初始化] IPC renderMode=3d，切换到 3D 模式...');
      switchTo3D();
    }

    // 高级模式初始化
    if (projectMode === 'advanced') {
      initAdvancedMode();
    }

    // 数据分析模式初始化
    if (projectMode === 'data') {
      initDataMode();
    }

    // Minecraft 模组开发模式初始化
    if (projectMode === 'minecraft') {
      initMinecraftMode();
    }

    // microbit 硬件模式初始化（在 loadProject 之后执行，因为 projectMode 在 loadProject 中设置）

    // 代码编程模式初始化
    if (projectMode && String(projectMode).indexOf('code') === 0) {
      initCodeMode(projectMode);
    }

    if (projectPath) {
      await loadProject(projectPath, projectMode);
    } else if (projectMode && projectMode !== 'normal') {
      // 无 projectPath 但有 projectMode，手动设置
      console.log('[init] 无 projectPath，手动设置 projectMode:', projectMode);
      EditorState.projectMode = projectMode;
    }

    // 安全回退: 确保 microbit 模式初始化（防止 loadProject 中某步异常导致跳过）
    if (typeof EditorState !== 'undefined' && EditorState.projectMode && EditorState.projectMode.startsWith('microbit')) {
      if (!_microbitInited) {
        console.log('[microbit] 安全回退: initMicrobitMode 未被 loadProject 调用，在此执行');
      }
      try { initMicrobitMode(EditorState.projectMode); } catch(e) { console.warn('[microbit] 安全回退初始化失败:', e); }
    } else if (projectMode && projectMode.startsWith('microbit')) {
      // projectMode 参数是 microbit 但 EditorState.projectMode 没有设置
      console.warn('[microbit] 警告: projectMode参数为', projectMode, '但 EditorState.projectMode 为', EditorState.projectMode, '，强制设置');
      EditorState.projectMode = projectMode;
      try { initMicrobitMode(projectMode); } catch(e) { console.warn('[microbit] 强制初始化失败:', e); }
    }

    // 社区作品在线预览：通过项目 ID 从社区 API 加载
    const previewId = params.get('preview');
    if (previewId) {
      loadProjectFromCommunity(previewId);
    }

    // ==================== 菜单栏交互 ====================
    const _actionHome = () => {
      if (EditorState._isDirty) {
        const msg = i18n.isEnglish() ? 'You have unsaved changes. Close anyway?' : '您有未保存的更改，确定要关闭吗？';
        if (!confirm(msg)) return;
      }
      // 关闭窗口
      if (window.api && window.api.windowClose) {
        window.api.windowClose();
      } else {
        window.close();
      }
    };
    const _actionSave = async () => {
      await ProjectManager.saveProject();
      EditorState._isDirty = false;
      EditorState._blocksSnapshot = JSON.stringify(EditorState.blocks);
    };

    // 运行时锁定编辑区
    function _lockEditorForRuntime() {
      const overlay = document.getElementById('runtime-overlay');
      const isMicrobit = typeof EditorState !== 'undefined' && EditorState.projectMode && EditorState.projectMode.startsWith('microbit');
      if (overlay) overlay.classList.remove('hidden');
      // microbit 模式: 仅锁定编辑区 (角色栏已隐藏, 积木栏保持可用)
      // 其他模式: 锁定全部三栏
      const lockIds = isMicrobit ? ['editor-panel'] : ['palette-panel', 'editor-panel', 'right-panel'];
      lockIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('locked');
      });
    }

    function _unlockEditorAfterRuntime() {
      const overlay = document.getElementById('runtime-overlay');
      if (overlay) overlay.classList.add('hidden');
      ['palette-panel', 'editor-panel', 'right-panel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('locked');
      });
    }

    const _actionRun = async () => {
      // 始终在编辑器本地执行
      Executor.clearOutput();
      _jsScriptFrameCount = 0;  // 重置帧计数器（用于调试日志）
      const outputLog = document.getElementById('output-log');
      if (outputLog) outputLog.textContent = '';
      // 清空面板输出
      if (_panelsOpened && window.api && window.api.sendPanelUpdate) {
        window.api.sendPanelUpdate({ type: 'output', action: 'set', text: '' });
      }
      // 高级模式：将标签页中的积木同步到精灵对象（executor 运行时从精灵读取）
      if (typeof _flushBlocksToSprites === 'function') {
        _flushBlocksToSprites();
      }
      // 锁定编辑区，禁止运行时编辑
      _lockEditorForRuntime();
      // 启动高频推送精灵数据到舞台面板（~60fps）
      _startStagePushTimer();
      // 本地执行
      await Executor.run();
      // 执行完成后停止推送
      _stopStagePushTimer();
      // 解除锁定
      _unlockEditorAfterRuntime();
      // 最后一次推送确保最终状态同步
      _pushPanelSprites();
    };
    const _actionStop = () => {
      _stopStagePushTimer();
      Executor.stop();
      SoundManager.stopAll();
      // 解除编辑区锁定
      _unlockEditorAfterRuntime();
      // 停止后最终推送一次
      _pushPanelSprites();
    };
    const _actionForceStop = () => {
      _stopStagePushTimer();
      Executor.forceStop();
      SoundManager.stopAll();
      // 解除编辑区锁定
      _unlockEditorAfterRuntime();
      _pushPanelSprites();
    };
    const _actionExportHtml = () => {
      if (typeof HtmlExporter === 'undefined') { alert('HtmlExporter 未加载！'); return; }
      const dlg = document.getElementById('export-settings-dialog');
      if (dlg) {
        const titleInput = document.getElementById('export-title');
        if (titleInput) titleInput.value = EditorState.projectName || '';
        // 初始化默认显示 HTML 选项
        _updateExportOptions();
        dlg.classList.remove('hidden');
      } else {
        HtmlExporter.exportProject({ touchControls:true, fullscreenBtn:true, showConsole:true }).catch(e => alert('导出失败: ' + e.message));
      }
    };

    // ==================== 触屏按键配置 ====================
    const DEFAULT_TOUCH_KEYS = [
      { id: 'up',    label: '▲', keyCode: 'ArrowUp',    x: 8,  y: 28, size: 42, shape: 'rect',   color: '#89b4fa', texture: '' },
      { id: 'down',  label: '▼', keyCode: 'ArrowDown',  x: 8,  y: 5,  size: 42, shape: 'rect',   color: '#89b4fa', texture: '' },
      { id: 'left',  label: '◀', keyCode: 'ArrowLeft',  x: 2,  y: 16, size: 42, shape: 'rect',   color: '#89b4fa', texture: '' },
      { id: 'right', label: '▶', keyCode: 'ArrowRight', x: 14, y: 16, size: 42, shape: 'rect',   color: '#89b4fa', texture: '' },
      { id: 'btn-a', label: 'A', keyCode: 'Space',      x: 88, y: 18, size: 52, shape: 'circle', color: '#a6e3a1', texture: '' },
      { id: 'btn-b', label: 'B', keyCode: 'Enter',      x: 78, y: 6,  size: 46, shape: 'circle', color: '#f38ba8', texture: '' },
    ];
    let _touchConfig = JSON.parse(JSON.stringify(DEFAULT_TOUCH_KEYS));

    // 摇杆默认配置
    const DEFAULT_JOYSTICK = {
      enabled: true, x: 12, y: 16, size: 120, color: '#89b4fa',
      mode: '4key',
      keys: {
        up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
        upLeft: 'KeyQ', upRight: 'KeyE', downLeft: 'KeyZ', downRight: 'KeyC'
      }
    };
    let _joystickConfig = JSON.parse(JSON.stringify(DEFAULT_JOYSTICK));

    // ---- 触屏配置自动保存/加载 ----
    const _TOUCH_STORAGE_KEY = 'objector_touch_config';
    const _JOYSTICK_STORAGE_KEY = 'objector_joystick_config';
    function _saveTouchConfig() {
      try { localStorage.setItem(_TOUCH_STORAGE_KEY, JSON.stringify(_touchConfig)); } catch(e) {}
    }
    function _saveJoystickConfig() {
      try { localStorage.setItem(_JOYSTICK_STORAGE_KEY, JSON.stringify(_joystickConfig)); } catch(e) {}
    }
    function _loadTouchConfig() {
      try {
        const s = localStorage.getItem(_TOUCH_STORAGE_KEY);
        if (s) { _touchConfig = JSON.parse(s); }
      } catch(e) {}
    }
    function _loadJoystickConfig() {
      try {
        const s = localStorage.getItem(_JOYSTICK_STORAGE_KEY);
        if (s) { _joystickConfig = JSON.parse(s); }
      } catch(e) {}
    }
    // 从 localStorage 加载已保存的配置
    _loadTouchConfig();
    _loadJoystickConfig();

    // 构建按键下拉选项 HTML
    function _buildKeyOptions() {
      const isEn = i18n.isEnglish();
      const groups = [
        { group: isEn ? 'Arrows' : '方向键', keys: ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'] },
        { group: isEn ? 'Actions' : '动作',  keys: ['Space','Enter','Escape','ShiftLeft','ControlLeft'] },
        { group: isEn ? 'Letters' : '字母',  keys: Array.from({length:26},(_,i)=>'Key'+String.fromCharCode(65+i)) },
        { group: isEn ? 'Numbers' : '数字',  keys: Array.from({length:10},(_,i)=>'Digit'+i) },
      ];
      return groups.map(g => `<optgroup label="${g.group}">${g.keys.map(k=>`<option value="${k}">${k.replace('Key','').replace('Digit','').replace('Arrow','')}</option>`).join('')}</optgroup>`).join('');
    }

    // 显示/隐藏“设置按键”按钮
    function _updateTouchConfigBtnVisibility() {
      const btn = document.getElementById('export-touch-config-btn');
      const chk = document.getElementById('export-touch');
      if (btn) btn.style.display = (chk && chk.checked) ? '' : 'none';
    }
    document.getElementById('export-touch')?.addEventListener('change', _updateTouchConfigBtnVisibility);

    // 打开触屏按键配置面板
    function _openTouchConfigPanel() {
      const overlay = document.getElementById('touch-config-overlay');
      if (!overlay) return;
      overlay.classList.remove('hidden');
      _renderTouchConfigPanel();
    }

    // 关闭配置面板
    function _closeTouchConfigPanel() {
      const overlay = document.getElementById('touch-config-overlay');
      if (overlay) overlay.classList.add('hidden');
    }

    // 构建配置面板完整 UI
    function _renderTouchConfigPanel() {
      const overlay = document.getElementById('touch-config-overlay');
      if (!overlay) return;
      const isEn = i18n.isEnglish();
      let optGroups = _buildKeyOptions();
    
      overlay.innerHTML = `<div class="custom-prompt-box" style="max-width:720px;width:96%;max-height:92vh;overflow-y:auto;">
        <div class="custom-prompt-title" style="font-size:14px;">\u2328\ufe0f ${isEn ? 'Touch Controls Config' : '触屏按键配置'}</div>
        <div style="display:flex;gap:14px;flex-wrap:wrap;">
          <!-- 左列：按键列表 -->
          <div id="tc-list" style="flex:1;min-width:240px;max-height:360px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;"></div>
          <!-- 右列：预览 -->
          <div style="flex:1;min-width:260px;">
            <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">${isEn ? 'Preview (drag buttons to reposition)' : '预览（拖动按钮调整位置）'}</div>
            <div id="tc-preview" style="position:relative;width:100%;aspect-ratio:16/9;background:#1a1a2e;border:1px solid var(--border);border-radius:8px;overflow:hidden;cursor:default;"></div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:space-between;align-items:center;flex-wrap:wrap;">
          <div style="display:flex;gap:6px;">
            <button id="tc-add" type="button" class="tb-btn" style="font-size:12px;">+ ${isEn ? 'Add Button' : '添加按键'}</button>
            <button id="tc-reset" type="button" class="tb-btn" style="font-size:12px;">\u21ba ${isEn ? 'Reset Default' : '恢复默认'}</button>
          </div>
          <button id="tc-close" type="button" class="tb-btn tb-run" style="font-size:12px;">${isEn ? 'Done' : '确定'}</button>
        </div>
        <!-- 摇杆配置区 -->
        <div id="tc-joystick-section" style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;"></div>
      </div>`;
    
      // 事件绑定
      overlay.querySelector('#tc-close')?.addEventListener('click', _closeTouchConfigPanel);
      overlay.querySelector('#tc-add')?.addEventListener('click', () => {
        const newId = 'btn-' + Date.now().toString(36);
        _touchConfig.push({ id: newId, label: '?', keyCode: 'Space', x: 50, y: 50, size: 48, shape: 'circle', color: '#f9e2af', texture: '' });
        _saveTouchConfig();
        _renderTouchConfigPanel();
      });
      overlay.querySelector('#tc-reset')?.addEventListener('click', () => {
        _touchConfig = JSON.parse(JSON.stringify(DEFAULT_TOUCH_KEYS));
        _joystickConfig = JSON.parse(JSON.stringify(DEFAULT_JOYSTICK));
        _saveTouchConfig();
        _saveJoystickConfig();
        _renderTouchConfigPanel();
      });
      overlay.addEventListener('click', (e) => { if (e.target === overlay) _closeTouchConfigPanel(); });
    
      _renderTouchList(optGroups);
      _renderTouchPreview();
      _renderJoystickConfig(optGroups);
    }

    // 渲染按键列表
    function _renderTouchList(optGroups) {
      const list = document.getElementById('tc-list');
      if (!list) return;
      const isEn = i18n.isEnglish();
      list.innerHTML = '';
      _touchConfig.forEach((btn, idx) => {
        const card = document.createElement('div');
        card.style.cssText = 'display:flex;align-items:center;gap:5px;padding:5px 7px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;font-size:11px;';
        card.innerHTML = `
          <span style="width:8px;height:8px;border-radius:50%;background:${btn.color};flex-shrink:0;"></span>
          <input type="text" value="${btn.label.replace(/"/g,'&quot;')}" maxlength="4" style="width:32px;padding:2px 4px;background:var(--bg-surface);border:1px solid var(--border);border-radius:3px;color:var(--text-primary);font-size:11px;text-align:center;" data-idx="${idx}" data-field="label" />
          <select style="flex:1;min-width:70px;padding:2px;background:var(--bg-surface);border:1px solid var(--border);border-radius:3px;color:var(--text-primary);font-size:11px;" data-idx="${idx}" data-field="keyCode">${optGroups}</select>
          <input type="range" min="24" max="80" value="${btn.size}" style="width:50px;accent-color:${btn.color};" data-idx="${idx}" data-field="size" title="${isEn ? 'Size' : '大小'}: ${btn.size}px" />
          <button type="button" style="width:20px;height:20px;border:1px solid var(--border);border-radius:50%;background:${btn.shape==='circle'?btn.color:'var(--bg-surface)'};color:${btn.shape==='circle'?'#000':'var(--text-secondary)'};font-size:9px;cursor:pointer;" data-idx="${idx}" data-action="toggle-shape" title="${btn.shape}">${btn.shape==='circle'?'●':'■'}</button>
          <input type="color" value="${btn.color}" style="width:22px;height:22px;border:none;padding:0;cursor:pointer;background:transparent;" data-idx="${idx}" data-field="color" title="${isEn ? 'Color' : '颜色'}" />
          <label style="cursor:pointer;position:relative;" title="${isEn ? 'Set texture' : '设置贴图'}">
            <span style="font-size:13px;cursor:pointer;">🖼</span>
            <input type="file" accept="image/*" style="display:none;" data-idx="${idx}" data-field="texture" />
          </label>
          <button type="button" style="width:18px;height:18px;border:none;border-radius:3px;background:rgba(243,139,168,.2);color:#f38ba8;font-size:12px;cursor:pointer;flex-shrink:0;" data-idx="${idx}" data-action="delete" title="${isEn ? 'Delete' : '删除'}">✕</button>`;
        // 选中当前 keyCode
        const sel = card.querySelector('select');
        if (sel) sel.value = btn.keyCode;
        list.appendChild(card);
      });

      // 事件委托
      list.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.dataset.field;
        if (isNaN(idx) || !field || !_touchConfig[idx]) return;
        if (field === 'label') { _touchConfig[idx].label = e.target.value; }
        else if (field === 'keyCode') { _touchConfig[idx].keyCode = e.target.value; }
        else if (field === 'size') { _touchConfig[idx].size = parseInt(e.target.value); e.target.title = `${isEn?'Size':'大小'}: ${e.target.value}px`; }
        else if (field === 'color') { _touchConfig[idx].color = e.target.value; }
        else if (field === 'texture') {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => { _touchConfig[idx].texture = ev.target.result; _saveTouchConfig(); _renderTouchConfigPanel(); };
            reader.readAsDataURL(file);
          }
          return;
        }
        _saveTouchConfig();
        _renderTouchPreview();
      });
      list.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.dataset.field;
        if (field === 'keyCode' && !isNaN(idx) && _touchConfig[idx]) {
          _touchConfig[idx].keyCode = e.target.value;
          _saveTouchConfig();
          _renderTouchPreview();
        }
      });
      list.addEventListener('click', (e) => {
        const btn2 = e.target.closest('[data-action]');
        if (!btn2) return;
        const idx = parseInt(btn2.dataset.idx);
        const action = btn2.dataset.action;
        if (action === 'delete') { _touchConfig.splice(idx, 1); _saveTouchConfig(); _renderTouchConfigPanel(); }
        else if (action === 'toggle-shape') { _touchConfig[idx].shape = _touchConfig[idx].shape === 'circle' ? 'rect' : 'circle'; _saveTouchConfig(); _renderTouchConfigPanel(); }
      });
    }

    // 渲染预览区
    function _renderTouchPreview() {
      const preview = document.getElementById('tc-preview');
      if (!preview) return;
      preview.innerHTML = '';
      const rect = preview.getBoundingClientRect();
      _touchConfig.forEach((btn, idx) => {
        const el = document.createElement('div');
        const s = btn.size * (rect.width / 480);
        const px = (btn.x / 100) * rect.width;
        const py = rect.height - (btn.y / 100) * rect.height;
        el.style.cssText = `position:absolute;left:${px}px;top:${py}px;width:${s}px;height:${s}px;display:flex;align-items:center;justify-content:center;font-size:${Math.max(8,s*0.35)}px;font-weight:700;color:#fff;cursor:grab;user-select:none;z-index:${idx+1};`;
        if (btn.shape === 'circle') {
          el.style.borderRadius = '50%';
          el.style.border = `2px solid ${btn.color}80`;
          el.style.background = `${btn.color}20`;
        } else {
          el.style.borderRadius = '6px';
          el.style.border = `1px solid ${btn.color}80`;
          el.style.background = `${btn.color}20`;
        }
        if (btn.texture) {
          el.style.backgroundImage = `url(${btn.texture})`;
          el.style.backgroundSize = 'cover';
          el.style.backgroundPosition = 'center';
          el.textContent = '';
        } else {
          el.textContent = btn.label;
        }
        el.dataset.idx = idx;
        el.title = `${btn.label} → ${btn.keyCode}`;
        // 拖拽定位
        let dragging = false, startX, startY, origX, origY;
        el.addEventListener('mousedown', (e) => {
          e.preventDefault(); dragging = true;
          startX = e.clientX; startY = e.clientY;
          origX = btn.x; origY = btn.y;
          el.style.cursor = 'grabbing'; el.style.zIndex = 100;
        });
        document.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          const dx = ((e.clientX - startX) / rect.width) * 100;
          const dy = ((e.clientY - startY) / rect.height) * 100;
          btn.x = Math.max(0, Math.min(96, origX + dx));
          btn.y = Math.max(0, Math.min(96, origY - dy));
          _renderTouchPreview();
        });
        document.addEventListener('mouseup', () => {
          if (dragging) { dragging = false; el.style.cursor = 'grab'; el.style.zIndex = idx + 1; _saveTouchConfig(); }
        });
        preview.appendChild(el);
      });

      // 渲染摇杆预览
      if (_joystickConfig.enabled) {
        const jc = _joystickConfig;
        const scale = rect.width / 480;
        const js = jc.size * scale;
        const cx = (jc.x / 100) * rect.width;
        const cy = rect.height - (jc.y / 100) * rect.height;
        // 外圈
        const base = document.createElement('div');
        base.style.cssText = `position:absolute;left:${cx - js/2}px;top:${cy - js/2}px;width:${js}px;height:${js}px;border-radius:50%;border:2px solid ${jc.color}60;background:${jc.color}10;display:flex;align-items:center;justify-content:center;cursor:grab;user-select:none;z-index:50;`;
        base.title = '🎮 Joystick';
        // 内圆
        const inner = js * 0.38;
        const knob = document.createElement('div');
        knob.style.cssText = `width:${inner}px;height:${inner}px;border-radius:50%;background:${jc.color}40;border:1px solid ${jc.color}80;`;
        base.appendChild(knob);
        // 方向指示
        const dirs = ['↑','↗','→','↘','↓','↙','←','↖'];
        dirs.forEach((d, i) => {
          const angle = (i * 45 - 90) * Math.PI / 180;
          const r = js / 2 - 4;
          const dx = Math.cos(angle) * r;
          const dy = Math.sin(angle) * r;
          const lbl = document.createElement('div');
          lbl.style.cssText = `position:absolute;left:${cx + dx}px;top:${cy + dy}px;font-size:${Math.max(6, js*0.12)}px;color:${jc.color}80;pointer-events:none;`;
          lbl.textContent = d;
          preview.appendChild(lbl);
        });
        // 拖拽
        let dragging = false, startX2, startY2, origX, origY;
        base.addEventListener('mousedown', (e) => {
          e.preventDefault(); dragging = true;
          startX2 = e.clientX; startY2 = e.clientY;
          origX = jc.x; origY = jc.y;
          base.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', (e) => {
          if (!dragging) return;
          const dx = ((e.clientX - startX2) / rect.width) * 100;
          const dy = ((e.clientY - startY2) / rect.height) * 100;
          jc.x = Math.max(4, Math.min(50, origX + dx));
          jc.y = Math.max(4, Math.min(50, origY - dy));
          _renderTouchPreview();
          _renderJoystickConfig(_buildKeyOptions());
        });
        document.addEventListener('mouseup', () => { if (dragging) { dragging = false; base.style.cursor = 'grab'; _saveJoystickConfig(); } });
        preview.appendChild(base);
      }
    }
    
    // 渲染摇杆配置区
    function _renderJoystickConfig(optGroups) {
      const section = document.getElementById('tc-joystick-section');
      if (!section) return;
      const isEn = i18n.isEnglish();
      const jc = _joystickConfig;
      const selCss = 'padding:2px;background:var(--bg-surface);border:1px solid var(--border);border-radius:3px;color:var(--text-primary);font-size:10px;';
      const labelCss = 'font-size:10px;color:var(--text-secondary);min-width:20px;text-align:center;';
    
      function keySel(name, val) {
        return `<select data-jskey="${name}" style="${selCss}">${optGroups}</select>`;
      }
    
      section.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text-primary);">
            <input type="checkbox" data-js-field="enabled" ${jc.enabled?'checked':''} style="width:16px;height:16px;accent-color:var(--accent);" />
            <span>🎮 ${isEn ? 'Joystick' : '摇杆'}</span>
          </label>
          <select data-js-field="mode" style="padding:2px 6px;background:var(--bg-surface);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:11px;">
            <option value="4key" ${jc.mode==='4key'?'selected':''}>${isEn?'4-Key Mode':'4键模式'} (${isEn?'diagonal = 2 keys':'斜角同时2键'})</option>
            <option value="8key" ${jc.mode==='8key'?'selected':''}>${isEn?'8-Key Mode':'8键模式'} (${isEn?'each direction':'每个方向独立'})</option>
          </select>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
          <label style="font-size:11px;color:var(--text-secondary);">${isEn?'Position X':'X位置'} <input type="range" min="4" max="50" value="${jc.x}" data-js-field="x" style="width:70px;accent-color:var(--accent);vertical-align:middle;"><span style="font-size:10px;color:var(--text-muted);">${jc.x}%</span></label>
          <label style="font-size:11px;color:var(--text-secondary);">${isEn?'Position Y':'Y位置'} <input type="range" min="4" max="50" value="${jc.y}" data-js-field="y" style="width:70px;accent-color:var(--accent);vertical-align:middle;"><span style="font-size:10px;color:var(--text-muted);">${jc.y}%</span></label>
          <label style="font-size:11px;color:var(--text-secondary);">${isEn?'Size':'大小'} <input type="range" min="60" max="200" value="${jc.size}" data-js-field="size" style="width:70px;accent-color:var(--accent);vertical-align:middle;"><span style="font-size:10px;color:var(--text-muted);">${jc.size}px</span></label>
          <label style="font-size:11px;color:var(--text-secondary);">${isEn?'Color':'颜色'} <input type="color" value="${jc.color}" data-js-field="color" style="width:24px;height:24px;border:none;padding:0;cursor:pointer;background:transparent;vertical-align:middle;"></label>
        </div>
        <!-- 4键模式配置 -->
        <div id="js-4key-keys" style="display:${jc.mode==='4key'?'grid':'none'};grid-template-columns:1fr 1fr;gap:4px 10px;margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:4px;"><span style="${labelCss}">↑</span>${keySel('up', jc.keys.up)}</div>
          <div style="display:flex;align-items:center;gap:4px;"><span style="${labelCss}">↓</span>${keySel('down', jc.keys.down)}</div>
          <div style="display:flex;align-items:center;gap:4px;"><span style="${labelCss}">←</span>${keySel('left', jc.keys.left)}</div>
          <div style="display:flex;align-items:center;gap:4px;"><span style="${labelCss}">→</span>${keySel('right', jc.keys.right)}</div>
        </div>
        <!-- 8键模式配置 -->
        <div id="js-8key-keys" style="display:${jc.mode==='8key'?'grid':'none'};grid-template-columns:1fr 1fr;gap:4px 10px;margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:4px;"><span style="${labelCss}">↖</span>${keySel('upLeft', jc.keys.upLeft)}</div>
          <div style="display:flex;align-items:center;gap:4px;"><span style="${labelCss}">↗</span>${keySel('upRight', jc.keys.upRight)}</div>
          <div style="display:flex;align-items:center;gap:4px;"><span style="${labelCss}">↙</span>${keySel('downLeft', jc.keys.downLeft)}</div>
          <div style="display:flex;align-items:center;gap:4px;"><span style="${labelCss}">↘</span>${keySel('downRight', jc.keys.downRight)}</div>
          <div style="display:flex;align-items:center;gap:4px;"><span style="${labelCss}">↑</span>${keySel('up', jc.keys.up)}</div>
          <div style="display:flex;align-items:center;gap:4px;"><span style="${labelCss}">↓</span>${keySel('down', jc.keys.down)}</div>
          <div style="display:flex;align-items:center;gap:4px;"><span style="${labelCss}">←</span>${keySel('left', jc.keys.left)}</div>
          <div style="display:flex;align-items:center;gap:4px;"><span style="${labelCss}">→</span>${keySel('right', jc.keys.right)}</div>
        </div>`;
    
      // 设置下拉框选中值
      section.querySelectorAll('select[data-js-key]').forEach(sel => {
        sel.value = jc.keys[sel.dataset.jsKey] || 'ArrowUp';
      });
    
      // 事件委托
      section.addEventListener('input', (e) => {
        const f = e.target.dataset.jsField;
        if (f === 'x' || f === 'y' || f === 'size') {
          jc[f] = parseInt(e.target.value);
          // 更新显示文本
          const span = e.target.nextElementSibling;
          if (span) span.textContent = e.target.value + (f === 'size' ? 'px' : '%');
          _saveJoystickConfig();
          _renderTouchPreview();
        } else if (f === 'color') {
          jc[f] = e.target.value;
          _saveJoystickConfig();
          _renderTouchPreview();
        }
      });
      section.addEventListener('change', (e) => {
        const f = e.target.dataset.jsField;
        if (f === 'enabled') {
          jc.enabled = e.target.checked;
          _saveJoystickConfig();
          _renderTouchPreview();
        } else if (f === 'mode') {
          jc.mode = e.target.value;
          _saveJoystickConfig();
          _renderJoystickConfig(optGroups);
          _renderTouchPreview();
        }
        const jk = e.target.dataset.jsKey;
        if (jk) {
          jc.keys[jk] = e.target.value;
          _saveJoystickConfig();
        }
      });
    }
    
    // 绑定"设置按键"按钮
    document.getElementById('export-touch-config-btn')?.addEventListener('click', _openTouchConfigPanel);
    _updateTouchConfigBtnVisibility();

    // 导出对话框动态显隐逻辑
    function _updateExportOptions() {
      const fmt = document.querySelector('input[name="export-format"]:checked')?.value || 'html';
      const htmlOpts = document.getElementById('export-html-options');
      const exeOpts = document.getElementById('export-exe-options');
      if (htmlOpts) htmlOpts.style.display = (fmt === 'html') ? 'flex' : 'none';
      if (exeOpts) exeOpts.style.display = (fmt === 'exe') ? 'block' : 'none';
      _updateInstallerOptions();
    }
    function _updateInstallerOptions() {
      const pkg = document.querySelector('input[name="export-package"]:checked')?.value || 'zip';
      const installerOpts = document.getElementById('export-installer-options');
      if (installerOpts) installerOpts.style.display = (pkg === 'installer') ? 'block' : 'none';
    }
    // 格式切换
    document.querySelectorAll('input[name="export-format"]').forEach(r => r.addEventListener('change', _updateExportOptions));
    // 打包方式切换
    document.querySelectorAll('input[name="export-package"]').forEach(r => r.addEventListener('change', _updateInstallerOptions));

    // 导出对话框按钮事件
    document.getElementById('export-confirm')?.addEventListener('click', async () => {
      const dlg = document.getElementById('export-settings-dialog');
      if (dlg) dlg.classList.add('hidden');
      try {
        const format = document.querySelector('input[name="export-format"]:checked')?.value || 'html';
        if (format === 'exe') {
          const settings = {
            title: document.getElementById('export-title')?.value?.trim() || '',
            fullscreenBtn: !!document.getElementById('export-exe-fullscreen')?.checked,
            autoRun: !!document.getElementById('export-exe-autorun')?.checked,
            showConsole: !!document.getElementById('export-exe-console')?.checked,
            targetPlatform: document.querySelector('input[name="export-os"]:checked')?.value || 'win32',
            packageType: document.querySelector('input[name="export-package"]:checked')?.value || 'zip',
            installPathType: document.querySelector('input[name="export-install-path"]:checked')?.value || 'user-select',
          };
          await HtmlExporter.exportAsExe(settings);
        } else {
          const touchEnabled = !!document.getElementById('export-touch')?.checked;
          const settings = {
            title: document.getElementById('export-title')?.value?.trim() || '',
            touchControls: touchEnabled,
            touchConfig: touchEnabled ? JSON.parse(JSON.stringify(_touchConfig)) : null,
            joystickConfig: touchEnabled && _joystickConfig.enabled ? JSON.parse(JSON.stringify(_joystickConfig)) : null,
            fullscreenBtn: !!document.getElementById('export-fullscreen')?.checked,
            autoRun: !!document.getElementById('export-autorun')?.checked,
            showConsole: !!document.getElementById('export-console')?.checked,
          };
          await HtmlExporter.exportProject(settings);
        }
      } catch(e) { alert('导出失败: ' + e.message); }
    });
    document.getElementById('export-cancel')?.addEventListener('click', () => {
      const dlg = document.getElementById('export-settings-dialog');
      if (dlg) dlg.classList.add('hidden');
    });
    // 点击背景关闭
    document.getElementById('export-settings-dialog')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
    });

    // ==================== 积木转代码预览 ====================
    let _codePreviewLang = 'javascript';
    function showCodePreviewDialog() {
      if (typeof BlockCodeConverter === 'undefined') { alert(i18n.isEnglish() ? 'BlockCodeConverter not loaded' : '代码转换器未加载'); return; }
      const blocks = EditorState.blocks || {};
      if (Object.keys(blocks).length === 0) { alert(i18n.isEnglish() ? 'No blocks to convert' : '没有积木可以转换'); return; }
      const code = BlockCodeConverter.convertProject(blocks, _codePreviewLang);
      const dialog = document.getElementById('code-preview-dialog');
      const output = document.getElementById('code-preview-output');
      output.textContent = code;
      dialog.classList.remove('hidden');
      // 更新按钮高亮
      document.getElementById('code-preview-js').className = 'tb-btn' + (_codePreviewLang === 'javascript' ? ' tb-run' : '');
      document.getElementById('code-preview-python').className = 'tb-btn' + (_codePreviewLang === 'python' ? ' tb-run' : '');
    }
    document.getElementById('code-preview-js')?.addEventListener('click', () => { _codePreviewLang = 'javascript'; showCodePreviewDialog(); });
    document.getElementById('code-preview-python')?.addEventListener('click', () => { _codePreviewLang = 'python'; showCodePreviewDialog(); });
    document.getElementById('code-preview-copy')?.addEventListener('click', () => {
      const code = document.getElementById('code-preview-output')?.textContent || '';
      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('code-preview-copy');
        const orig = btn.textContent;
        btn.textContent = i18n.isEnglish() ? '✅ Copied!' : '✅ 已复制';
        setTimeout(() => btn.textContent = orig, 1500);
      });
    });
    document.getElementById('code-preview-close')?.addEventListener('click', () => {
      document.getElementById('code-preview-dialog')?.classList.add('hidden');
    });

    // ==================== 导入 Scratch .sb3 ====================
    function importSB3File() {
      if (typeof SB3Importer === 'undefined') { alert(i18n.isEnglish() ? 'SB3Importer not loaded' : 'SB3导入器未加载'); return; }
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.sb3';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const result = await SB3Importer.importFile(file);
          if (result && result.blocks) {
            // 合并导入的积木到当前项目
            let count = 0;
            for (const [id, block] of Object.entries(result.blocks)) {
              EditorState.blocks[id] = block;
              count++;
            }
            // 刷新画布
            if (typeof EditorCanvas !== 'undefined') EditorCanvas.render();
            EditorState._isDirty = true;
            const msg = i18n.isEnglish() ? `Imported ${count} blocks from ${file.name}` : `已从 ${file.name} 导入 ${count} 个积木`;
            document.getElementById('status-text').textContent = msg;
          }
        } catch (err) {
          alert((i18n.isEnglish() ? 'Import failed: ' : '导入失败: ') + err.message);
        }
      };
      input.click();
    }

    // ==================== 项目模板库 ====================
    const PROJECT_TEMPLATES = [
      {
        id: 'empty', icon: '<img src="../icons/Document.svg" style="height:24px;">',
        name: { zh: '空白项目', en: 'Blank Project' },
        desc: { zh: '从零开始创建', en: 'Start from scratch' },
        blocks: {}
      },
      {
        id: 'move-keys', icon: '<img src="../icons/Run.svg" style="height:24px;">',
        name: { zh: '键盘控制移动', en: 'Keyboard Movement' },
        desc: { zh: '用方向键控制角色移动', en: 'Control sprite with arrow keys' },
        blocks: {
          'tpl_ev1': { id: 'tpl_ev1', type: 'event_key_pressed', params: { key: 'ArrowUp' }, x: 100, y: 100, flowIn: null, flowOut: 'tpl_mv1' },
          'tpl_mv1': { id: 'tpl_mv1', type: 'change_y', params: { dy: 10 }, flowIn: 'tpl_ev1', flowOut: null }
        }
      },
      {
        id: 'bounce', icon: '🏀',
        name: { zh: '弹球动画', en: 'Bouncing Ball' },
        desc: { zh: '角色碰到边缘弹回', en: 'Sprite bounces at edges' },
        blocks: {
          'tpl_ev2': { id: 'tpl_ev2', type: 'event_start', params: {}, x: 100, y: 100, flowIn: null, flowOut: 'tpl_for1' },
          'tpl_for1': { id: 'tpl_for1', type: 'control_forever', params: {}, subBlocks: { body: 'tpl_mv2' }, flowIn: 'tpl_ev2', flowOut: null },
          'tpl_mv2': { id: 'tpl_mv2', type: 'move_steps', params: { steps: 5 }, flowIn: null, flowOut: 'tpl_bnc1' },
          'tpl_bnc1': { id: 'tpl_bnc1', type: 'bounce_edge', params: {}, flowIn: 'tpl_mv2', flowOut: null }
        }
      },
      {
        id: 'say-hello', icon: '<img src="../icons/Document.svg" style="height:24px;">',
        name: { zh: '打招呼', en: 'Say Hello' },
        desc: { zh: '角色说话并等待', en: 'Sprite says hello and waits' },
        blocks: {
          'tpl_ev3': { id: 'tpl_ev3', type: 'event_start', params: {}, x: 100, y: 100, flowIn: null, flowOut: 'tpl_say1' },
          'tpl_say1': { id: 'tpl_say1', type: 'looks_say', params: { text: 'Hello!', sec: 2 }, flowIn: 'tpl_ev3', flowOut: null }
        }
      },
      {
        id: 'click-counter', icon: '🔢',
        name: { zh: '点击计数器', en: 'Click Counter' },
        desc: { zh: '点击角色计数', en: 'Count clicks on sprite' },
        blocks: {
          'tpl_ev4': { id: 'tpl_ev4', type: 'event_sprite_clicked', params: {}, x: 100, y: 100, flowIn: null, flowOut: 'tpl_var1' },
          'tpl_var1': { id: 'tpl_var1', type: 'var_change', params: { name: 'count', delta: 1 }, flowIn: 'tpl_ev4', flowOut: null }
        }
      },
      {
        id: 'follow-mouse', icon: '🖱️',
        name: { zh: '跟随鼠标', en: 'Follow Mouse' },
        desc: { zh: '角色跟随鼠标移动', en: 'Sprite follows the mouse' },
        blocks: {
          'tpl_ev5': { id: 'tpl_ev5', type: 'event_start', params: {}, x: 100, y: 100, flowIn: null, flowOut: 'tpl_for2' },
          'tpl_for2': { id: 'tpl_for2', type: 'control_forever', params: {}, subBlocks: { body: 'tpl_goto_mouse' }, flowIn: 'tpl_ev5', flowOut: null },
          'tpl_goto_mouse': { id: 'tpl_goto_mouse', type: 'go_to_mouse', params: {}, flowIn: null, flowOut: null }
        }
      }
    ];

    function showTemplateDialog() {
      const dialog = document.getElementById('template-dialog');
      const list = document.getElementById('template-list');
      list.innerHTML = '';
      const isEn = i18n.isEnglish();
      PROJECT_TEMPLATES.forEach(tpl => {
        const card = document.createElement('div');
        card.style.cssText = 'padding:14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:all .2s;';
        card.innerHTML = `<div style="font-size:24px;margin-bottom:6px;">${tpl.icon}</div>
          <div style="font-weight:600;font-size:13px;">${isEn ? tpl.name.en : tpl.name.zh}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${isEn ? tpl.desc.en : tpl.desc.zh}</div>`;
        card.addEventListener('mouseenter', () => card.style.borderColor = 'var(--accent)');
        card.addEventListener('mouseleave', () => card.style.borderColor = 'var(--border)');
        card.addEventListener('click', () => loadTemplate(tpl));
        list.appendChild(card);
      });
      dialog.classList.remove('hidden');
    }

    function loadTemplate(tpl) {
      document.getElementById('template-dialog')?.classList.add('hidden');
      // 清空当前积木并加载模板
      EditorState.blocks = JSON.parse(JSON.stringify(tpl.blocks));
      if (typeof EditorCanvas !== 'undefined') EditorCanvas.render();
      EditorState._isDirty = true;
      const isEn = i18n.isEnglish();
      document.getElementById('status-text').textContent = isEn ? `Template loaded: ${tpl.name.en}` : `已加载模板: ${tpl.name.zh}`;
    }

    document.getElementById('template-close')?.addEventListener('click', () => {
      document.getElementById('template-dialog')?.classList.add('hidden');
    });

    // ==================== 变量监视面板 ====================
    let _monitorVisible = false;
    let _monitorTimer = null;

    function toggleVariablesMonitor() {
      _monitorVisible = !_monitorVisible;
      const panel = document.getElementById('variables-monitor');
      if (_monitorVisible) {
        panel.classList.remove('hidden');
        updateVariablesMonitor();
        // 定时刷新
        if (!_monitorTimer) {
          _monitorTimer = setInterval(updateVariablesMonitor, 500);
        }
      } else {
        panel.classList.add('hidden');
        if (_monitorTimer) { clearInterval(_monitorTimer); _monitorTimer = null; }
      }
    }

    function updateVariablesMonitor() {
      const content = document.getElementById('monitor-content');
      if (!content || !_monitorVisible) return;
      const vars = (typeof Executor !== 'undefined' && Executor._getGlobalVars) ? Executor._getGlobalVars() : {};
      const keys = Object.keys(vars).filter(k => !k.startsWith('__'));
      if (keys.length === 0) {
        const isEn = i18n.isEnglish();
        content.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:12px;">${isEn ? 'Run project to see variable values' : '运行项目后显示变量值'}</div>`;
        return;
      }
      let html = '';
      for (const key of keys) {
        const val = vars[key];
        const displayVal = Array.isArray(val) ? JSON.stringify(val) : String(val);
        html += `<div style="display:flex;justify-content:space-between;padding:3px 6px;border-radius:4px;margin-bottom:2px;background:var(--bg-tertiary);">
          <span style="color:var(--accent);font-weight:500;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${key}">${key}</span>
          <span style="color:var(--text-primary);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${displayVal}">${displayVal}</span>
        </div>`;
      }
      content.innerHTML = html;
    }

    document.getElementById('monitor-close')?.addEventListener('click', () => toggleVariablesMonitor());

    const menuActions = {
      'home': _actionHome,
      'save': _actionSave,
      'save-local': () => saveProjectToLocal(),
      'export-html': _actionExportHtml,
      'publish': () => publishToCommunity(),
      'run': _actionRun,
      'stop': _actionStop,
      'force-stop': _actionForceStop,
      'load-ext': () => { if (typeof ExtensionDialog !== 'undefined') ExtensionDialog.show(); else loadExtensionDialog(); },
      'ext-docs': () => window.api && window.api.openExtensionDocs(),
      'view-code': () => showAllCodeDialog(),
      'blocks-guide': () => window.open('https://lichtom.github.io/objector-coder/blocks-guide/', '_blank'),
      'advanced-guide': () => window.open('https://lichtom.github.io/objector-coder/how-to-use-advanced-editor/', '_blank'),
      'minecraft-api': () => window.open('https://lichtom.github.io/objector-coder/minecraft-api/', '_blank'),
      'collab-push-progress': () => typeof CollaborationManager !== 'undefined' && CollaborationManager.pushProgress(),
      'collab-push-branch': () => typeof CollaborationManager !== 'undefined' && CollaborationManager.pushToBranch(),
      'collab-view-members': () => typeof CollaborationManager !== 'undefined' && CollaborationManager.viewMembers(),
      'collab-share-link': () => typeof CollaborationManager !== 'undefined' && CollaborationManager.generateShareLink(),
      'code-preview': () => showCodePreviewDialog(),
      'import-sb3': () => importSB3File(),
      'show-templates': () => showTemplateDialog(),
      'toggle-monitor': () => toggleVariablesMonitor(),
    };

    // 菜单栏下拉交互
    const menubar = document.getElementById('menubar');
    if (menubar) {
      let openMenu = null;
      const closeAllMenus = () => {
        menubar.querySelectorAll('.menu-item.open').forEach(m => m.classList.remove('open'));
        openMenu = null;
      };
      menubar.querySelectorAll('.menu-item').forEach(mi => {
        mi.addEventListener('click', (e) => {
          e.stopPropagation();
          const wasOpen = mi.classList.contains('open');
          closeAllMenus();
          if (!wasOpen) { mi.classList.add('open'); openMenu = mi; }
        });
        mi.addEventListener('mouseenter', () => {
          if (openMenu && openMenu !== mi) {
            closeAllMenus();
            mi.classList.add('open');
            openMenu = mi;
          }
        });
      });
      document.addEventListener('click', closeAllMenus);
      menubar.querySelectorAll('.menu-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = item.dataset.action;
          closeAllMenus();
          if (action && menuActions[action]) menuActions[action]();
        });
      });
    }

    // 工具栏运行/停止按钮
    document.getElementById('btn-run')?.addEventListener('click', _actionRun);
    document.getElementById('btn-stop')?.addEventListener('click', _actionStop);

    // 素材管理按钮
    document.getElementById('btn-asset-manager')?.addEventListener('click', () => {
      window.api.openAssetManager({ projectPath: _projectPath });
    });

    // AI 助手按钮
    document.getElementById('btn-ai-assistant')?.addEventListener('click', () => {
      if (typeof AIAssistant !== 'undefined') {
        AIAssistant.showPanel();
      } else {
        alert('AI 助手模块未加载');
      }
    });

    // 面板窗口快捷按钮（只有舞台按钮了）
    ['stage'].forEach(type => {
      document.getElementById('btn-panel-' + type)?.addEventListener('click', () => {
        if (window.api && window.api.showPanel) {
          // 如果面板尚未初始化，先初始化（确保 _panelsOpened = true）
          if (!_panelsOpened) {
            _initPanels();
          }
          window.api.showPanel(type);
          // 重置脏检查，确保新面板窗口能收到数据（面板可能刚重建）
          _lastStageJSON = '';
          setTimeout(() => {
            // 重新推送渲染模式（面板窗口可能已重建，需要重新告知渲染模式）
            const rm = (typeof EditorState !== 'undefined' && EditorState.renderMode) || '2d';
            if (window.api && window.api.sendPanelUpdate) {
              window.api.sendPanelUpdate({ type: 'render-mode', renderMode: rm });
            }
            _pushPanelTitle();
            _pushPanelSprites();
            _pushAudioList();
          }, 500);
        }
      });
    });

    document.getElementById('btn-cmd')?.addEventListener('click', () => {
      window.api?.openCmdWindow();
    });

    // 协作管理按钮
    document.getElementById('btn-collab')?.addEventListener('click', () => {
      if (typeof CollaborationManager !== 'undefined') {
        CollaborationManager.showPanel();
      } else {
        alert('协作管理模块未加载');
      }
    });

    // ========== 积木搜索 (Ctrl+F) ==========
    let _searchResults = [];
    let _searchIndex = 0;
    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-input');
    const searchCount = document.getElementById('search-count');
    const searchPrev = document.getElementById('search-prev');
    const searchNext = document.getElementById('search-next');
    const searchClose = document.getElementById('search-close');

    function _openSearch() {
      if (searchBar) {
        searchBar.classList.remove('hidden');
        searchInput?.focus();
      }
    }

    function _closeSearch() {
      if (searchBar) searchBar.classList.add('hidden');
      _searchResults = [];
      _searchIndex = 0;
      if (searchCount) searchCount.textContent = '0 结果';
    }

    function _doSearch() {
      const query = searchInput?.value?.trim();
      if (!query) {
        _searchResults = [];
        _searchIndex = 0;
        if (searchCount) searchCount.textContent = '0 结果';
        return;
      }
      if (typeof EditorCanvas !== 'undefined') {
        _searchResults = EditorCanvas.searchBlocks(query);
        _searchIndex = 0;
        if (searchCount) searchCount.textContent = _searchResults.length + ' 结果';
        if (_searchResults.length > 0) {
          EditorCanvas.highlightSearchResults(_searchResults);
        }
      }
    }

    function _searchNav(dir) {
      if (_searchResults.length === 0) return;
      _searchIndex = (_searchIndex + dir + _searchResults.length) % _searchResults.length;
      const block = _searchResults[_searchIndex];
      if (block && typeof EditorCanvas !== 'undefined') {
        EditorCanvas.highlightSearchResults([block]);
      }
      if (searchCount) searchCount.textContent = (_searchIndex + 1) + '/' + _searchResults.length;
    }

    document.getElementById('btn-search')?.addEventListener('click', _openSearch);
    searchInput?.addEventListener('input', _doSearch);
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { _searchNav(e.shiftKey ? -1 : 1); e.preventDefault(); }
      if (e.key === 'Escape') _closeSearch();
    });
    searchPrev?.addEventListener('click', () => _searchNav(-1));
    searchNext?.addEventListener('click', () => _searchNav(1));
    searchClose?.addEventListener('click', _closeSearch);

    // ========== 教程系统 ==========
    document.getElementById('btn-tutorial')?.addEventListener('click', () => {
      if (typeof TutorialSystem !== 'undefined') {
        TutorialSystem.start('beginner');
      } else {
        alert('教程模块未加载');
      }
    });

    // 初始化教程系统
    if (typeof TutorialSystem !== 'undefined') {
      TutorialSystem.init();
      // 首次访问自动显示教程
      if (!TutorialSystem.isDone()) {
        setTimeout(() => TutorialSystem.start('beginner'), 1000);
      }
    }

    // 社区用户信息显示
    const communityUserInfo = document.getElementById('community-user-info');

    function refreshCommunityUI() {
      if (typeof CommunityAPI === 'undefined') return;
      const user = CommunityAPI.getUser();
      const profile = CommunityAPI.getProfile();
      if (user && communityUserInfo) {
        communityUserInfo.innerHTML = '<img src="../icons/User.svg" class="tb-icon" style="height:11px;"> ' + (profile?.username || user.email);
        communityUserInfo.classList.remove('hidden');
      } else if (communityUserInfo) {
        communityUserInfo.classList.add('hidden');
      }
      // 更新协作菜单可见性
      if (typeof CollaborationManager !== 'undefined') {
        CollaborationManager.updateMenuVisibility();
      }
    }

    // 初始化社区 API 并恢复登录状态
    if (typeof CommunityAPI !== 'undefined') {
      CommunityAPI.init();
      CommunityAPI.restoreSession().then(() => refreshCommunityUI());
    }

    // 项目重命名
    document.getElementById('btn-rename')?.addEventListener('click', () => ProjectManager.renameProject());
    document.getElementById('project-name')?.addEventListener('click', () => ProjectManager.renameProject());

    // 窗口控制按钮
    document.getElementById('win-minimize')?.addEventListener('click', () => window.api.windowMinimize());
    document.getElementById('win-maximize')?.addEventListener('click', () => window.api.windowMaximize());
    document.getElementById('win-close')?.addEventListener('click', () => window.api.windowClose());

    // 调试按钮
    document.getElementById('btn-debug-continue')?.addEventListener('click', () => DevMode.continueExecution());
    document.getElementById('btn-debug-step')?.addEventListener('click', () => DevMode.stepExecution());
    document.getElementById('btn-debug-stop')?.addEventListener('click', () => DevMode.stopDebug());

    // 舞台标签切换已移除（堆叠布局）

    // 精灵面板按钮（元素在隐藏面板中，用可选链）
    document.getElementById('btn-add-sprite')?.addEventListener('click', () => {
      const s = StageManager.addSprite((i18n.isEnglish() ? 'Sprite' : '精灵') + (StageManager.getSprites().length + 1));
      const idx = StageManager.getSprites().indexOf(s);
      if (idx >= 0) StageManager.setActiveSprite(idx);
    });
    document.getElementById('btn-upload-costume')?.addEventListener('click', uploadCostumeDialog);
    document.getElementById('btn-set-costume')?.addEventListener('click', setCostumeDialog);
    document.getElementById('btn-clear-costume')?.addEventListener('click', clearCostume);

    // 音频面板按钮（编辑器本地）
    document.getElementById('btn-add-audio')?.addEventListener('click', () => _addAudioFile());
    document.getElementById('btn-stop-all-audio')?.addEventListener('click', () => {
      if (typeof SoundManager !== 'undefined') SoundManager.stopAll();
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      // Ctrl+Z = 撤销
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (typeof HistoryManager !== 'undefined') HistoryManager.undo();
      }
      // Ctrl+Y 或 Ctrl+Shift+Z = 重做
      else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        if (typeof HistoryManager !== 'undefined') HistoryManager.redo();
      }
      else if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
        e.preventDefault();
        if (typeof HistoryManager !== 'undefined') HistoryManager.redo();
      }
      // Ctrl+S = 保存
      else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        _actionSave();
      }
      // F5 = 运行
      else if (e.key === 'F5' && !e.shiftKey) {
        e.preventDefault();
        _actionRun();
      }
      // Shift+F5 = 停止
      else if (e.key === 'F5' && e.shiftKey) {
        e.preventDefault();
        _actionStop();
      }
      // Ctrl+Shift+Q = 强制停止
      else if (e.ctrlKey && e.shiftKey && (e.key === 'Q' || e.key === 'q')) {
        e.preventDefault();
        _actionForceStop();
      }
    });

    // 定期更新积木计数（切换精灵时自动反映）+ 未保存状态检测
    EditorState._isDirty = false;
    EditorState._blocksSnapshot = JSON.stringify(EditorState.blocks || {});
    setInterval(() => {
      const count = Object.keys(EditorState.blocks || {}).length;
      const sprite = StageManager.getActiveSprite();
      const spriteName = sprite ? sprite.name : '';
      document.getElementById('block-count').textContent =
        (i18n.isEnglish() ? spriteName + ': ' : spriteName + '：') + count + (i18n.isEnglish() ? ' blocks' : ' 个积木');
      // 推送面板更新
      _pushPanelSprites();
      // 检测积木数据变化，标记未保存状态并记录历史
      const snapshot = JSON.stringify(EditorState.blocks || {});
      if (snapshot !== EditorState._blocksSnapshot) {
        EditorState._isDirty = true;
        // 记录撤销历史（防抖，避免拖拽时记录太多次）
        if (typeof HistoryManager !== 'undefined') {
          HistoryManager.pushSnapshotDebounced();
        }
      }
    }, 500);

    // 网页端未保存退出弹窗（刷新页面 / 关闭标签页 / 跳转外链）
    window.addEventListener('beforeunload', (e) => {
      if (EditorState._isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // 监听主进程发来的加载新项目事件
    if (window.api && window.api.onLoadProject) {
      window.api.onLoadProject((path, mode, renderMode) => {
        // 重新加载页面以应用新的 renderMode
        if (renderMode) {
          const url = new URL(window.location.href);
          url.searchParams.set('path', path);
          url.searchParams.set('mode', mode || 'normal');
          url.searchParams.set('render', renderMode);
          window.location.href = url.toString();
        } else {
          loadProject(path, mode);
        }
      });
    }
  });

  // ============================================================
  // 渲染模式热切换：从 2D 切换到 3D（用于社区预览）
  // ============================================================
  function switchTo3D() {
    if (typeof Stage3D === 'undefined') return false;
    // 停止 2D 渲染循环
    StageCanvas.stop();
    // 查找或创建离屏 canvas
    var oldCanvas = document.getElementById('stage-canvas');
    var newCanvas;
    if (oldCanvas) {
      newCanvas = document.createElement('canvas');
      newCanvas.id = 'stage-canvas';
      newCanvas.width = 480;
      newCanvas.height = 360;
      if (oldCanvas.parentNode) {
        oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
      }
    } else {
      newCanvas = document.createElement('canvas');
      newCanvas.id = 'stage-canvas';
      newCanvas.width = 480;
      newCanvas.height = 360;
    }
    // 初始化 3D 舞台
    var success = Stage3D.init(newCanvas);
    if (success) {
      // 重新绑定侦测输入
      if (typeof SensingInput !== 'undefined') SensingInput.init(newCanvas);
      console.log('[switchTo3D] 已切换到 3D 模式');
    } else {
      console.warn('[switchTo3D] Stage3D 初始化失败');
    }
    return success;
  }

  // ============================================================
  // 社区作品在线预览：从社区 API 获取项目并加载到编辑器
  // ============================================================
  async function loadProjectFromCommunity(projectId) {
    try {
      document.getElementById('status-text').textContent = i18n.isEnglish() ? 'Loading preview...' : '正在加载预览...';

      // 初始化社区 API
      if (typeof CommunityAPI === 'undefined') {
        throw new Error(i18n.isEnglish() ? 'Community module not loaded' : '社区模块未加载');
      }
      CommunityAPI.init();

      // 获取项目数据
      const res = await CommunityAPI.getProjectById(projectId);
      if (res.error || !res.data) {
        throw new Error(i18n.isEnglish() ? 'Project not found' : '作品不存在');
      }

      const project = res.data;
      const previewPath = 'vfs:community-preview/' + project.title;

      // 优先使用 ZIP 文件（包含完整项目结构、精灵、造型等）
      if (project.zip_url) {
        try {
          const resp = await fetch(project.zip_url);
          if (resp.ok) {
            const blob = await resp.blob();
            const zip = await JSZip.loadAsync(blob);

            // 二进制文件扩展名 → MIME 类型映射
            const BINARY_EXTS = {
              '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
              '.gif':'image/gif', '.bmp':'image/bmp', '.webp':'image/webp', '.svg':'image/svg+xml',
              '.wav':'audio/wav', '.mp3':'audio/mpeg', '.ogg':'audio/ogg'
            };
            function _mimeForName(fname) {
              const dot = fname.lastIndexOf('.');
              if (dot < 0) return null;
              return BINARY_EXTS[fname.slice(dot).toLowerCase()] || null;
            }

            // 将 ZIP 内容写入 VFS
            let _assetWarnCount = 0;
            for (const [relativePath, file] of Object.entries(zip.files)) {
              if (file.dir) continue;
              const fullPath = previewPath + '/' + relativePath;
              const mime = _mimeForName(file.name);
              if (mime) {
                // 二进制文件：用正确的 MIME 类型 data URL 存储
                try {
                  const base64 = await file.async('base64');
                  localStorage.setItem('vfsb:' + fullPath, 'data:' + mime + ';base64,' + base64);
                } catch (storeErr) {
                  _assetWarnCount++;
                  console.warn('[preview] 存储失败（可能超出容量）:', relativePath, storeErr.message);
                }
              } else {
                // 文本文件
                const text = await file.async('text');
                await window.api.writeFile(fullPath, text);
              }
            }
            if (_assetWarnCount > 0) {
              const msg = (i18n.isEnglish()
                ? 'Warning: {n} asset(s) failed to store (localStorage may be full). Try clearing browser storage.'
                : '警告：{n} 个素材存储失败（localStorage 可能已满），请尝试清除浏览器存储。').replace('{n}', _assetWarnCount);
              document.getElementById('status-text').textContent = msg;
            }

            // 更新目录索引
            const dirs = new Set();
            for (const [relativePath] of Object.entries(zip.files)) {
              const parts = relativePath.split('/');
              let dirPath = previewPath;
              for (let i = 0; i < parts.length - 1; i++) {
                dirPath += '/' + parts[i];
                dirs.add(dirPath);
              }
            }
            for (const dir of dirs) {
              const dirKey = 'vfs:' + dir + '/__dir__';
              if (!localStorage.getItem(dirKey)) {
                localStorage.setItem(dirKey, '1');
              }
            }

            // 读取 project.json 检查渲染模式，如需切换到 3D
            try {
              const cfgStr = await window.api.readFile(previewPath + '/project.json');
              if (cfgStr) {
                const cfg = JSON.parse(cfgStr);
                if (cfg.renderMode === '3d') {
                  switchTo3D();
                }
              }
            } catch(e) { /* ignore */ }

            document.getElementById('status-text').textContent = (i18n.isEnglish() ? 'Preview loaded: ' : '预览已加载: ') + project.title;
            await loadProject(previewPath, project.mode || 'normal');
            return;
          }
        } catch (zipErr) {
          console.warn('[preview] ZIP 加载失败，回退到 json_data:', zipErr.message);
        }
      }

      // 回退方案：使用 json_data（仅包含积木数据）
      if (project.json_data) {
        // 创建最小化的 project.json
        const config = {
          name: project.title || 'Preview',
          mode: project.mode || 'normal',
          renderMode: project.render_mode || '2d',
          sprites: []
        };
        // 如需 3D 模式，先切换舞台
        if (config.renderMode === '3d') {
          switchTo3D();
        }
        await window.api.writeFile(previewPath + '/project.json', JSON.stringify(config, null, 2));
        // 写入积木数据
        await window.api.writeFile(previewPath + '/scripts/main.json', project.json_data);

        document.getElementById('status-text').textContent = (i18n.isEnglish() ? 'Preview loaded (blocks only): ' : '预览已加载(仅积木): ') + project.title;
        await loadProject(previewPath, 'normal');
        return;
      }

      throw new Error(i18n.isEnglish() ? 'No preview data available' : '无可预览的数据');

    } catch (e) {
      console.error('[preview] 加载失败:', e);
      document.getElementById('status-text').textContent = (i18n.isEnglish() ? 'Preview failed: ' : '预览加载失败: ') + e.message;
      alert((i18n.isEnglish() ? 'Preview failed: ' : '在线预览失败: ') + e.message);
    }
  }

  async function loadProject(folder, mode) {
    try {
    const configStr = await window.api.readFile(folder + '/project.json');
    if (!configStr) return;

    const config = JSON.parse(configStr);
    EditorState.projectPath = folder;
    EditorState.projectName = config.name || i18n.t('app.unnamed');
    EditorState.projectMode = config.mode || mode || 'normal';
    document.getElementById('project-name').textContent = EditorState.projectName;

    // 代码编程模式: 必须在 restoreSprites 触发角色切换回调之前恢复磁盘代码并打开落盘闸门,
    // 否则回调会用示例模板覆盖 project.json 里的用户代码（"保存后再加载退回示例"的根因）
    if (String(EditorState.projectMode).indexOf('code') === 0) {
      await _restoreCodeScriptsFromDisk(config, folder);
    }

    // 检查项目渲染模式，如需切换到 3D
    if (config.renderMode === '3d' && (typeof Stage3D === 'undefined' || !Stage3D.isInitialized || !Stage3D.isInitialized())) {
      console.log('[loadProject] 项目为 3D 模式，切换舞台到 3D...');
      switchTo3D();
      if (typeof EditorState !== 'undefined') EditorState.renderMode = '3d';
    }

    // 更新右侧窗口标题中的项目名
    updateRwinTitles();

    // 初始化造型管理器（从项目 assets 目录加载）
    try {
      await CostumeManager.init(folder);
      refreshCostumeLibrary();
    } catch(e) {
      console.warn('[造型管理器] 初始化失败:', e.message);
    }

    // 加载项目扩展：从 extensions 目录加载可用定义，恢复已安装的扩展
    if (typeof ExtensionManager !== 'undefined') {
      // 加载项目 extensions 目录的所有扩展文件到可用池
      if (EditorState.projectPath) {
        try {
          await ExtensionManager.loadFromProject(EditorState.projectPath);
        } catch (e) {
          console.warn('[扩展] 加载项目扩展失败:', e.message);
        }
      }
      // 恢复已安装的扩展（根据 project.json 中保存的 installedExtensions）
      if (config.installedExtensions && Array.isArray(config.installedExtensions)) {
        const count = ExtensionManager.restoreInstalled(config.installedExtensions);
        if (count > 0) {
          Palette.init();
          console.log(`[扩展] 已恢复 ${count} 个已安装扩展`);
        }
      }
    }

    const scriptsStr = await window.api.readFile(folder + '/scripts/main.json');
    let mainBlocks = {};
    if (scriptsStr) {
      mainBlocks = Serializer.deserialize(scriptsStr);
    }

    // 恢复精灵数据（含贴图加载和积木恢复）
    if (config.sprites && Array.isArray(config.sprites) && config.sprites.length > 0) {
      StageManager.restoreSprites(config.sprites, folder);
      // 如果精灵没有自己的积木（旧项目），把 main.json 的积木分配给第一个精灵
      const sprites = StageManager.getSprites();
      const hasBlocks = sprites.some(s => s.blocks && Object.keys(s.blocks).length > 0);
      if (!hasBlocks && Object.keys(mainBlocks).length > 0) {
        // 旧项目：把所有积木分配给第一个精灵
        sprites[0].blocks = mainBlocks;
        EditorState.blocks = mainBlocks;
      }
    } else {
      // 无精灵数据，直接使用 main.json
      EditorState.blocks = mainBlocks;
    }

    document.getElementById('status-text').textContent = i18n.t('status.loaded', null).replace('{name}', EditorState.projectName);

    // 扩展模式：显示文件编辑器按钮
    if (EditorState.projectMode === 'extension') {
      const fileEditorBtn = document.getElementById('btn-ext-file-editor');
      if (fileEditorBtn) {
        fileEditorBtn.classList.remove('hidden');
      }
      if (typeof FileEditor !== 'undefined') FileEditor.refreshFileList();
    }

    // 高级模式：激活 Godot 式布局并加载数据
    if (EditorState.projectMode === 'advanced') {
      initAdvancedMode();
      // projectMode 已设置为 'advanced'，重新初始化积木面板以显示场景分类
      if (typeof Palette !== 'undefined') Palette.init();

      // 恢复 SceneGraph - 优先从场景文件加载，回退到 config.sceneGraph
      let sceneLoaded = false;
      const sceneFileRel = config.mainScene || 'scenes/main.scene.json';
      const _pj = window.api.pathJoin || ((...a) => a.join('/'));
      const sceneFilePath = await _pj(folder, sceneFileRel);
      const scenesDir = await _pj(folder, 'scenes');
      const mainScenePath = await _pj(scenesDir, 'main.scene.json');
      // 跟踪当前场景名（供场景积木使用）
      EditorState._currentSceneName = sceneFileRel.replace(/^scenes\//, '').replace(/\.scene\.json$/, '');
      try {
        const sceneContent = await window.api.readFile(sceneFilePath);
        if (sceneContent && typeof SceneGraph !== 'undefined') {
          const sceneData = JSON.parse(sceneContent);
          if (sceneData.rootId || sceneData.nodes) {
            SceneGraph.fromJSON(sceneData);
            if (typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
            // 从场景文件加载积木到 _spriteBlocks（独立于 sprite 对象）
            _loadBlocksFromSceneData(sceneData);
            // 3D 场景：同步 Mesh3D 节点到 Three.js 渲染
            if (typeof Stage3D !== 'undefined' && Stage3D.isInitialized && Stage3D.isInitialized()) {
              Stage3D.syncMeshesFromSceneGraph();
            }
            sceneLoaded = true;
            console.log('[高级模式] 已从场景文件加载:', sceneFilePath);
          }
        }
      } catch (e) {
        console.warn('[高级模式] 场景文件不存在，回退到 project.json');
      }

      if (!sceneLoaded && config.sceneGraph && typeof SceneGraph !== 'undefined') {
        // 旧项目回退：从 config.sceneGraph 加载
        SceneGraph.fromJSON(config.sceneGraph);
        if (typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
        // 3D 场景：同步 Mesh3D 节点到 Three.js 渲染
        if (typeof Stage3D !== 'undefined' && Stage3D.isInitialized && Stage3D.isInitialized()) {
          Stage3D.syncMeshesFromSceneGraph();
        }
        // 保存为场景文件（迁移到文件系统）
        try {
          await window.api.ensureDir(scenesDir);
          const sceneData = { name: 'main', ...SceneGraph.toJSON() };
          await window.api.writeFile(mainScenePath, JSON.stringify(sceneData, null, 2));
          console.log('[高级模式] 已迁移场景数据到 scenes/main.scene.json');
        } catch (e) {
          console.warn('[高级模式] 保存场景文件失败:', e);
        }
      }

      // 新项目：确保默认场景文件存在
      if (!sceneLoaded && !config.sceneGraph && typeof SceneGraph !== 'undefined') {
        try {
          await window.api.ensureDir(scenesDir);
          const sceneData = { name: 'main', ...SceneGraph.toJSON() };
          await window.api.writeFile(mainScenePath, JSON.stringify(sceneData, null, 2));
          console.log('[高级模式] 已创建默认场景文件');
        } catch (e) {
          console.warn('[高级模式] 创建默认场景文件失败:', e);
        }
      }

      // 恢复 JS 脚本 - 优先从场景文件夹 scripts/<sceneName>/ 加载
      const currentScene = EditorState._currentSceneName || 'main';
      await loadSceneScripts(currentScene);
      // 回退：如果场景文件夹为空，尝试从旧的 config.jsScripts 恢复
      if (!_spriteScripts[currentScene] || Object.keys(_spriteScripts[currentScene]).length === 0) {
        if (config.jsScripts) {
          // config.jsScripts 格式: { sceneName: { spriteIdx: code } }
          // 直接作为整个 _spriteScripts 对象导入
          if (typeof config.jsScripts === 'object') {
            const keys = Object.keys(config.jsScripts);
            // 检查是否是按场景存储的格式（key 是场景名）
            if (keys.length > 0 && typeof config.jsScripts[keys[0]] === 'object') {
              _spriteScripts = { ...config.jsScripts };
              console.log('[高级模式] 已从 project.json 回退加载 JS 脚本:', keys);
            }
          }
        }
      }

      // 自动选中第一个 Sprite2D 节点（确保编辑器与精灵关联、代码可保存/运行）
      if (typeof SceneGraph !== 'undefined' && typeof SceneTree !== 'undefined') {
        const root = SceneGraph.getRoot();
        let firstSpriteId = null;
        if (root && root.children) {
          for (const childId of root.children) {
            const child = SceneGraph.getNode(childId);
            if (child && child.type === 'Sprite2D') {
              firstSpriteId = childId;
              break;
            }
          }
        }
        if (firstSpriteId) {
          // selectNode 会设置 _editorSpriteIdx、加载脚本到编辑器、同步 StageManager
          SceneTree.selectNode(firstSpriteId);
          console.log('[高级模式] 已自动选中精灵:', firstSpriteId);
        } else {
          // 没有 Sprite2D，设置编辑器为默认代码
          if (EditorApp.getJsEditor()) {
            EditorApp.getJsEditor().setValue('// 在此编写 JavaScript 代码\n');
          }
        }
      }

      // 刷新场景树、检查器和文件系统
      if (typeof SceneTree !== 'undefined') SceneTree.refresh();
      if (typeof FileSystemDock !== 'undefined') FileSystemDock.refresh();
      if (typeof Inspector !== 'undefined') {
        const root = (typeof SceneGraph !== 'undefined') ? SceneGraph.getRoot() : null;
        if (root && root.children && root.children.length > 0) {
          Inspector.showNode(root.children[0]);
        } else if (root) {
          Inspector.showNode(root.id);
        }
      }

      // 3D 和 UI 场景仅支持 JS 脚本，隐藏积木 tab
      if (typeof SceneGraph !== 'undefined' && SceneGraph.isJsOnly && SceneGraph.isJsOnly()) {
        const blocksTab = document.querySelector('.script-tab[data-tab="blocks"]');
        const jsTab = document.querySelector('.script-tab[data-tab="js"]');
        if (blocksTab) blocksTab.classList.add('hidden');
        if (jsTab && !jsTab.classList.contains('active')) jsTab.click();
      } else {
        const blocksTab = document.querySelector('.script-tab[data-tab="blocks"]');
        if (blocksTab) blocksTab.classList.remove('hidden');
      }
    }

    // 数据分析模式：初始化并重新应用布局（防止被其他模块覆盖）
    if (EditorState.projectMode === 'data') {
      initDataMode();
      // 重新应用数据布局（即使已初始化，也要确保布局正确）
      if (typeof DataAnalysis !== 'undefined') {
        document.getElementById('main-layout')?.classList.add('hidden');
        document.getElementById('advanced-layout')?.classList.add('hidden');
        document.getElementById('data-layout')?.classList.remove('hidden');
        document.getElementById('toolbar')?.classList.add('hidden');
        document.getElementById('palette-panel')?.classList.add('hidden');
        document.getElementById('stage-panel')?.classList.add('hidden');
      }
      // 尝试加载已保存的数据分析代码
      try {
        const codeStr = await window.api.readFile(folder + '/scripts/main.js');
        if (codeStr && typeof DataAnalysis !== 'undefined') {
          DataAnalysis.setCode(codeStr);
        }
      } catch(e) {}
    }

    // Minecraft 模组开发模式：初始化并重新应用布局
    if (EditorState.projectMode === 'minecraft') {
      initMinecraftMode();
      // 重新将面板移入 mc-editor-panel（loadProject 过程中可能被重置）
      if (typeof MinecraftMod !== 'undefined') {
        const mcEditorPanel = document.getElementById('mc-editor-panel');
        const palettePanel = document.getElementById('palette-panel');
        const editorPanel = document.getElementById('editor-panel');
        const mainLayout = document.getElementById('main-layout');
        // 先恢复到 main-layout
        if (palettePanel && palettePanel.parentNode !== mainLayout) {
          mainLayout.insertBefore(palettePanel, mainLayout.firstChild);
        }
        if (editorPanel && editorPanel.parentNode !== mainLayout) {
          palettePanel?.parentNode?.insertBefore(editorPanel, palettePanel.nextSibling);
        }
        // 再移入 mc-editor-panel
        if (mcEditorPanel && palettePanel && editorPanel) {
          mcEditorPanel.appendChild(palettePanel);
          mcEditorPanel.appendChild(editorPanel);
        }
        document.getElementById('main-layout')?.classList.add('hidden');
        document.getElementById('advanced-layout')?.classList.add('hidden');
        document.getElementById('data-layout')?.classList.add('hidden');
        document.getElementById('mc-layout')?.classList.remove('hidden');
        document.getElementById('toolbar')?.classList.add('hidden');
        document.getElementById('stage-panel')?.classList.add('hidden');
        // 重新初始化积木面板
        if (typeof Palette !== 'undefined') Palette.init();
        // 延迟刷新 CodeMirror（布局从 hidden 变为可见后需要重新计算尺寸）
        // 同时重绘画布（移入新容器后需要重新计算尺寸）
        setTimeout(() => {
          if (typeof EditorCanvas !== 'undefined') {
            EditorCanvas.resize();
            EditorCanvas.render();
          }
          if (typeof MinecraftMod !== 'undefined' && MinecraftMod.getEditor && MinecraftMod.getEditor()) {
            MinecraftMod.getEditor().refresh();
          }
        }, 200);
      }
    }

    // microbit 硬件模式：初始化并刷新 Palette
    if (EditorState.projectMode && EditorState.projectMode.startsWith('microbit')) {
      console.log('[loadProject] microbit 模式检测成功, projectMode:', EditorState.projectMode, '开始初始化...');
      initMicrobitMode(EditorState.projectMode);
    } else {
      console.log('[loadProject] 非 microbit 模式, projectMode:', EditorState.projectMode);
    }

    // 代码编程模式: 角色代码已在精灵加载前恢复（_restoreCodeScriptsFromDisk）, 这里只做语言归一与布局重应用
    if (EditorState.projectMode && String(EditorState.projectMode).indexOf('code') === 0) {
      let _codeModeArg = EditorState.projectMode;
      // mode 为裸 'code' 的旧项目: 用保存的 codeLang 确定语言
      if (config.codeLang && _normalizeCodeModeKey(_codeModeArg) === '') _codeModeArg = 'code-' + config.codeLang;
      // restore: 以磁盘上的代码为准, 不用编辑器里的示例模板反向覆盖存储
      initCodeMode(_codeModeArg, { restore: true });
      await _persistCodeScripts(); // 恢复后立即回写一次, 顺带生成 code/ 下的每角色独立文件
      // 延迟刷新 CodeMirror
      setTimeout(() => {
        const editor = getCodeEditor();
        if (editor) editor.refresh();
      }, 200);
    }

    // 加载声音
    await loadProjectSounds();

    // 更新积木计数
    const count = Object.keys(EditorState.blocks).length;
    document.getElementById('block-count').textContent = i18n.t('editor.blockCount', null).replace('{n}', count);

    // 项目加载完成后重置未保存状态
    EditorState._isDirty = false;
    EditorState._blocksSnapshot = JSON.stringify(EditorState.blocks || {});

    // 初始化历史记录管理器（用于撤销/重做）
    if (typeof HistoryManager !== 'undefined') {
      HistoryManager.init();
    }

    // 初始化自动保存管理器
    if (typeof AutoSaveManager !== 'undefined') {
      AutoSaveManager.init();
    }
    } catch(e) {
      console.error('[项目加载失败]', e);
      document.getElementById('status-text').textContent = i18n.t('status.loadFailed', null).replace('{error}', e.message);
    } finally {
      // 无论加载是否完全成功，都确保 microbit 模式初始化
      if (EditorState.projectMode && EditorState.projectMode.startsWith('microbit')) {
        try { initMicrobitMode(EditorState.projectMode); } catch(e) { console.error('[microbit] finally初始化失败:', e); }
      }
      // 无论加载是否完全成功，都尝试打开面板（高级模式已在 initAdvancedMode 中打开）
      try {
        _initPanels();
        _pushAudioList();
        // 项目加载完成后，强制推送精灵和标题数据到面板窗口
        // （高级模式中 _initPanels 在项目加载前就已调用，此时才有精灵数据）
        _lastStageJSON = '';  // 重置脏检查，确保数据推送到面板
        _pushPanelTitle();
        _pushPanelSprites();
      } catch(e) { console.error('[Panel] initPanels error:', e); }
    }
  }

  // ============================================================
  // 高级模式 JS 脚本执行
  // ============================================================

  /** 创建精灵 API 代理对象（将所有积木功能映射为方法） */
  function _createSpriteAPI(raw, idx) {
    const SM = (typeof StageManager !== 'undefined') ? StageManager : null;
    if (!SM) return raw;

    const proxy = Object.create(null);

    // 基础属性（getter/setter 直接读写原始精灵）
    Object.defineProperties(proxy, {
      name: { get() { return raw.name; }, set(v) { raw.name = v; if (typeof SceneTree !== 'undefined') SceneTree.refresh(); } },
      x: { get() { return raw.x; }, set(v) { raw.x = Number(v); } },
      y: { get() { return raw.y; }, set(v) { raw.y = Number(v); } },
      direction: { get() { return raw.direction; }, set(v) { raw.direction = Number(v); } },
      size: { get() { return raw.size; }, set(v) { raw.size = Number(v); } },
      visible: { get() { return raw.visible; }, set(v) { raw.visible = !!v; } },
      color: { get() { return raw.color; }, set(v) { raw.color = v; } },
      sayText: { get() { return raw.sayText; }, set(v) { raw.sayText = String(v); } },
      vx: { get() { return raw.vx || 0; }, set(v) { raw.vx = Number(v); } },
      vy: { get() { return raw.vy || 0; }, set(v) { raw.vy = Number(v); } },
      rotationStyle: { get() { return raw.rotationStyle; }, set(v) { raw.rotationStyle = v; } },
      _raw: { value: raw },
      _idx: { value: idx },
    });

    // === 外观 ===
    proxy.say = (text) => { SM.setSpriteSay(idx, String(text)); };
    proxy.sayFor = (text, sec) => { SM.setSpriteSay(idx, String(text)); setTimeout(() => SM.setSpriteSay(idx, ''), Number(sec) * 1000); };
    proxy.think = (text) => { SM.setSpriteSay(idx, '\u{1F4AD} ' + String(text)); };
    proxy.clearSay = () => { SM.setSpriteSay(idx, ''); };
    proxy.show = () => { raw.visible = true; };
    proxy.hide = () => { raw.visible = false; };
    proxy.setSize = (sz) => { SM.setSpriteSize(idx, Number(sz)); };
    proxy.changeSize = (n) => { SM.changeSpriteSize(idx, Number(n)); };
    proxy.nextCostume = async () => {
      if (typeof CostumeManager !== 'undefined') {
        const names = CostumeManager.getAllNames();
        if (names.length > 0) {
          const curName = raw.costumeName || '';
          const curIdx = names.indexOf(curName);
          await SM.setSpriteCostume(idx, names[(curIdx + 1) % names.length]);
        }
      }
    };
    proxy.setCostume = async (name) => { await SM.setSpriteCostume(idx, name); };
    proxy.setColor = (val) => { raw.colorEffect = Number(val); };
    proxy.clearEffects = () => { raw.colorEffect = 0; raw.size = 100; };

    // === 运动 ===
    proxy.move = (steps) => { SM.moveSprite(idx, Number(steps)); };
    proxy.turnRight = (deg) => { SM.rotateSprite(idx, Number(deg)); };
    proxy.turnLeft = (deg) => { SM.rotateSprite(idx, -Number(deg)); };
    proxy.pointInDirection = (deg) => { SM.setSpriteDir(idx, Number(deg)); };
    proxy.goTo = (x, y) => { SM.setSpritePos(idx, Number(x), Number(y)); };
    proxy.bounce = () => { SM.bounceSprite(idx); };
    proxy.clampToStage = () => {
      const hw = SM.STAGE_W / 2, hh = SM.STAGE_H / 2;
      raw.x = Math.max(-hw, Math.min(hw, raw.x));
      raw.y = Math.max(-hh, Math.min(hh, raw.y));
    };
    proxy.wrapAround = () => {
      const hw = SM.STAGE_W / 2, hh = SM.STAGE_H / 2;
      if (raw.x > hw) raw.x = -hw; else if (raw.x < -hw) raw.x = hw;
      if (raw.y > hh) raw.y = -hh; else if (raw.y < -hh) raw.y = hh;
    };
    proxy.goToRandomPosition = () => {
      const hw = SM.STAGE_W / 2, hh = SM.STAGE_H / 2;
      raw.x = Math.random() * hw * 2 - hw;
      raw.y = Math.random() * hh * 2 - hh;
    };

    // === 侦测 ===
    proxy.isTouchingEdge = () => SM.isTouchingEdge(idx);
    proxy.isTouchingSprite = (name) => {
      const all = SM.getSprites();
      const tIdx = all.findIndex(s => s.name === name);
      return tIdx >= 0 ? SM.isTouchingSprite(idx, tIdx) : false;
    };
    proxy.distanceTo = (name) => {
      const all = SM.getSprites();
      const t = all.find(s => s.name === name);
      return t ? SM.getDistanceToPoint(idx, t.x, t.y) : 0;
    };
    proxy.directionTo = (name) => {
      const all = SM.getSprites();
      const t = all.find(s => s.name === name);
      return t ? SM.getDirectionToPoint(idx, t.x, t.y) : 0;
    };
    proxy.distanceToMouse = () => {
      const SI = (typeof SensingInput !== 'undefined') ? SensingInput : null;
      return SI ? SM.getDistanceToPoint(idx, SI.getMouseX(), SI.getMouseY()) : 0;
    };
    proxy.directionToMouse = () => {
      const SI = (typeof SensingInput !== 'undefined') ? SensingInput : null;
      return SI ? SM.getDirectionToPoint(idx, SI.getMouseX(), SI.getMouseY()) : 0;
    };

    // === 高级运动 ===
    proxy.setVelocity = (vx, vy) => { SM.setVelocity(idx, vx, vy); };
    proxy.changeVelocity = (dvx, dvy) => { SM.changeVelocity(idx, dvx, dvy); };
    proxy.updateVelocity = () => { SM.updateVelocity(idx); };
    proxy.applyGravity = (g) => { SM.applyGravity(idx, g); };
    proxy.applyFriction = (f) => { SM.applyFriction(idx, f); };
    proxy.bounceEdgeVelocity = () => { SM.bounceEdgeVelocity(idx); };
    proxy.pointTowards = (tx, ty) => { SM.pointTowards(idx, tx, ty); };
    proxy.moveTowards = (tx, ty, steps) => { SM.moveTowards(idx, tx, ty, steps || 3); };

    // === 克隆 ===
    proxy.clone = () => SM.cloneSprite(idx);

    return proxy;
  }

  /** 创建全局 API 对象 */
  function _createGlobalAPI() {
    const SM = (typeof StageManager !== 'undefined') ? StageManager : null;
    const SI = (typeof SensingInput !== 'undefined') ? SensingInput : null;
    const SND = (typeof SoundManager !== 'undefined') ? SoundManager : null;

    return {
      get stageWidth() { return SM ? SM.STAGE_W : 480; },
      get stageHeight() { return SM ? SM.STAGE_H : 360; },
      getSprites: () => SM ? SM.getSprites() : [],
      getSpriteByName: (name) => SM ? SM.getSpriteByName(name) : null,
      getSpriteCount: () => SM ? SM.getSpriteCount() : 0,
      setActiveSprite: (idx) => SM && SM.setActiveSprite(idx),
      get mouseX() { return SI ? SI.getMouseX() : 0; },
      get mouseY() { return SI ? SI.getMouseY() : 0; },
      isMouseDown: () => SI ? SI.isMouseDown() : false,
      isKeyPressed: (key) => SI ? SI.isKeyPressed(key) : false,
      getVolume: () => SND ? SND.getVolume() : 0,
      setVolume: (v) => SND && SND.setVolume(v),
      random: (a, b) => Math.floor(Math.random() * (b - a + 1)) + a,
      randomFloat: () => Math.random(),
      randomRange: (a, b) => Math.random() * (b - a) + a,
      now: () => new Date(),
      timer: () => Date.now() / 1000,
    };
  }

  let _jsScriptFrameCount = 0;  // JS 脚本周期计数器（用于节流 UI 刷新）

  function runAdvancedScripts() {
    const sprites = (typeof StageManager !== 'undefined') ? StageManager.getSprites() : [];
    const globalVars = (typeof Executor !== 'undefined') ? Executor._getGlobalVars() : {};
    const editor = (typeof EditorApp !== 'undefined' && EditorApp.getJsEditor) ? EditorApp.getJsEditor() : null;
    const globalAPI = _createGlobalAPI();
    _jsScriptFrameCount++;
    if (_jsScriptFrameCount <= 3) console.log('[JS脚本] 第' + _jsScriptFrameCount + '帧, 精灵数:', sprites.length, '编辑器:', !!editor, '编辑索引:', _editorSpriteIdx);

    sprites.forEach((sprite, index) => {
      let code;
      // 只有编辑器当前关联的精灵才从编辑器读取代码
      if (editor && _editorSpriteIdx === index) {
        code = editor.getValue();
        _getSceneScripts()[index] = code;
      } else {
        // 使用该精灵自己的脚本
        code = _getSceneScripts()[index] || '';
      }
      if (!code || !code.trim() || /^\s*(\/\/[^\n]*\n?|\/\*[\s\S]*?\*\/\s*)+$/.test(code)) return;
      if (_jsScriptFrameCount <= 3) console.log('[JS脚本] 执行精灵', index, '代码长度:', code.length);

      try {
        const api = _createSpriteAPI(sprite, index);
        const logFn = (msg) => {
          const logEl = document.getElementById('output-log');
          if (logEl) logEl.textContent += '\n' + msg;
          if (window.api && window.api.sendPanelUpdate) {
            window.api.sendPanelUpdate({ type: 'output', action: 'append', text: '\n' + msg });
          }
        };
        // 常用方法作为全局函数注入
        const fn = new Function('sprite', 'globalVars', 'log', 'stage',
          'say', 'sayFor', 'think', 'move', 'turnRight', 'turnLeft',
          'show', 'hide', 'setSize', 'changeSize',
          code
        );
        fn(
          api, globalVars, logFn, globalAPI,
          api.say.bind(api), api.sayFor.bind(api), api.think.bind(api),
          api.move.bind(api), api.turnRight.bind(api), api.turnLeft.bind(api),
          api.show.bind(api), api.hide.bind(api), api.setSize.bind(api), api.changeSize.bind(api)
        );
      } catch (e) {
        console.error(`[JS执行错误] 角色 ${sprite.name || index}:`, e);
        const logEl = document.getElementById('output-log');
        if (logEl) {
          logEl.textContent += `\n[JS错误] ${sprite.name || ('角色' + index)}: ${e.message}`;
        }
      }
    });

    // 节流 UI 刷新（每 10 帧 ~330ms）
    if (_jsScriptFrameCount % 10 === 0) {
      if (typeof SceneTree !== 'undefined') SceneTree.refresh();
      if (typeof Inspector !== 'undefined') Inspector.refresh();
    }
  }

  return {
    getJsEditor,
    getSpriteScript,
    setSpriteScript,
    getAllSpriteScripts,
    setAllSpriteScripts,
    getAllCodeScripts,
    setAllCodeScripts,
    getCodeLangRunner,
    isCodeScriptsRestored,
    getSpriteCodeSources,
    getBlockCodeSnippet,
    insertBlockAsCode,
    getNodeScript,
    setNodeScript,
    setEditorSpriteIdx,
    getEditorSpriteIdx,
    initAdvancedMode,
    runAdvancedScripts,
    saveCurrentSceneState,
    loadSceneScripts,
    openSpriteScriptEditor,
    openNodeProperties,
    _clearTabsOnSceneSwitch,
    _hasActiveTabs,
    _loadBlocksFromSceneData,
    _syncBlocksToSceneGraph,
    _flushBlocksToSprites,
  };
})();
