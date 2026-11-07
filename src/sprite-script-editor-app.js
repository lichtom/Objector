/**
 * 精灵脚本编辑器窗口逻辑
 * 独立 BrowserWindow，包含积木 + JS 两个 tab，通过 IPC 与主编辑器同步
 * 使用 nodeIntegration: true, contextIsolation: false，直接 require('electron')
 */
const { ipcRenderer } = require('electron');

(function () {
  let _spriteIdx = -1;
  let _sceneName = 'main';
  let _spriteName = '';
  let _isDirty = false;
  let _currentTab = 'blocks';
  let _cm = null;  // CodeMirror instance

  function init() {
    // 阻止 Electron 默认的拖放行为（防止文件拖入替换页面）
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => e.preventDefault());

    // 初始化积木
    if (typeof EditorCanvas !== 'undefined') EditorCanvas.init();
    if (typeof Palette !== 'undefined') Palette.init();

    _bindEvents();
    _listenIPC();

    // 请求初始化数据
    ipcRenderer.send('sse-ready');
  }

  function _bindEvents() {
    // 窗口控制
    document.getElementById('win-minimize')?.addEventListener('click', () => ipcRenderer.invoke('window-minimize'));
    document.getElementById('win-maximize')?.addEventListener('click', () => ipcRenderer.invoke('window-maximize'));
    document.getElementById('win-close')?.addEventListener('click', () => {
      _save();
      setTimeout(() => ipcRenderer.invoke('window-close'), 200);
    });

    document.getElementById('btn-save')?.addEventListener('click', () => {
      _save();
      _setStatus('✓ 已保存');
    });
    document.getElementById('btn-save-keep')?.addEventListener('click', () => {
      _save(true);
      _setStatus('✓ 已应用');
    });

    // Tab 切换
    document.querySelectorAll('.sse-tab').forEach(tab => {
      tab.addEventListener('click', () => _switchTab(tab.dataset.tab));
    });

    // 键盘快捷键
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        _save();
        _setStatus('✓ 已保存');
      }
      if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        _save(true);
        _setStatus('✓ 已应用');
      }
      if (e.key === 'Escape') {
        _save();
        setTimeout(() => ipcRenderer.invoke('window-close'), 200);
      }
    });

    // 缩放控制
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      if (typeof EditorCanvas !== 'undefined' && EditorCanvas.zoomIn) EditorCanvas.zoomIn();
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      if (typeof EditorCanvas !== 'undefined' && EditorCanvas.zoomOut) EditorCanvas.zoomOut();
    });
    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
      if (typeof EditorCanvas !== 'undefined' && EditorCanvas.resetZoom) EditorCanvas.resetZoom();
    });

    setInterval(_updateBlockCount, 1000);
  }

  function _listenIPC() {
    // 接收主进程发来的初始化数据
    ipcRenderer.on('sse-init', (_e, data) => {
      _spriteIdx = data.spriteIdx;
      _sceneName = data.sceneName || 'main';
      _spriteName = data.spriteName || '精灵';
      document.title = '脚本编辑器 - ' + _spriteName;
      const titleEl = document.getElementById('sse-title');
      if (titleEl) titleEl.textContent = '📝 ' + _spriteName + ' - 脚本编辑器';
      const infoEl = document.getElementById('sse-info');
      if (infoEl) infoEl.textContent = '场景: ' + _sceneName + ' | 角色: ' + _spriteName;

      // 加载积木数据
      if (data.blocks && typeof data.blocks === 'object') {
        var valid = {};
        Object.keys(data.blocks).forEach(function(id) {
          var b = data.blocks[id];
          if (b && b.type && typeof BlockRegistry !== 'undefined' && BlockRegistry.getBlock(b.type)) {
            valid[id] = b;
          }
        });
        EditorState.blocks = valid;
      } else {
        EditorState.blocks = {};
      }
      if (typeof EditorCanvas !== 'undefined') {
        EditorCanvas.setReady(true);
        EditorCanvas.render();
      }

      // 加载 JS 代码
      _initJsEditor(data.jsCode || '');
      _updateBlockCount();
      _setStatus('已加载');
    });
  }

  function _initJsEditor(code) {
    if (_cm) return;
    if (typeof CodeMirror === 'undefined') {
      console.error('[SSE] CodeMirror 未加载!');
      return;
    }
    _cm = CodeMirror.fromTextArea(document.getElementById('sse-js-area'), {
      mode: 'javascript',
      theme: 'material-darker',
      lineNumbers: true,
      tabSize: 2,
      indentWithTabs: false,
      matchBrackets: true,
      autoCloseBrackets: true,
      foldGutter: true,
      gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
      extraKeys: {
        'Tab': (cm) => cm.replaceSelection('  ', 'end'),
      },
    });
    _cm.setValue(code || '// ' + _spriteName + ' 的 JS 脚本\n\n');
    _cm.clearHistory();
    _cm.on('change', () => { _isDirty = true; });
  }

  function _switchTab(tab) {
    if (tab === _currentTab) return;
    _currentTab = tab;
    document.querySelectorAll('.sse-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));

    const paletteEl = document.getElementById('sse-palette');
    const editorEl = document.getElementById('sse-editor');
    const jsWrap = document.getElementById('sse-js-wrap');

    if (tab === 'blocks') {
      if (paletteEl) paletteEl.style.display = 'flex';
      if (editorEl) editorEl.style.display = 'block';
      if (jsWrap) jsWrap.style.display = 'none';
      setTimeout(() => {
        if (typeof EditorCanvas !== 'undefined') { EditorCanvas.resize(); EditorCanvas.render(); }
      }, 50);
    } else {
      if (paletteEl) paletteEl.style.display = 'none';
      if (editorEl) editorEl.style.display = 'none';
      if (jsWrap) jsWrap.style.display = 'block';
      if (_cm) setTimeout(() => _cm.refresh(), 50);
    }
  }

  function _save(keepOpen) {
    const blocks = { ...(EditorState.blocks || {}) };
    const jsCode = _cm ? _cm.getValue() : '';
    ipcRenderer.send('sse-save', {
      spriteIdx: _spriteIdx,
      sceneName: _sceneName,
      spriteName: _spriteName,
      blocks: blocks,
      jsCode: jsCode,
    });
    _isDirty = false;
    if (!keepOpen) {
      setTimeout(() => ipcRenderer.invoke('window-close'), 200);
    }
  }

  function _setStatus(text) {
    const el = document.getElementById('sse-status');
    if (el) el.textContent = text;
  }

  function _updateBlockCount() {
    const el = document.getElementById('sse-count');
    if (el) {
      const count = Object.keys(EditorState.blocks || {}).length;
      el.textContent = count + ' 个积木';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
