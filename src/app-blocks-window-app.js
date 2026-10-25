/**
 * APP 积木编辑器窗口逻辑
 * 独立 BrowserWindow，通过 IPC 与主编辑器同步积木数据
 */
(function () {
  let _windowId = null;
  let _componentId = null;  // null 表示窗口级脚本，非 null 表示组件级脚本
  let _isDirty = false;

  function init() {
    const params = new URLSearchParams(window.location.search);
    _windowId = params.get('windowId') || 'unknown';
    _componentId = params.get('componentId') || null;

    // 画布初始化（此时积木数据未加载，EditorState.blocks 为空，不会渲染幽灵方块）
    if (typeof EditorCanvas !== 'undefined') {
      EditorCanvas.init();
    }
    if (typeof Palette !== 'undefined') {
      Palette.init();
    }

    // 确认已注册的模块数量
    var typeCount = typeof BlockRegistry !== 'undefined' && BlockRegistry.getAllBlocks
      ? Object.keys(BlockRegistry.getAllBlocks()).length : '?';
    console.log('[积木窗口] 已注册积木模块: ' + typeCount + ' 种类型');

    _bindEvents();
    _listenIPC();
    _updateWindowTitle();
    _loadBlocksFromMain();

    setInterval(() => {
      if (_isDirty) {
        _syncToMain();
        _isDirty = false;
      }
    }, 3000);
  }

  function _bindEvents() {
    document.getElementById('win-minimize')?.addEventListener('click', () => window.api?.windowMinimize());
    document.getElementById('win-maximize')?.addEventListener('click', () => window.api?.windowMaximize());
    document.getElementById('win-close')?.addEventListener('click', () => {
      _syncToMain();
      window.api?.windowClose();
    });

    document.getElementById('btn-sync')?.addEventListener('click', () => {
      _syncToMain();
      _setStatus('已同步');
    });

    document.getElementById('btn-clear-all')?.addEventListener('click', () => {
      if (confirm('确定清空所有积木?')) {
        EditorState.blocks = {};
        if (typeof EditorCanvas !== 'undefined') EditorCanvas.render();
        _updateBlockCount();
        _isDirty = true;
      }
    });

    document.getElementById('btn-undo')?.addEventListener('click', () => {
      _setStatus('撤销功能暂不可用');
    });

    const origAddBlock = EditorCanvas.addBlockFromPalette;
    if (origAddBlock) {
      EditorCanvas.addBlockFromPalette = function (...args) {
        const result = origAddBlock.apply(this, args);
        _isDirty = true;
        _updateBlockCount();
        return result;
      };
    }

    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        _syncToMain();
        _setStatus('已保存');
      }
    });

    // 点击任意区域隐藏右键菜单
    document.addEventListener('click', () => {
      const menu = document.getElementById('block-context-menu');
      if (menu) menu.classList.add('hidden');
    });

    setInterval(_updateBlockCount, 1000);
  }

  function _listenIPC() {
    if (window.api?.onRequestAppBlocks) {
      window.api.onRequestAppBlocks((reqWindowId, reqComponentId) => {
        if (reqWindowId === _windowId && (reqComponentId || null) === (_componentId || null)) {
          const blocks = { ...EditorState.blocks };
          window.api.appBlocksResponse(blocks);
        }
      });
    }

    if (window.api?.onAppBlocksWindowId) {
      window.api.onAppBlocksWindowId((newWindowId, newComponentId) => {
        if (_windowId !== newWindowId || (_componentId || null) !== (newComponentId || null)) {
          _syncToMain();
        }
        _windowId = newWindowId;
        _componentId = newComponentId || null;
        _updateWindowTitle();
        _loadBlocksFromMain();
      });
    }
  }

  async function _loadBlocksFromMain() {
    // 加载前暂停渲染，防止切换窗口时出现旧积木的幽灵方块
    if (typeof EditorCanvas !== 'undefined') EditorCanvas.setReady(false);
    try {
      if (window.api?.getAppBlocks) {
        const blocks = await window.api.getAppBlocks(_windowId, _componentId);
        if (blocks && typeof blocks === 'object') {
          // 验证积木类型是否已注册，过滤“幽灵方块”
          var valid = {};
          var ghostCount = 0;
          var ghostTypes = {};
          Object.keys(blocks).forEach(function(id) {
            var b = blocks[id];
            if (b && b.type && typeof BlockRegistry !== 'undefined'
                && BlockRegistry.getBlock(b.type)) {
              valid[id] = b;
            } else {
              ghostCount++;
              if (b && b.type) ghostTypes[b.type] = (ghostTypes[b.type] || 0) + 1;
            }
          });
          if (ghostCount > 0) {
            console.warn('[积木窗口] 已过滤 ' + ghostCount + ' 个幽灵方块 (模块未注册):', ghostTypes);
            _setStatus('已过滤 ' + ghostCount + ' 个无效积木');
          }
          EditorState.blocks = valid;
        } else {
          EditorState.blocks = {};
        }
        // 模块和积木数据均已就绪，开启画布渲染
        if (typeof EditorCanvas !== 'undefined') {
          EditorCanvas.setReady(true);
          EditorCanvas.render();
        }
        _updateBlockCount();
        if (ghostCount === 0) _setStatus('已加载积木数据');
      }
    } catch (e) {
      console.warn('[积木窗口] 加载积木数据失败:', e);
      // 即使加载失败也要开启画布渲染
      if (typeof EditorCanvas !== 'undefined') EditorCanvas.setReady(true);
      _setStatus('加载失败');
    }
  }

  function _syncToMain() {
    try {
      const blocks = { ...EditorState.blocks };
      if (window.api?.syncAppBlocks) {
        window.api.syncAppBlocks(_windowId, _componentId, blocks);
        _setStatus('已同步 ' + Object.keys(blocks).length + ' 个积木');
      }
    } catch (e) {
      console.warn('[积木窗口] 同步失败:', e);
      _setStatus('同步失败');
    }
  }

  function _updateWindowTitle() {
    const el = document.getElementById('blocks-window-title');
    const wn = document.getElementById('blocks-window-name');
    var label = _componentId ? '组件: ' + _componentId : '窗口: ' + _windowId;
    if (el) el.textContent = 'APP 积木编辑器 - ' + label;
    if (wn) wn.textContent = label;
    document.title = 'APP 积木编辑器 - ' + label;
  }

  function _updateBlockCount() {
    const el = document.getElementById('blocks-count');
    if (el) {
      const count = Object.keys(EditorState.blocks || {}).length;
      el.textContent = count + ' 个积木';
    }
  }

  function _setStatus(text) {
    const el = document.getElementById('blocks-status-text');
    if (el) el.textContent = text;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
