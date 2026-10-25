/**
 * APP 开发编辑器主逻辑
 */
window.AppEditorApp = (function() {
  var _projectPath = null;
  var _appType = 'win';
  var _isRunning = false;
  var _expandedWindows = {};
  var _currentScriptTarget = { windowId: null, componentId: null };

  // 可视化编辑器状态
  var _viz = {
    zoom: 1,
    gridOn: true,
    snapOn: true,
    gridSize: 10,
    dragState: null,
    resizeState: null,
  };

  // ========== 自定义对话框（替代 prompt/confirm，兼容无框架窗口）==========
  function _promptDialog(title, defaultValue) {
    return new Promise(function(resolve) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'background:#2d2d2d;border:1px solid #555;border-radius:8px;padding:20px;min-width:300px;color:#e0e0e0;';
      box.innerHTML = '<div style="margin-bottom:12px;font-size:14px;">' + title + '</div>';
      var input = document.createElement('input');
      input.type = 'text';
      input.value = defaultValue || '';
      input.style.cssText = 'width:100%;padding:6px 10px;background:#1e1e2e;border:1px solid #555;border-radius:4px;color:#e0e0e0;font-size:13px;box-sizing:border-box;';
      box.appendChild(input);
      var btnRow = document.createElement('div');
      btnRow.style.cssText = 'margin-top:14px;display:flex;justify-content:flex-end;gap:8px;';
      var btnOk = document.createElement('button');
      btnOk.textContent = '确定';
      btnOk.style.cssText = 'padding:5px 18px;background:#89b4fa;border:none;border-radius:4px;color:#1e1e2e;cursor:pointer;font-size:12px;';
      var btnCancel = document.createElement('button');
      btnCancel.textContent = '取消';
      btnCancel.style.cssText = 'padding:5px 18px;background:#444;border:1px solid #666;border-radius:4px;color:#e0e0e0;cursor:pointer;font-size:12px;';
      btnRow.appendChild(btnCancel);
      btnRow.appendChild(btnOk);
      box.appendChild(btnRow);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      input.focus();
      input.select();
      function close(val) { document.body.removeChild(overlay); resolve(val); }
      btnOk.addEventListener('click', function() { close(input.value); });
      btnCancel.addEventListener('click', function() { close(null); });
      input.addEventListener('keydown', function(e) { if (e.key === 'Enter') close(input.value); if (e.key === 'Escape') close(null); });
      overlay.addEventListener('click', function(e) { if (e.target === overlay) close(null); });
    });
  }

  function _confirmDialog(message) {
    return new Promise(function(resolve) {
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
      var box = document.createElement('div');
      box.style.cssText = 'background:#2d2d2d;border:1px solid #555;border-radius:8px;padding:20px;min-width:280px;color:#e0e0e0;';
      box.innerHTML = '<div style="margin-bottom:16px;font-size:14px;">' + message + '</div>';
      var btnRow = document.createElement('div');
      btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
      var btnOk = document.createElement('button');
      btnOk.textContent = '确定';
      btnOk.style.cssText = 'padding:5px 18px;background:#89b4fa;border:none;border-radius:4px;color:#1e1e2e;cursor:pointer;font-size:12px;';
      var btnCancel = document.createElement('button');
      btnCancel.textContent = '取消';
      btnCancel.style.cssText = 'padding:5px 18px;background:#444;border:1px solid #666;border-radius:4px;color:#e0e0e0;cursor:pointer;font-size:12px;';
      btnRow.appendChild(btnCancel);
      btnRow.appendChild(btnOk);
      box.appendChild(btnRow);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      function close(val) { document.body.removeChild(overlay); resolve(val); }
      btnOk.addEventListener('click', function() { close(true); });
      btnCancel.addEventListener('click', function() { close(false); });
      overlay.addEventListener('click', function(e) { if (e.target === overlay) close(false); });
    });
  }

  async function init() {
    try {
      var initData = await window.api.getEditorInit();
      if (!initData) return;
      _projectPath = initData.path;

      var configStr = await window.api.readFile(_projectPath + '/project.json');
      if (configStr) {
        var config = JSON.parse(configStr);
        AppWindowManager.init({ ...config.appConfig, windows: config.appWindows || [] });
        document.getElementById('project-name').textContent = config.name || 'APP项目';
        _updateGlobalSettings();
        AppWindowManager.getWindows().forEach(function(w) { _expandedWindows[w.id] = true; });
      } else {
        AppWindowManager.addWindow('主窗口');
      }

      // 规范化 appType（兼容历史值 'console' → 'cli'）
      var rawType = AppWindowManager.getAppConfig().appType || 'win';
      if (rawType === 'console') {
        AppWindowManager.updateAppConfig('appType', 'cli');
        rawType = 'cli';
      }
      _appType = rawType;

      _bindEvents();
      AppWindowManager.onChange(_renderAll);
      _renderAll();
    } catch (e) { console.error('[APP编辑器] 初始化失败:', e); }
  }

  function _renderAll() {
    var appCfg = AppWindowManager.getAppConfig();
    var cliMode = _isCliMode();

    // ========== CLI 模式布局切换 ==========
    var vizPanel = document.getElementById('app-visual-panel');
    var grid = document.getElementById('app-main-grid');
    if (cliMode) {
      // 硬操作：隐藏可视化面板 + 重排 grid
      if (vizPanel) vizPanel.style.setProperty('display', 'none', 'important');
      if (grid) {
        grid.style.gridTemplateColumns = '1fr 300px';
        grid.style.gridTemplateRows = '2fr 1fr';
      }
      // 重排子面板位置
      var winsPanel = document.getElementById('app-windows-panel');
      var setPanel = document.getElementById('app-settings-panel');
      var conPanel = document.getElementById('app-console-panel');
      var globalPanel = document.getElementById('app-global-settings');
      if (winsPanel) { winsPanel.style.gridRow = '1'; winsPanel.style.gridColumn = '1'; }
      if (setPanel) { setPanel.style.gridRow = '1'; setPanel.style.gridColumn = '2'; }
      if (conPanel) { conPanel.style.gridRow = '2'; conPanel.style.gridColumn = '1'; }
      if (globalPanel) { globalPanel.style.gridRow = '2'; globalPanel.style.gridColumn = '2'; }
    } else {
      // 恢复原样
      if (vizPanel) vizPanel.style.display = '';
      if (grid) {
        grid.style.gridTemplateColumns = '';
        grid.style.gridTemplateRows = '';
      }
      var winsPanel2 = document.getElementById('app-windows-panel');
      var setPanel2 = document.getElementById('app-settings-panel');
      var conPanel2 = document.getElementById('app-console-panel');
      var globalPanel2 = document.getElementById('app-global-settings');
      if (winsPanel2) { winsPanel2.style.gridRow = ''; winsPanel2.style.gridColumn = ''; }
      if (setPanel2) { setPanel2.style.gridRow = ''; setPanel2.style.gridColumn = ''; }
      if (conPanel2) { conPanel2.style.gridRow = ''; conPanel2.style.gridColumn = ''; }
      if (globalPanel2) { globalPanel2.style.gridRow = ''; globalPanel2.style.gridColumn = ''; }
    }

    _renderWindowsTree();
    _renderSettingsPanel();
    _updateStartWindowSelect();
    _renderVisualCanvas();
  }

  function _escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ========== 文件系统风格的窗口树 ==========
  function _isCliMode() {
    var appCfg = AppWindowManager.getAppConfig();
    return appCfg && (appCfg.appType === 'cli' || appCfg.appType === 'console');
  }

  function _renderWindowsTree() {
    var c = document.getElementById('windows-tree');
    if (!c) return;
    var wins = AppWindowManager.getWindows();
    var selWinId = AppWindowManager.getSelectedWindowId();
    var selCompId = AppWindowManager.getSelectedComponentId();
    var cliMode = _isCliMode();
    c.innerHTML = '';

    wins.forEach(function(w) {
      var hasChildren = !cliMode && w.components.length > 0;
      var isExpanded = _expandedWindows[w.id] !== false;
      var isSelected = (w.id === selWinId && (cliMode || !selCompId));

      var node = document.createElement('div');
      node.className = 'tree-node tree-window' + (isSelected ? ' selected' : '');
      node.innerHTML =
        '<span class="tree-arrow' + (hasChildren ? '' : ' empty') + '">' + (hasChildren && isExpanded ? '▼' : '▶') + '</span>' +
        '<span class="tree-icon">🪟</span>' +
        '<span class="tree-label">' + _escHtml(w.name) + '</span>' +
        (cliMode ? '' : '<span class="tree-badge">' + w.components.length + '</span>');

      node.querySelector('.tree-arrow').addEventListener('click', function(e) {
        e.stopPropagation();
        if (cliMode) return; // CLI 模式无组件，不展开
        _expandedWindows[w.id] = !isExpanded;
        _renderWindowsTree();
      });

      node.addEventListener('click', function() {
        AppWindowManager.selectWindow(w.id);
        AppWindowManager.selectComponent(null);
      });

      // 右键菜单
      node.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        _showContextMenu(e.clientX, e.clientY, { windowId: w.id, componentId: null });
      });

      c.appendChild(node);

      // 展开时显示子组件（CLI 模式跳过）
      if (isExpanded && !cliMode) {
        var icons = { button:'🔘', input:'📝', label:'🏷️', list:'📋', image:'🖼️', textarea:'📄', checkbox:'☑️', radio:'⚪', dropdown:'📃', slider:'🎚️', progress:'📊', html:'🌐', canvas:'🎨' };
        w.components.forEach(function(comp) {
          var compNode = document.createElement('div');
          var isCompSel = (comp.id === selCompId);
          compNode.className = 'tree-node tree-component' + (isCompSel ? ' selected' : '');
          compNode.innerHTML =
            '<span class="tree-icon">' + (icons[comp.type] || '📦') + '</span>' +
            '<span class="tree-label">' + _escHtml(comp.name) + '</span>' +
            '<span class="tree-type">' + comp.type + '</span>';
          compNode.addEventListener('click', function(e) {
            e.stopPropagation();
            AppWindowManager.selectWindow(w.id);
            AppWindowManager.selectComponent(comp.id);
          });
          compNode.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            _showContextMenu(e.clientX, e.clientY, { windowId: w.id, componentId: comp.id });
          });
          c.appendChild(compNode);
        });

        // 添加组件按钮
        var addBtn = document.createElement('div');
        addBtn.className = 'tree-node tree-add';
        addBtn.innerHTML = '<span class="tree-icon">➕</span><span class="tree-label">添加组件...</span>';
        addBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          _showAddComponentDialog(w.id);
        });
        c.appendChild(addBtn);
      }
    });

    if (wins.length === 0) {
      c.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;">暂无窗口<br>点击 + 添加</div>';
    }
  }

  // ========== 右键菜单 ==========
  function _showContextMenu(x, y, target) {
    var menu = document.getElementById('app-context-menu');
    if (!menu) return;
    menu.innerHTML = '';
    menu.style.display = 'block';
    menu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 200) + 'px';

    var cliMode = _isCliMode();
    var win = AppWindowManager.getWindow(target.windowId);
    var comp = target.componentId ? (win && win.components.find(function(c) { return c.id === target.componentId; })) : null;
    var targetName = comp ? comp.name : (win ? win.name : '');
    var hasScript = comp ? !!(comp.blocksData && Object.keys(comp.blocksData).length > 0)
                        : !!(win && win.blocksData && Object.keys(win.blocksData).length > 0);

    // 标题
    var header = document.createElement('div');
    header.style.cssText = 'padding:4px 16px 8px;font-size:11px;color:#888;border-bottom:1px solid #444;margin-bottom:4px;';
    header.textContent = (comp && !cliMode ? '📦 ' : '🪟 ') + targetName;
    menu.appendChild(header);

    // 新建窗口（始终显示）
    menu.appendChild(_createMenuItem('🪟', '新建窗口', false, async function() {
      var name = await _promptDialog('窗口名称:', '新窗口');
      if (name) {
        var id = AppWindowManager.addWindow(name);
        _expandedWindows[id] = true;
      }
    }));

    menu.appendChild(_createSep());

    if (!cliMode) {
      // 非 CLI 模式：显示脚本编辑选项
      // 新建脚本
      var newItem = _createMenuItem('📝', '新建脚本', hasScript, function() {
        _openScript(target.windowId, target.componentId, true);
      });
      menu.appendChild(newItem);

      // 编辑脚本
      var editItem = _createMenuItem('✏️', '编辑脚本', !hasScript, function() {
        _openScript(target.windowId, target.componentId, false);
      });
      menu.appendChild(editItem);

      menu.appendChild(_createSep());
    } else {
      // CLI 模式：只显示窗口级脚本选项（不能是组件级）
      if (!comp) {
        var cliWinHasScript = !!(win && win.blocksData && Object.keys(win.blocksData).length > 0);
        menu.appendChild(_createMenuItem('📝', '新建窗口脚本', cliWinHasScript, function() {
          _openScript(target.windowId, null, true);
        }));
        menu.appendChild(_createMenuItem('✏️', '编辑窗口脚本', !cliWinHasScript, function() {
          _openScript(target.windowId, null, false);
        }));
        menu.appendChild(_createSep());
      }
    }

    if (!cliMode) {
      // CLI 模式不显示组件右键项
      // 重命名
      menu.appendChild(_createMenuItem('✏️', '重命名', false, async function() {
        var newName = await _promptDialog('新名称:', targetName);
        if (newName) {
          if (comp) AppWindowManager.updateComponentProp(target.windowId, target.componentId, 'name', newName);
          else AppWindowManager.updateWindowProp(target.windowId, 'name', newName);
        }
      }));

      // 删除
      menu.appendChild(_createMenuItem('🗑️', comp ? '删除组件' : '删除窗口', false, async function() {
        if (await _confirmDialog('确定删除 "' + targetName + '"?')) {
          if (comp) AppWindowManager.removeComponent(target.windowId, target.componentId);
          else AppWindowManager.removeWindow(target.windowId);
        }
      }));
    } else {
      // CLI 模式只有窗口级操作
      menu.appendChild(_createMenuItem('✏️', '重命名', false, async function() {
        var newName = await _promptDialog('新名称:', targetName);
        if (newName) AppWindowManager.updateWindowProp(target.windowId, 'name', newName);
      }));
      menu.appendChild(_createMenuItem('🗑️', '删除窗口', false, async function() {
        if (await _confirmDialog('确定删除 "' + targetName + '"?')) AppWindowManager.removeWindow(target.windowId);
      }));
    }
  }

  function _createMenuItem(icon, label, disabled, onClick) {
    var item = document.createElement('div');
    item.className = 'context-menu-item' + (disabled ? ' disabled' : '');
    item.innerHTML = '<span>' + icon + '</span><span>' + label + '</span>';
    if (!disabled) {
      item.addEventListener('click', function() {
        _hideContextMenu();
        onClick();
      });
    }
    return item;
  }

  function _createSep() {
    var sep = document.createElement('div');
    sep.className = 'context-menu-sep';
    return sep;
  }

  function _hideContextMenu() {
    var menu = document.getElementById('app-context-menu');
    if (menu) menu.style.display = 'none';
  }

  // ========== 脚本管理 ==========
  function _openScript(windowId, componentId, isNew) {
    _currentScriptTarget = { windowId: windowId, componentId: componentId };
    if (isNew && !componentId) {
      // 窗口级新建：清空
      AppWindowManager.setWindowBlocks(windowId, {});
    } else if (isNew && componentId) {
      AppWindowManager.setComponentBlocks(windowId, componentId, {});
    }
    window.api.openAppBlocksWindow(windowId, componentId, _appType);
  }

  // ========== 设置面板 ==========
  function _renderSettingsPanel() {
    var c = document.getElementById('settings-content');
    if (!c) return;
    var win = AppWindowManager.getSelectedWindow();
    var comp = AppWindowManager.getSelectedComponent();
    var appCfg = AppWindowManager.getAppConfig();
    var cliMode = _isCliMode();
    c.innerHTML = '';

    // 始终显示全局设置（运行模式选择）
    _renderGlobalSettings(c, appCfg);

    if (!win) {
      var ph = document.createElement('div');
      ph.className = 'settings-placeholder';
      ph.textContent = '选择窗口以编辑属性';
      c.appendChild(ph);
      return;
    }

    // CLI 模式：忽略组件选择，只显示窗口属性（简化版）
    if (cliMode) {
      _renderCliWindowSettings(c, win);
      return;
    }

    if (comp) _renderComponentSettings(c, comp, win);
    else {
      _renderWindowSettings(c, win);
      // HTML 类型窗口：显示可视化样式编辑提示
      if (appCfg.appType === 'html') {
        _renderStyleHints(c, win);
      }
    }
  }

  // ========== CLI 模式窗口设置（无组件/无样式） ==========
  function _renderCliWindowSettings(c, win) {
    var html = '<div class="settings-group">' +
        '<div class="settings-group-title">🪟 窗口属性</div>' +
        '<div class="settings-row"><label class="settings-label">名称</label><input class="settings-input" type="text" value="' + _escHtml(win.name) + '" data-prop="name"/></div>' +
        '<div class="settings-row"><label class="settings-label">标题</label><input class="settings-input" type="text" value="' + _escHtml(win.title) + '" data-prop="title"/></div>' +
      '</div>';
    // CLI 模式提示
    html += '<div class="settings-group">' +
        '<div class="settings-group-title">⌨️ CLI 控制台模式</div>' +
        '<div style="font-size:11px;line-height:1.8;padding:4px 0;color:var(--text-muted,#888);">' +
          '📦 此模式无可视化组件<br>' +
          '📝 通过积木脚本进行控制台交互<br>' +
          '🖥️ 测试运行时将在控制台窗口启动<br>' +
          '💡 可使用 打印/输入/变量/循环 等积木' +
        '</div>' +
      '</div>';
    c.innerHTML = html;
    // 绑定属性编辑
    c.querySelectorAll('[data-prop]').forEach(function(inp) {
      inp.addEventListener('change', function(e) {
        var v = e.target.value;
        var key = e.target.dataset.prop;
        AppWindowManager.updateWindowProp(win.id, key, v);
      });
    });
  }

  // 全局设置：运行模式选择
  function _renderGlobalSettings(c, appCfg) {
    var group = document.createElement('div');
    group.className = 'settings-group';
    var currentType = appCfg.appType || 'win';
    if (currentType === 'console') currentType = 'cli'; // 兼容历史值
    group.innerHTML =
      '<div class="settings-group-title">⚙️ 运行模式</div>' +
      '<div class="settings-row">' +
        '<label class="settings-label">模式</label>' +
        '<select class="settings-input" id="app-type-select" style="cursor:pointer;">' +
          '<option value="win"' + (currentType === 'win' ? ' selected' : '') + '>🖥️ Win32 原生窗口</option>' +
          '<option value="html"' + (currentType === 'html' ? ' selected' : '') + '>🌐 HTML 精细页面</option>' +
          '<option value="cli"' + (currentType === 'cli' ? ' selected' : '') + '>⌨️ CLI 控制台</option>' +
        '</select>' +
      '</div>' +
      '<div id="app-type-desc" style="font-size:11px;color:var(--text-muted,#888);padding:4px 0;line-height:1.5;">' +
        (currentType === 'win' ? '使用 Windows 原生控件，性能好但样式固定' : 
         currentType === 'html' ? '使用 HTML/CSS 渲染，可自定义样式和布局' :
         '纯文本控制台模式，无 GUI，通过命令行交互') +
      '</div>';
    c.appendChild(group);

    document.getElementById('app-type-select')?.addEventListener('change', function(e) {
      var newType = e.target.value;
      AppWindowManager.updateAppConfig('appType', newType);
      _appType = newType;
      var descEl = document.getElementById('app-type-desc');
      if (descEl) {
        descEl.textContent = newType === 'win' ? '使用 Windows 原生控件，性能好但样式固定'
          : newType === 'html' ? '使用 HTML/CSS 渲染，可自定义样式和布局'
          : '纯文本控制台模式，无 GUI，通过命令行交互';
      }
      var modeName = newType === 'win' ? 'Win32 原生窗口' : newType === 'html' ? 'HTML 精细页面' : 'CLI 控制台';
      _logConsole('运行模式已切换为: ' + modeName, 'info');
      _renderAll();
    });
  }

  function _renderWindowSettings(c, win) {
    var appCfg = AppWindowManager.getAppConfig();
    var isNative = (appCfg.appType || 'win') === 'win';
    // 基础属性
    var html = '<div class="settings-group">' +
        '<div class="settings-group-title">🪟 窗口属性</div>' +
        '<div class="settings-row"><label class="settings-label">名称</label><input class="settings-input" type="text" value="' + _escHtml(win.name) + '" data-prop="name"/></div>' +
        '<div class="settings-row"><label class="settings-label">标题</label><input class="settings-input" type="text" value="' + _escHtml(win.title) + '" data-prop="title"/></div>' +
        '<div class="settings-row"><label class="settings-label">宽度</label><input class="settings-input" type="number" value="' + win.width + '" data-prop="width" min="100"/></div>' +
        '<div class="settings-row"><label class="settings-label">高度</label><input class="settings-input" type="number" value="' + win.height + '" data-prop="height" min="100"/></div>' +
      '</div>';
    // 全局样式（仅 HTML 模式显示，原生模式不支持 CSS）
    if (!isNative) {
      html += '<div class="settings-group">' +
          '<div class="settings-group-title" style="display:flex;align-items:center;justify-content:space-between;">' +
            '<span>🎨 全局样式</span>' +
            '<button class="panel-btn" id="btn-open-win-style" style="width:auto;padding:3px 10px;font-size:11px;margin:0;">编辑样式 ▶</button>' +
          '</div>' +
          '<div style="font-size:10px;color:#888;padding:2px 0;">背景: ' + (win.backgroundColor || '#f0f0f0') +
            (win.customCSS ? ' | 自定义CSS' : '') + '</div>' +
        '</div>';
    }
    c.innerHTML = html;
    // 绑定属性编辑
    c.querySelectorAll('[data-prop]').forEach(function(inp) {
      inp.addEventListener('change', function(e) {
        var v = e.target.value;
        var key = e.target.dataset.prop;
        if (key === 'width' || key === 'height') v = parseInt(v) || 100;
        AppWindowManager.updateWindowProp(win.id, key, v);
      });
    });
    // 打开样式编辑器
    document.getElementById('btn-open-win-style')?.addEventListener('click', function() {
      _openStyleEditor(win, 'window');
    });
  }

  function _renderComponentSettings(c, comp, win) {
    var html = '<div class="settings-group"><div class="settings-group-title">组件属性 (' + comp.type + ')</div>' +
      '<div class="settings-row"><label class="settings-label">名称</label><input class="settings-input" type="text" value="' + _escHtml(comp.name) + '" data-cp="name"/></div>';
    // 文本类属性
    if (['button','label','checkbox','radio'].includes(comp.type))
      html += '<div class="settings-row"><label class="settings-label">文本</label><input class="settings-input" type="text" value="' + _escHtml(comp.text||'') + '" data-cp="text"/></div>';
    if (comp.type === 'input')
      html += '<div class="settings-row"><label class="settings-label">默认值</label><input class="settings-input" type="text" value="' + _escHtml(comp.defaultValue||'') + '" data-cp="defaultValue"/></div>';
    if (comp.type === 'textarea')
      html += '<div class="settings-row"><label class="settings-label">默认值</label><textarea class="settings-input" data-cp="defaultValue" style="height:60px;resize:vertical;">' + _escHtml(comp.defaultValue||'') + '</textarea></div>';
    if (comp.type === 'image')
      html += '<div class="settings-row"><label class="settings-label">图片路径</label><input class="settings-input" type="text" value="' + _escHtml(comp.src||'') + '" data-cp="src"/></div>' +
              '<div class="settings-row"><button class="panel-btn" id="btn-pick-image" style="width:auto;padding:4px 10px;">选择图片...</button></div>';
    if (comp.type === 'dropdown')
      html += '<div class="settings-row"><label class="settings-label">选项(逗号分隔)</label><input class="settings-input" type="text" value="' + _escHtml((comp.items||[]).join(',')) + '" data-cp="items-csv"/></div>';
    if (comp.type === 'slider' || comp.type === 'progress') {
      html += '<div class="settings-row"><label class="settings-label">最小值</label><input class="settings-input" type="number" value="' + (comp.min||0) + '" data-cp="min"/></div>' +
              '<div class="settings-row"><label class="settings-label">最大值</label><input class="settings-input" type="number" value="' + (comp.max||100) + '" data-cp="max"/></div>' +
              '<div class="settings-row"><label class="settings-label">当前值</label><input class="settings-input" type="number" value="' + (comp.value||0) + '" data-cp="value"/></div>';
    }
    if (comp.type === 'html')
      html += '<div class="settings-row"><label class="settings-label">HTML内容</label><textarea class="settings-input" data-cp="htmlContent" style="height:80px;resize:vertical;font-family:monospace;font-size:11px;">' + _escHtml(comp.htmlContent||'') + '</textarea></div>';
    // 位置尺寸
    html += '<div class="settings-sep"></div>' +
      '<div class="settings-row"><label class="settings-label">X</label><input class="settings-input" type="number" value="' + (comp.x||10) + '" data-cp="x"/></div>' +
      '<div class="settings-row"><label class="settings-label">Y</label><input class="settings-input" type="number" value="' + (comp.y||10) + '" data-cp="y"/></div>' +
      '<div class="settings-row"><label class="settings-label">宽度</label><input class="settings-input" type="number" value="' + (comp.width||120) + '" data-cp="width" min="20"/></div>' +
      '<div class="settings-row"><label class="settings-label">高度</label><input class="settings-input" type="number" value="' + (comp.height||32) + '" data-cp="height" min="20"/></div>';
    // 样式（仅 HTML 模式显示，原生模式不支持 CSS）
    var _isNativeMode = (AppWindowManager.getAppConfig().appType || 'win') === 'win';
    if (!_isNativeMode) {
      html += '<div class="settings-sep"></div>' +
        '<div class="settings-group-title" style="display:flex;align-items:center;justify-content:space-between;">' +
          '<span>🎨 样式</span>' +
          '<button class="panel-btn" id="btn-open-comp-style" style="width:auto;padding:3px 10px;font-size:11px;margin:0;">编辑样式 ▶</button>' +
        '</div>' +
        '<div style="font-size:10px;color:#888;padding:2px 0;">背景: ' + (comp.bgColor||'#3b82f6') + ' | 文字: ' + (comp.textColor||'#ffffff') +
          (comp.customCSS ? ' | 自定义CSS' : '') + '</div>';
    }
    // 删除/复制
    html += '<div class="settings-sep"></div>' +
      '<div class="settings-row" style="display:flex;gap:6px;">' +
        '<button class="btn-action" id="btn-copy-comp" style="flex:1;background:#89b4fa;color:#1e1e2e;border:none;padding:6px;border-radius:4px;cursor:pointer;">📋 复制</button>' +
        '<button class="btn-action" id="btn-delete-comp" style="flex:1;background:#f38ba8;color:#1e1e2e;border:none;padding:6px;border-radius:4px;cursor:pointer;">🗑️ 删除</button>' +
      '</div></div>';
    c.innerHTML = html;
    // 绑定属性编辑
    c.querySelectorAll('[data-cp]').forEach(function(inp) {
      inp.addEventListener('change', function(e) {
        var w = AppWindowManager.getSelectedWindow();
        var cp = AppWindowManager.getSelectedComponent();
        if (!w || !cp) return;
        var v = e.target.value;
        var key = e.target.dataset.cp;
        if (['x','y','width','height','fontSize','min','max','value'].includes(key)) v = parseInt(v) || 0;
        if (key === 'items-csv') { key = 'items'; v = v.split(',').map(function(s){return s.trim();}).filter(Boolean); }
        AppWindowManager.updateComponentProp(w.id, cp.id, key, v);
      });
    });
    c.querySelector('#btn-delete-comp')?.addEventListener('click', async function() {
      if (win && await _confirmDialog('确定删除此组件?')) AppWindowManager.removeComponent(win.id, comp.id);
    });
    c.querySelector('#btn-copy-comp')?.addEventListener('click', function() {
      AppWindowManager.copySelected();
      _logConsole('组件已复制', 'info');
    });
    c.querySelector('#btn-open-comp-style')?.addEventListener('click', function() {
      _openStyleEditor(comp, 'component', win);
    });
    c.querySelector('#btn-pick-image')?.addEventListener('click', async function() {
      try {
        var fp = await window.api.selectImageFile();
        if (fp) {
          var w = AppWindowManager.getSelectedWindow();
          var cp = AppWindowManager.getSelectedComponent();
          if (w && cp) AppWindowManager.updateComponentProp(w.id, cp.id, 'src', fp);
        }
      } catch(e) { _logConsole('选择图片失败: ' + e.message, 'error'); }
    });
  }

  // ========== 可视化样式编辑提示（HTML 模式专用） ==========
  function _renderStyleHints(c, win) {
    var group = document.createElement('div');
    group.className = 'settings-group';
    group.innerHTML =
      '<div class="settings-group-title">🎨 HTML 模式提示</div>' +
      '<div style="font-size:11px;line-height:1.8;padding:4px 0;">' +
        '📦 右键窗口节点可添加组件<br>' +
        '🖱️ 可视化画布上拖拽布局<br>' +
        '📐 拖动组件右下角调整大小<br>' +
        '🧱 用“设置属性”积木动态修改样式' +
      '</div>';
    c.appendChild(group);
  }

  // ========== 样式编辑器（内嵌全功能） ==========
  // CSS 常用属性定义
  var _STYLE_PROPS = [
    // 背景
    { group: '🎨 背景', items: [
      { key: 'backgroundColor', label: '背景色', type: 'color' },
      { key: 'backgroundImage', label: '背景图/渐变', type: 'text', placeholder: 'linear-gradient(135deg, #667eea, #764ba2)' },
      { key: 'backgroundSize', label: '背景尺寸', type: 'select', options: ['cover','contain','auto','100% 100%'] },
      { key: 'backgroundRepeat', label: '背景重复', type: 'select', options: ['no-repeat','repeat','repeat-x','repeat-y'] },
    ]},
    // 文字
    { group: '✍️ 文字', items: [
      { key: 'color', label: '文字颜色', type: 'color' },
      { key: 'fontSize', label: '字号', type: 'number', min: 8, max: 120, unit: 'px' },
      { key: 'fontWeight', label: '字重', type: 'select', options: ['normal','bold','100','200','300','400','500','600','700','800','900'] },
      { key: 'fontFamily', label: '字体', type: 'select', options: ['inherit','sans-serif','serif','monospace','"Microsoft YaHei"','"SimHei"','"KaiTi"'] },
      { key: 'textAlign', label: '对齐', type: 'select', options: ['left','center','right','justify'] },
      { key: 'lineHeight', label: '行高', type: 'text', placeholder: '1.5' },
      { key: 'letterSpacing', label: '字间距', type: 'text', placeholder: '0px' },
      { key: 'textDecoration', label: '装饰', type: 'select', options: ['none','underline','overline','line-through'] },
      { key: 'textShadow', label: '文字阴影', type: 'text', placeholder: '2px 2px 4px rgba(0,0,0,0.3)' },
    ]},
    // 边框
    { group: '📐 边框与圆角', items: [
      { key: 'border', label: '边框', type: 'text', placeholder: '1px solid #333' },
      { key: 'borderRadius', label: '圆角', type: 'text', placeholder: '8px 或 50%' },
      { key: 'borderWidth', label: '边框宽度', type: 'text', placeholder: '1px' },
      { key: 'borderStyle', label: '边框样式', type: 'select', options: ['none','solid','dashed','dotted','double','groove','ridge'] },
      { key: 'borderColor', label: '边框颜色', type: 'color' },
    ]},
    // 阴影与效果
    { group: '✨ 效果', items: [
      { key: 'boxShadow', label: '盒子阴影', type: 'text', placeholder: '0 4px 12px rgba(0,0,0,0.3)' },
      { key: 'opacity', label: '透明度', type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'cursor', label: '光标', type: 'select', options: ['auto','pointer','crosshair','move','text','wait','grab','not-allowed','zoom-in'] },
      { key: 'userSelect', label: '可选中', type: 'select', options: ['auto','none','text','all'] },
      { key: 'backdropFilter', label: '背景模糊', type: 'text', placeholder: 'blur(10px)' },
    ]},
    // 变换与动画
    { group: '🔄 变换', items: [
      { key: 'transform', label: '变换', type: 'text', placeholder: 'rotate(0deg) scale(1)' },
      { key: 'transition', label: '过渡', type: 'text', placeholder: 'all 0.3s ease' },
      { key: 'filter', label: '滤镜', type: 'text', placeholder: 'brightness(1.2) contrast(1.1)' },
    ]},
    // 布局
    { group: '📏 布局', items: [
      { key: 'overflow', label: '溢出', type: 'select', options: ['auto','hidden','scroll','visible'] },
      { key: 'padding', label: '内边距', type: 'text', placeholder: '10px 或 10px 20px' },
      { key: 'margin', label: '外边距', type: 'text', placeholder: '0px 或 10px auto' },
      { key: 'display', label: '显示模式', type: 'select', options: ['block','flex','grid','inline-block','inline-flex','none'] },
      { key: 'flexDirection', label: 'Flex方向', type: 'select', options: ['row','column','row-reverse','column-reverse'] },
      { key: 'justifyContent', label: '主轴对齐', type: 'select', options: ['flex-start','center','flex-end','space-between','space-around','space-evenly'] },
      { key: 'alignItems', label: '交叉轴对齐', type: 'select', options: ['stretch','flex-start','center','flex-end','baseline'] },
      { key: 'gap', label: '间距', type: 'text', placeholder: '10px' },
      { key: 'zIndex', label: '层级', type: 'number', min: -100, max: 9999 },
    ]},
  ];

  function _openStyleEditor(target, type, win) {
    var isWindow = (type === 'window');
    var c = document.getElementById('settings-content');
    if (!c) return;
    c.innerHTML = '';

    // 解析已有的自定义 CSS 为键值对
    var existingCSS = {};
    var rawCSS = (isWindow ? target.customCSS : target.customCSS) || '';
    if (rawCSS) {
      rawCSS.split(';').forEach(function(rule) {
        rule = rule.trim();
        if (!rule) return;
        var idx = rule.indexOf(':');
        if (idx > 0) {
          var k = rule.substring(0, idx).trim();
          var v = rule.substring(idx + 1).trim();
          existingCSS[k] = v;
        }
      });
    }
    // 合并已知属性
    if (isWindow) {
      existingCSS['backgroundColor'] = existingCSS['backgroundColor'] || target.backgroundColor || '#f0f0f0';
      existingCSS['overflow'] = existingCSS['overflow'] || target.overflow || 'auto';
      existingCSS['padding'] = existingCSS['padding'] || (target.padding ? target.padding + 'px' : '0px');
    } else {
      existingCSS['backgroundColor'] = existingCSS['backgroundColor'] || target.bgColor || '#3b82f6';
      existingCSS['color'] = existingCSS['color'] || target.textColor || '#ffffff';
      existingCSS['fontSize'] = existingCSS['fontSize'] || (target.fontSize ? target.fontSize + 'px' : '14px');
      existingCSS['borderRadius'] = existingCSS['borderRadius'] || (target.border === 'rounded' ? '8px' : target.border === 'circle' ? '50%' : target.border === 'none' ? '0' : '');
      existingCSS['border'] = existingCSS['border'] || '';
    }

    var inputMap = {};  // key -> input element
    var title = isWindow ? '🪟 窗口样式' : '🧩 组件样式 (' + target.name + ')';

    // 顶部标题栏
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:12px;';
    header.innerHTML = '<button class="panel-btn" id="se-back" style="width:auto;padding:3px 10px;font-size:11px;margin:0;">← 返回</button>' +
      '<span style="font-size:13px;font-weight:600;flex:1;">' + title + '</span>';
    c.appendChild(header);

    // 实时预览区
    var previewWrap = document.createElement('div');
    previewWrap.style.cssText = 'margin-bottom:12px;padding:8px;background:#181825;border-radius:6px;border:1px solid #313244;';
    previewWrap.innerHTML = '<div style="font-size:10px;color:#6c7086;margin-bottom:4px;">实时预览</div>' +
      '<div id="se-preview" style="min-height:48px;padding:12px;border-radius:4px;text-align:center;font-size:13px;overflow:hidden;">预览效果</div>';
    c.appendChild(previewWrap);

    // 自定义 CSS 编辑器（可折叠，放在预览下方）
    var customCSSWrap = document.createElement('div');
    customCSSWrap.style.cssText = 'margin-bottom:12px;';
    customCSSWrap.innerHTML =
      '<div style="font-size:11px;color:#a6adc8;margin-bottom:4px;cursor:pointer;" id="se-css-toggle">📝 自定义 CSS <span style="font-size:10px;opacity:0.5;">▼</span></div>' +
      '<div id="se-css-body" style="display:' + (rawCSS ? 'block' : 'none') + ';">' +
        '<div style="font-size:10px;color:#6c7086;margin-bottom:3px;">' + (isWindow ? '作用于 #app-container' : '作用于组件元素') + '</div>' +
        '<textarea id="se-rawCSS" style="width:100%;height:80px;background:#11111b;border:1px solid #313244;border-radius:4px;color:#cdd6f4;font-family:Consolas,monospace;font-size:11px;resize:vertical;white-space:pre;tab-size:2;padding:6px;" placeholder="property: value;"></textarea>' +
      '</div>';
    c.appendChild(customCSSWrap);

    // 属性组
    var groupsEl = document.createElement('div');
    _STYLE_PROPS.forEach(function(g) {
      var gDiv = document.createElement('div');
      gDiv.style.cssText = 'margin-bottom:10px;';
      var gTitle = document.createElement('div');
      gTitle.style.cssText = 'font-size:11px;font-weight:600;color:#89b4fa;padding:4px 0;border-bottom:1px solid #313244;margin-bottom:6px;cursor:pointer;';
      gTitle.textContent = g.group;
      var gBody = document.createElement('div');
      gBody.style.cssText = 'display:none;';
      gTitle.addEventListener('click', function() {
        gBody.style.display = gBody.style.display === 'none' ? 'grid' : 'none';
      });
      gBody.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;';

      g.items.forEach(function(p) {
        var cell = document.createElement('div');
        cell.style.cssText = 'min-width:0;';
        var label = document.createElement('div');
        label.style.cssText = 'font-size:10px;color:#6c7086;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
        label.textContent = p.label;
        cell.appendChild(label);

        var currentVal = existingCSS[p.key] || p.placeholder || '';
        var inp;
        if (p.type === 'color') {
          var wrap = document.createElement('div');
          wrap.style.cssText = 'display:flex;gap:4px;align-items:center;';
          inp = document.createElement('input');
          inp.type = 'color';
          inp.value = /^#[0-9a-fA-F]{6}$/.test(currentVal) ? currentVal : '#000000';
          inp.style.cssText = 'width:28px;height:24px;padding:1px;cursor:pointer;border:1px solid #45475a;border-radius:3px;background:#313244;flex-shrink:0;';
          var txt = document.createElement('input');
          txt.type = 'text';
          txt.value = currentVal;
          txt.style.cssText = 'flex:1;min-width:0;padding:3px 4px;background:#313244;border:1px solid #45475a;border-radius:3px;color:#cdd6f4;font-family:monospace;font-size:10px;';
          inp.addEventListener('input', function() { txt.value = inp.value; _updateStylePreview(); });
          txt.addEventListener('input', function() {
            if (/^#[0-9a-fA-F]{6}$/.test(txt.value)) inp.value = txt.value;
            _updateStylePreview();
          });
          txt.addEventListener('change', _updateStylePreview);
          wrap.appendChild(inp);
          wrap.appendChild(txt);
          inputMap[p.key] = txt;
          cell.appendChild(wrap);
        } else if (p.type === 'select') {
          inp = document.createElement('select');
          inp.style.cssText = 'width:100%;padding:3px;background:#313244;border:1px solid #45475a;border-radius:3px;color:#cdd6f4;font-size:10px;cursor:pointer;';
          (p.options || []).forEach(function(opt) {
            var o = document.createElement('option');
            o.value = opt; o.textContent = opt;
            if (currentVal === opt) o.selected = true;
            inp.appendChild(o);
          });
          inp.addEventListener('change', _updateStylePreview);
          cell.appendChild(inp);
          inputMap[p.key] = inp;
        } else if (p.type === 'number') {
          inp = document.createElement('input');
          inp.type = 'number';
          inp.value = parseInt(currentVal) || 0;
          if (p.min != null) inp.min = p.min;
          if (p.max != null) inp.max = p.max;
          inp.style.cssText = 'width:100%;padding:3px;background:#313244;border:1px solid #45475a;border-radius:3px;color:#cdd6f4;font-size:10px;';
          inp.addEventListener('input', _updateStylePreview);
          cell.appendChild(inp);
          inputMap[p.key] = inp;
        } else if (p.type === 'range') {
          var wrap = document.createElement('div');
          wrap.style.cssText = 'display:flex;gap:4px;align-items:center;';
          inp = document.createElement('input');
          inp.type = 'range';
          inp.min = p.min || 0; inp.max = p.max || 1; inp.step = p.step || 0.05;
          inp.value = parseFloat(currentVal) || 1;
          inp.style.cssText = 'flex:1;min-width:0;';
          var valSpan = document.createElement('span');
          valSpan.style.cssText = 'font-size:10px;color:#a6adc8;min-width:28px;text-align:right;';
          valSpan.textContent = inp.value;
          inp.addEventListener('input', function() { valSpan.textContent = inp.value; _updateStylePreview(); });
          wrap.appendChild(inp);
          wrap.appendChild(valSpan);
          cell.appendChild(wrap);
          inputMap[p.key] = inp;
        } else {
          inp = document.createElement('input');
          inp.type = 'text';
          inp.value = currentVal;
          inp.placeholder = p.placeholder || '';
          inp.style.cssText = 'width:100%;padding:3px;background:#313244;border:1px solid #45475a;border-radius:3px;color:#cdd6f4;font-size:10px;';
          inp.addEventListener('input', _updateStylePreview);
          cell.appendChild(inp);
          inputMap[p.key] = inp;
        }
        gBody.appendChild(cell);
      });

      gDiv.appendChild(gTitle);
      gDiv.appendChild(gBody);
      groupsEl.appendChild(gDiv);
    });
    c.appendChild(groupsEl);

    // 保存按钮
    var btnSave = document.createElement('button');
    btnSave.textContent = '💾 保存样式';
    btnSave.style.cssText = 'width:100%;padding:8px;background:#89b4fa;color:#1e1e2e;border:none;border-radius:4px;cursor:pointer;font-weight:600;font-size:12px;margin-top:8px;';
    btnSave.addEventListener('click', _saveStyle);
    c.appendChild(btnSave);

    // 重置按钮
    var btnReset = document.createElement('button');
    btnReset.textContent = '↩️ 重置为默认';
    btnReset.style.cssText = 'width:100%;padding:6px;background:#45475a;color:#cdd6f4;border:none;border-radius:4px;cursor:pointer;font-size:11px;margin-top:4px;';
    btnReset.addEventListener('click', function() {
      Object.keys(inputMap).forEach(function(k) {
        var el = inputMap[k];
        if (el.type === 'color') el.value = '#000000';
        else if (el.type === 'select') el.selectedIndex = 0;
        else el.value = '';
      });
      var rawEl = document.getElementById('se-rawCSS');
      if (rawEl) rawEl.value = '';
      _updateStylePreview();
    });
    c.appendChild(btnReset);

    // --- 函数 ---
    function _buildCSSMap() {
      var map = {};
      Object.keys(inputMap).forEach(function(k) {
        var el = inputMap[k];
        var v = el.value;
        if (v && v.trim()) {
          var prop = _STYLE_PROPS.reduce(function(acc, g) {
            var found = g.items.find(function(p) { return p.key === k; });
            return found || acc;
          }, null);
          if (prop && prop.unit && v && !isNaN(parseFloat(v))) v = v + prop.unit;
          map[k] = v;
        }
      });
      // 合并原始 CSS
      var rawEl = document.getElementById('se-rawCSS');
      if (rawEl && rawEl.value.trim()) {
        rawEl.value.split(';').forEach(function(rule) {
          rule = rule.trim();
          if (!rule) return;
          var idx = rule.indexOf(':');
          if (idx > 0) {
            map[rule.substring(0, idx).trim()] = rule.substring(idx + 1).trim();
          }
        });
      }
      return map;
    }

    function _updateStylePreview() {
      var preview = document.getElementById('se-preview');
      if (!preview) return;
      var map = _buildCSSMap();
      // 清除并应用
      preview.style.cssText = 'min-height:48px;padding:12px;border-radius:4px;text-align:center;font-size:13px;overflow:hidden;';
      Object.keys(map).forEach(function(k) {
        try { preview.style[k] = map[k]; } catch(e) {}
      });
    }
    _updateStylePreview();

    function _saveStyle() {
      var map = _buildCSSMap();
      // 提取已知属性到专用字段
      var bgColor = map['backgroundColor'] || '';
      var textColor = map['color'] || '';
      var fontSize = parseInt(map['fontSize']) || 0;
      var border = map['borderRadius'] === '8px' ? 'rounded' : map['borderRadius'] === '50%' ? 'circle' : map['borderRadius'] === '0' ? 'none' : 'default';
      // 剩余属性拼成 customCSS
      var knownKeys = ['backgroundColor','color','fontSize','borderRadius','overflow'];
      var customParts = [];
      Object.keys(map).forEach(function(k) {
        if (knownKeys.indexOf(k) < 0 && map[k]) customParts.push(k + ': ' + map[k]);
      });
      var customCSS = customParts.join('; ');

      if (isWindow) {
        AppWindowManager.updateWindowProp(target.id, 'backgroundColor', bgColor || '#f0f0f0');
        AppWindowManager.updateWindowProp(target.id, 'overflow', map['overflow'] || 'auto');
        AppWindowManager.updateWindowProp(target.id, 'padding', parseInt(map['padding']) || 0);
        AppWindowManager.updateWindowProp(target.id, 'customCSS', customCSS);
      } else {
        AppWindowManager.updateComponentProp(win.id, target.id, 'bgColor', bgColor || '#3b82f6');
        AppWindowManager.updateComponentProp(win.id, target.id, 'textColor', textColor || '#ffffff');
        AppWindowManager.updateComponentProp(win.id, target.id, 'fontSize', fontSize || 14);
        AppWindowManager.updateComponentProp(win.id, target.id, 'border', border);
        AppWindowManager.updateComponentProp(win.id, target.id, 'customCSS', customCSS);
      }
      _logConsole('样式已保存' + (customCSS ? ' (自定义CSS: ' + customParts.length + '条)' : ''), 'info');
    }

    // 返回按钮
    document.getElementById('se-back')?.addEventListener('click', function() {
      _renderSettingsPanel();
    });
    // 自定义 CSS 折叠
    document.getElementById('se-css-toggle')?.addEventListener('click', function() {
      var body = document.getElementById('se-css-body');
      if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
    });
    // 原始 CSS 同步
    var rawCSSInput = document.getElementById('se-rawCSS');
    if (rawCSSInput) rawCSSInput.addEventListener('input', _updateStylePreview);
    // 默认展开第一组
    if (groupsEl.firstChild) {
      var firstBody = groupsEl.firstChild.querySelector('div:nth-child(2)');
      if (firstBody) firstBody.style.display = 'grid';
    }
  }

  function _showAddComponentDialog(windowId) {
    if (_isCliMode()) { _logConsole('CLI 模式不支持添加组件', 'warn'); return; }
    var isNative = (_appType || 'win') === 'win';
    var types = [
      {type:'button',name:'按钮',icon:'🔘',desc:'可点击按钮'},
      {type:'input',name:'输入框',icon:'📝',desc:'单行文本输入'},
      {type:'textarea',name:'文本域',icon:'📄',desc:'多行文本输入'},
      {type:'label',name:'标签',icon:'🏷️',desc:'文本标签'},
      {type:'checkbox',name:'复选框',icon:'☑️',desc:'多选开关'},
      {type:'radio',name:'单选钮',icon:'⚪',desc:'单选开关'},
      {type:'dropdown',name:'下拉框',icon:'📃',desc:'下拉选择列表'},
      {type:'slider',name:'滑块',icon:'🎚️',desc:'拖动调节数值'},
      {type:'progress',name:'进度条',icon:'📊',desc:'显示进度'},
      {type:'list',name:'列表',icon:'📋',desc:'列表视图'},
      {type:'image',name:'图片',icon:'🖼️',desc:'图片显示'},
    ];
    // HTML 模式才显示 HTML 嵌入和画布
    if (!isNative) {
      types.push({type:'html',name:'HTML嵌入',icon:'🌐',desc:'嵌入HTML内容'});
      types.push({type:'canvas',name:'画布',icon:'🎨',desc:'Canvas绘图'});
    }
    var ov = document.createElement('div');
    ov.className = 'custom-prompt-overlay';
    var cardsHtml = types.map(function(t) {
      return '<div class="comp-type-card" data-type="' + t.type + '" style="padding:12px;border:1px solid var(--border);border-radius:6px;cursor:pointer;text-align:center;transition:all 0.15s;">' +
        '<div style="font-size:24px;margin-bottom:4px;">' + t.icon + '</div>' +
        '<div style="font-size:12px;font-weight:600;">' + t.name + '</div>' +
        '<div style="font-size:10px;color:var(--text-muted);margin-top:4px;">' + t.desc + '</div></div>';
    }).join('');
    ov.innerHTML = '<div class="custom-prompt-box" style="max-width:420px;">' +
      '<div class="custom-prompt-title">添加组件</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:12px 0;max-height:400px;overflow-y:auto;">' + cardsHtml + '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;"><button class="tb-btn" id="comp-cancel">取消</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelectorAll('.comp-type-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var t = types.find(function(x) { return x.type === card.dataset.type; });
        AppWindowManager.addComponent(windowId, t.type, {name: t.name});
        _expandedWindows[windowId] = true;
        ov.remove();
      });
    });
    ov.querySelector('#comp-cancel').addEventListener('click', function() { ov.remove(); });
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
  }

  function _updateStartWindowSelect() {
    var sel = document.getElementById('app-start-window');
    if (!sel) return;
    var wins = AppWindowManager.getWindows();
    var sw = AppWindowManager.getAppConfig().startWindow;
    sel.innerHTML = wins.map(function(w) { return '<option value="' + w.id + '"' + (w.id===sw?' selected':'') + '>' + w.name + '</option>'; }).join('');
  }

  function _updateGlobalSettings() {
    var cfg = AppWindowManager.getAppConfig();
    var inp = document.getElementById('app-title-input');
    if (inp) inp.value = cfg.title || '';
  }

  // ========== 可视化编辑器 ==========
  function _renderVisualCanvas() {
    var panel = document.getElementById('app-visual-panel');
    var frame = document.getElementById('visual-window-frame');
    if (!frame) return;

    // CLI 模式由 CSS .cli-mode 类控制隐藏，这里直接跳过渲染
    if (_isCliMode()) {
      // 清除内联 style，让 CSS class 接管
      if (panel) panel.style.display = '';
      return;
    }

    var win = AppWindowManager.getSelectedWindow();
    if (!win) {
      frame.style.display = 'none';
      return;
    }
    frame.style.display = 'block';
    // 应用窗口背景色预览
    frame.style.background = win.backgroundColor || '#f0f0f0';

    // 设置窗口框架尺寸
    var w = win.width || 800;
    var h = win.height || 600;
    frame.style.width = w + 'px';
    frame.style.height = h + 'px';
    frame.style.transform = 'scale(' + _viz.zoom + ')';

    // 网格
    if (_viz.gridOn) frame.classList.add('grid-on');
    else frame.classList.remove('grid-on');

    // 清除并重新渲染组件
    frame.innerHTML = '';

    var selCompId = AppWindowManager.getSelectedComponentId();
    var icons = { button:'🔘', input:'📝', label:'🏷️', list:'📋', image:'🖼️', textarea:'📄', checkbox:'☑️', radio:'⚪', dropdown:'📃', slider:'🎚️', progress:'📊', html:'🌐', canvas:'🎨' };

    (win.components || []).forEach(function(comp) {
      var compEl = document.createElement('div');
      compEl.className = 'visual-comp' + (comp.id === selCompId ? ' selected' : '');
      compEl.dataset.compId = comp.id;
      compEl.style.left = (comp.x || 10) + 'px';
      compEl.style.top = (comp.y || 10) + 'px';
      compEl.style.width = (comp.width || 120) + 'px';
      compEl.style.height = (comp.height || 32) + 'px';
      if (comp.bgColor) compEl.style.backgroundColor = comp.bgColor;
      if (comp.border === 'rounded') compEl.style.borderRadius = '8px';
      else if (comp.border === 'circle') compEl.style.borderRadius = '50%';

      var inner = document.createElement('div');
      inner.className = 'visual-comp-inner vc-' + comp.type;
      if (comp.textColor) inner.style.color = comp.textColor;
      if (comp.fontSize) inner.style.fontSize = comp.fontSize + 'px';

      var text = comp.text || comp.name || comp.type;
      var icon = icons[comp.type] || '📦';

      if (comp.type === 'list') {
        inner.innerHTML = '<div style="padding:4px;font-size:10px;border-bottom:1px solid #ddd;">' + _escHtml(text) + '</div>' +
          '<div style="padding:4px;font-size:9px;color:#666;">item 1</div>' +
          '<div style="padding:4px;font-size:9px;color:#666;">item 2</div>';
      } else if (comp.type === 'image') {
        inner.innerHTML = '<div style="text-align:center;">' + icon + '<br><span style="font-size:9px;color:#999;">' + _escHtml(text) + '</span></div>';
      } else if (comp.type === 'checkbox' || comp.type === 'radio') {
        inner.innerHTML = '<span style="margin-right:4px;">' + (comp.type==='checkbox'?'☐':'○') + '</span><span>' + _escHtml(text) + '</span>';
      } else if (comp.type === 'dropdown') {
        inner.innerHTML = '<span style="flex:1;padding:0 6px;">' + _escHtml((comp.items&&comp.items[0])||'选择...') + '</span><span style="padding:0 6px;">▼</span>';
      } else if (comp.type === 'slider') {
        inner.innerHTML = '<div style="display:flex;align-items:center;gap:4px;width:100%;padding:0 6px;">' +
          '<span style="font-size:9px;">' + (comp.min||0) + '</span>' +
          '<div style="flex:1;height:4px;background:#555;border-radius:2px;position:relative;">' +
            '<div style="width:' + ((comp.value||0)/(comp.max||100)*100) + '%;height:100%;background:#3b82f6;border-radius:2px;"></div>' +
            '<div style="position:absolute;top:-4px;left:' + ((comp.value||0)/(comp.max||100)*100) + '%;width:12px;height:12px;background:#fff;border-radius:50%;transform:translateX(-6px);box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>' +
          '</div>' +
          '<span style="font-size:9px;">' + (comp.max||100) + '</span></div>';
      } else if (comp.type === 'progress') {
        var pct = Math.round(((comp.value||0)/(comp.max||100))*100);
        inner.innerHTML = '<div style="width:100%;padding:0 6px;">' +
          '<div style="height:8px;background:#555;border-radius:4px;overflow:hidden;margin-bottom:2px;">' +
            '<div style="width:' + pct + '%;height:100%;background:#a6e3a1;border-radius:4px;"></div>' +
          '</div>' +
          '<div style="text-align:center;font-size:9px;">' + pct + '%</div></div>';
      } else if (comp.type === 'textarea') {
        inner.innerHTML = '<div style="width:100%;height:100%;padding:4px;font-size:10px;color:#aaa;overflow:hidden;">' + _escHtml(text) + '</div>';
      } else if (comp.type === 'html') {
        inner.innerHTML = '<div style="width:100%;height:100%;padding:4px;font-size:10px;color:#666;overflow:hidden;background:#fafafa;">' + icon + '<br><span style="font-size:9px;">&lt;html&gt;</span></div>';
      } else if (comp.type === 'canvas') {
        inner.innerHTML = '<div style="width:100%;height:100%;padding:4px;font-size:10px;color:#666;overflow:hidden;background:#fff;">' + icon + '<br><span style="font-size:9px;">Canvas</span></div>';
      } else {
        inner.textContent = text;
      }

      compEl.appendChild(inner);

      // 缩放手柄（仅选中时显示）
      if (comp.id === selCompId) {
        ['tl','tr','bl','br','t','b','l','r'].forEach(function(dir) {
          var handle = document.createElement('div');
          handle.className = 'resize-handle rh-' + dir;
          handle.dataset.dir = dir;
          compEl.appendChild(handle);
        });
      }

      frame.appendChild(compEl);
    });
  }

  // 吸附到网格
  function _snapValue(val) {
    if (!_viz.snapOn) return val;
    return Math.round(val / _viz.gridSize) * _viz.gridSize;
  }

  // 可视化编辑器拖拽移动（带拖动阈值，避免影响输入框焦点）
  function _startCompDrag(e, compId) {
    var win = AppWindowManager.getSelectedWindow();
    var comp = win && win.components.find(function(c) { return c.id === compId; });
    if (!comp) return;

    var startX = e.clientX;
    var startY = e.clientY;
    var origX = comp.x || 10;
    var origY = comp.y || 10;
    var dragging = false;

    AppWindowManager.selectWindow(win.id);
    AppWindowManager.selectComponent(compId);

    function onMove(e2) {
      var dx = e2.clientX - startX;
      var dy = e2.clientY - startY;
      if (!dragging && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      if (!dragging) {
        dragging = true;
        document.body.style.userSelect = 'none';
      }
      var ndx = dx / _viz.zoom;
      var ndy = dy / _viz.zoom;
      var newX = _snapValue(origX + ndx);
      var newY = _snapValue(origY + ndy);
      // 拖拽时只更新画布，不重建设置面板
      comp.x = Math.max(0, newX);
      comp.y = Math.max(0, newY);
      _renderVisualCanvas();
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      if (dragging) {
        // 拖拽结束后正式提交变更（触发撤销记录和通知）
        AppWindowManager.updateComponentProp(win.id, compId, 'x', comp.x);
        AppWindowManager.updateComponentProp(win.id, compId, 'y', comp.y);
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // 可视化编辑器缩放手柄拖拽（带拖动阈值）
  function _startResizeDrag(e, compId, dir) {
    e.stopPropagation();
    var win = AppWindowManager.getSelectedWindow();
    var comp = win && win.components.find(function(c) { return c.id === compId; });
    if (!comp) return;

    var startX = e.clientX;
    var startY = e.clientY;
    var origX = comp.x || 10;
    var origY = comp.y || 10;
    var origW = comp.width || 120;
    var origH = comp.height || 32;
    var dragging = false;

    function onMove(e2) {
      var dx = e2.clientX - startX;
      var dy = e2.clientY - startY;
      if (!dragging && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      if (!dragging) {
        dragging = true;
        document.body.style.userSelect = 'none';
      }
      var ndx = dx / _viz.zoom;
      var ndy = dy / _viz.zoom;
      var newX = origX, newY = origY, newW = origW, newH = origH;

      if (dir.includes('r')) newW = Math.max(20, _snapValue(origW + ndx));
      if (dir.includes('l')) { newW = Math.max(20, _snapValue(origW - ndx)); newX = _snapValue(origX + ndx); }
      if (dir.includes('b')) newH = Math.max(20, _snapValue(origH + ndy));
      if (dir.includes('t')) { newH = Math.max(20, _snapValue(origH - ndy)); newY = _snapValue(origY + ndy); }

      // 拖拽时只更新画布
      comp.x = newX; comp.y = newY; comp.width = newW; comp.height = newH;
      _renderVisualCanvas();
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      if (dragging) {
        AppWindowManager.updateComponentProp(win.id, compId, 'x', comp.x);
        AppWindowManager.updateComponentProp(win.id, compId, 'y', comp.y);
        AppWindowManager.updateComponentProp(win.id, compId, 'width', comp.width);
        AppWindowManager.updateComponentProp(win.id, compId, 'height', comp.height);
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // 从工具栏拖拽添加组件（带拖动阈值）
  function _startToolbarDrag(e, type) {
    if (_isCliMode()) return; // CLI 模式禁止添加组件
    var win = AppWindowManager.getSelectedWindow();
    if (!win) return;

    var startX = e.clientX;
    var startY = e.clientY;
    var dragging = false;
    var preview = null;

    function onMove(e2) {
      if (!dragging) {
        if (Math.abs(e2.clientX - startX) < 3 && Math.abs(e2.clientY - startY) < 3) return;
        dragging = true;
        preview = document.createElement('div');
        preview.className = 'visual-drag-preview';
        preview.style.width = '120px';
        preview.style.height = '32px';
        document.getElementById('visual-canvas').appendChild(preview);
      }
      var canvas = document.getElementById('visual-canvas');
      var rect = canvas.getBoundingClientRect();
      preview.style.left = (e2.clientX - rect.left - 60) + 'px';
      preview.style.top = (e2.clientY - rect.top - 16) + 'px';
    }

    function onUp(e2) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (preview) preview.remove();
      if (!dragging) return;

      var frame = document.getElementById('visual-window-frame');
      var frameRect = frame.getBoundingClientRect();
      var x = _snapValue((e2.clientX - frameRect.left) / _viz.zoom);
      var y = _snapValue((e2.clientY - frameRect.top) / _viz.zoom);

      if (x >= 0 && y >= 0 && x < (win.width || 800) && y < (win.height || 600)) {
        var names = { button:'按钮', input:'输入框', textarea:'文本域', label:'标签', checkbox:'复选框', radio:'单选钮', dropdown:'下拉框', slider:'滑块', progress:'进度条', list:'列表', image:'图片', html:'HTML', canvas:'画布' };
        AppWindowManager.addComponent(win.id, type, {
          name: names[type] || type,
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: (type==='textarea'?200:type==='list'?180:type==='slider'||type==='progress'?160:type==='html'?300:type==='canvas'?200:120),
          height: type === 'list' ? 150 : type === 'textarea' ? 100 : type === 'html' ? 200 : type === 'canvas' ? 150 : 32
        });
        _expandedWindows[win.id] = true;
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // 缩放控制
  function _zoomIn() { _viz.zoom = Math.min(3, _viz.zoom + 0.1); _renderVisualCanvas(); }
  function _zoomOut() { _viz.zoom = Math.max(0.2, _viz.zoom - 0.1); _renderVisualCanvas(); }
  function _zoomFit() {
    var container = document.getElementById('visual-canvas');
    if (!container) return;
    var win = AppWindowManager.getSelectedWindow();
    if (!win) return;
    var cw = container.clientWidth - 40;
    var ch = container.clientHeight - 40;
    var ww = win.width || 800;
    var wh = win.height || 600;
    _viz.zoom = Math.min(cw / ww, ch / wh, 1);
    _renderVisualCanvas();
  }

  // ========== 事件绑定 ==========
  function _bindEvents() {
    document.getElementById('win-minimize')?.addEventListener('click', function() { window.api.windowMinimize(); });
    document.getElementById('win-maximize')?.addEventListener('click', function() { window.api.windowMaximize(); });
    document.getElementById('win-close')?.addEventListener('click', function() { window.api.windowClose(); });

    // 菜单栏下拉交互
    var menubar = document.getElementById('menubar');
    var openMenu = null;
    function closeAllMenus() {
      if (!menubar) return;
      menubar.querySelectorAll('.menu-item.open').forEach(function(m) { m.classList.remove('open'); });
      openMenu = null;
    }
    if (menubar) {
      menubar.querySelectorAll('.menu-item').forEach(function(mi) {
        mi.addEventListener('click', function(e) {
          e.stopPropagation();
          var wasOpen = mi.classList.contains('open');
          closeAllMenus();
          if (!wasOpen) { mi.classList.add('open'); openMenu = mi; }
        });
        mi.addEventListener('mouseenter', function() {
          if (openMenu && openMenu !== mi) {
            closeAllMenus();
            mi.classList.add('open');
            openMenu = mi;
          }
        });
      });
    }

    document.querySelectorAll('.menu-dropdown-item').forEach(function(item) {
      item.addEventListener('click', function() {
        closeAllMenus();
        var a = item.dataset.action;
        if (a === 'home') window.api.windowClose();
        else if (a === 'save') _saveProject();
        else if (a === 'run-test') _runTest();
        else if (a === 'stop-test') _stopTest();
        else if (a === 'export') _showExportDialog();
        else if (a === 'app-guide') _openHelp();
        else if (a === 'prop-reference') _showPropReference();
      });
    });

    document.getElementById('btn-add-window')?.addEventListener('click', async function() {
      var name = await _promptDialog('窗口名称:', '新窗口');
      if (name) {
        var id = AppWindowManager.addWindow(name);
        _expandedWindows[id] = true;
      }
    });
    document.getElementById('btn-remove-window')?.addEventListener('click', async function() {
      var w = AppWindowManager.getSelectedWindow();
      if (w && await _confirmDialog('确定删除窗口 "' + w.name + '"?')) AppWindowManager.removeWindow(w.id);
    });
    document.getElementById('btn-run-test')?.addEventListener('click', _runTest);
    document.getElementById('btn-stop-test')?.addEventListener('click', _stopTest);
    document.getElementById('btn-clear-console')?.addEventListener('click', function() { document.getElementById('console-output').innerHTML = ''; });

    document.getElementById('app-title-input')?.addEventListener('change', function(e) { AppWindowManager.updateAppConfig('title', e.target.value); });
    document.getElementById('app-start-window')?.addEventListener('change', function(e) { AppWindowManager.setStartWindow(e.target.value); });

    // 应用图标上传
    document.getElementById('app-icon-input')?.addEventListener('change', async function(e) {
      var file = e.target.files[0];
      if (!file) return;
      try {
        var reader = new FileReader();
        reader.onload = function(ev) {
          AppWindowManager.updateAppConfig('icon', ev.target.result); // base64
          _logConsole('应用图标已更新', 'info');
        };
        reader.readAsDataURL(file);
      } catch(err) { _logConsole('图标加载失败: ' + err.message, 'error'); }
    });

    // 积木数据同步回调（支持 componentId）
    window.api.onAppBlocksUpdated(function(wid, compId, bd) {
      if (compId) {
        AppWindowManager.setComponentBlocks(wid, compId, bd);
      } else {
        AppWindowManager.setWindowBlocks(wid, bd);
      }
      _logConsole('积木数据已更新' + (compId ? ' (组件)' : ' (窗口)'), 'info');
    });

    window.api.onAppBlocksWindowClosed(function() { _logConsole('积木编辑器已关闭','info'); });

    if (window.api.onRequestAppBlocks) {
      window.api.onRequestAppBlocks(function(reqWindowId, reqCompId) {
        var blocks;
        if (reqCompId) {
          blocks = AppWindowManager.getComponentBlocks(reqWindowId, reqCompId);
        } else {
          blocks = AppWindowManager.getWindowBlocks(reqWindowId);
        }
        window.api.appBlocksResponse(blocks || {});
      });
    }

    // 测试窗口日志回传
    if (window.api.onAppTestLog) {
      window.api.onAppTestLog(function(msg, type) { _logConsole(msg, type); });
    }
    if (window.api.onAppTestClosed) {
      window.api.onAppTestClosed(function() { _stopTest(); });
    }

    // 全局点击：关闭菜单 + 隐藏右键菜单
    document.addEventListener('click', function() {
      if (typeof closeAllMenus === 'function') closeAllMenus();
      _hideContextMenu();
    });
    document.addEventListener('contextmenu', function(e) {
      if (!e.target.closest('#windows-tree')) _hideContextMenu();
    });

    document.addEventListener('keydown', function(e) {
      // Ctrl+S 保存
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); _saveProject(); }
      // F5 运行，Shift+F5 停止
      if (e.key === 'F5' && !e.shiftKey) { e.preventDefault(); _runTest(); }
      if (e.shiftKey && e.key === 'F5') { e.preventDefault(); _stopTest(); }
      // Ctrl+Z 撤销，Ctrl+Y 重做
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (AppWindowManager.undo()) _logConsole('已撤销', 'info');
      }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        if (AppWindowManager.redo()) _logConsole('已重做', 'info');
      }
      // Ctrl+C 复制，Ctrl+V 粘贴
      if (e.ctrlKey && e.key === 'c') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (AppWindowManager.copySelected()) _logConsole('已复制', 'info');
        }
      }
      if (e.ctrlKey && e.key === 'v') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          if (AppWindowManager.paste()) _logConsole('已粘贴', 'info');
        }
      }
      // Delete 删除选中组件
      if (e.key === 'Delete') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          var comp = AppWindowManager.getSelectedComponent();
          var win = AppWindowManager.getSelectedWindow();
          if (comp && win) {
            e.preventDefault();
            AppWindowManager.removeComponent(win.id, comp.id);
            _logConsole('已删除组件: ' + comp.name, 'info');
          }
        }
      }
    });

    // ========== 可视化编辑器事件 ==========
    // 网格/吸附切换
    document.getElementById('btn-toggle-grid')?.addEventListener('click', function() {
      _viz.gridOn = !_viz.gridOn;
      this.classList.toggle('snap-active', _viz.gridOn);
      _renderVisualCanvas();
    });
    document.getElementById('btn-toggle-snap')?.addEventListener('click', function() {
      _viz.snapOn = !_viz.snapOn;
      this.classList.toggle('snap-active', _viz.snapOn);
      _renderVisualCanvas();
    });

    // 缩放按钮
    document.getElementById('btn-zoom-in')?.addEventListener('click', _zoomIn);
    document.getElementById('btn-zoom-out')?.addEventListener('click', _zoomOut);
    document.getElementById('btn-zoom-fit')?.addEventListener('click', _zoomFit);

    // 鼠标滚轮缩放
    document.getElementById('visual-canvas')?.addEventListener('wheel', function(e) {
      if (e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) _zoomIn();
        else _zoomOut();
      }
    }, { passive: false });

    // 可视化画布拖拽/点击
    document.getElementById('visual-window-frame')?.addEventListener('mousedown', function(e) {
      var target = e.target;
      var comp = target.closest('.visual-comp');
      var handle = target.closest('.resize-handle');

      if (handle && comp) {
        // 缩放手柄拖拽
        _startResizeDrag(e, comp.dataset.compId, handle.dataset.dir);
      } else if (comp) {
        // 组件拖拽移动
        _startCompDrag(e, comp.dataset.compId);
      } else {
        // 点击空白区域取消选择
        AppWindowManager.selectComponent(null);
      }
    });

    // 工具栏拖拽添加
    document.querySelectorAll('#visual-toolbar .toolbar-tool').forEach(function(tool) {
      tool.addEventListener('mousedown', function(e) {
        _startToolbarDrag(e, tool.dataset.type);
      });
    });
  }

  // ========== 保存项目 ==========
  async function _saveProject() {
    try {
      var data = AppWindowManager.toJSON();
      var config = {
        name: document.getElementById('project-name').textContent,
        version: '1.0', mode: 'app', appType: _appType,
        appConfig: data.appConfig, appWindows: data.windows,
        created: new Date().toISOString(),
      };
      await window.api.writeFile(_projectPath + '/project.json', JSON.stringify(config, null, 2));
      _logConsole('项目已保存','info');
    } catch (e) { _logConsole('保存失败: ' + e.message,'error'); }
  }

  // ========== 测试运行 ==========
  async function _runTest() {
    if (_isRunning) return;
    _isRunning = true;
    document.getElementById('btn-run-test').disabled = true;
    document.getElementById('btn-stop-test').disabled = false;
    _logConsole('启动测试运行...','info');

    try {
      var sw = AppWindowManager.getAppConfig().startWindow;
      var win = AppWindowManager.getWindow(sw);
      if (!win) { _logConsole('未找到启动窗口','error'); _stopTest(); return; }

      await _saveProject();

      var appCfg = AppWindowManager.getAppConfig();
      var appMode = appCfg.appType || 'win';

      // 收集所有窗口的积木脚本（合并窗口脚本和组件脚本，标记所属组件）
      var allWindows = AppWindowManager.getWindows();
      var allScripts = {};
      allWindows.forEach(function(w) {
        // 合并窗口级脚本（不属于任何组件）
        if (w.blocksData && Object.keys(w.blocksData).length > 0) {
          Object.keys(w.blocksData).forEach(function(bid) {
            var b = Object.assign({}, w.blocksData[bid]);
            b._ownerComponent = null; // 窗口级脚本
            allScripts[bid] = b;
          });
        }
        // 合并组件级脚本，标记所属组件
        (w.components || []).forEach(function(comp) {
          if (comp.blocksData && Object.keys(comp.blocksData).length > 0) {
            Object.keys(comp.blocksData).forEach(function(bid) {
              var b = Object.assign({}, comp.blocksData[bid]);
              b._ownerComponent = comp.name; // 标记所属组件名
              allScripts[bid] = b;
            });
          }
        });
      });

      if (window.api.appRunTest) {
        await window.api.appRunTest({
          title: win.title || win.name,
          name: win.name,
          width: win.width || 800,
          height: win.height || 600,
          components: win.components || [],
          blocksData: allScripts,
          appConfig: appCfg,
          appMode: appMode,
          htmlContent: win.htmlContent || '',
          allWindows: allWindows,
          // 窗口全局样式属性
          backgroundColor: win.backgroundColor || '#f0f0f0',
          customCSS: win.customCSS || '',
          overflow: win.overflow || 'auto',
          padding: win.padding || 0,
        });
        _logConsole('测试窗口已打开 (' + appMode + ' 模式)', 'info');
      } else {
        _logConsole('IPC 不可用，无法启动测试窗口', 'error');
        _stopTest();
      }
    } catch (e) {
      _logConsole('运行失败: ' + e.message, 'error');
      _stopTest();
    }
  }

  function _stopTest() {
    _isRunning = false;
    document.getElementById('btn-run-test').disabled = false;
    document.getElementById('btn-stop-test').disabled = true;
    if (window.api.appStopTest) window.api.appStopTest();
    _logConsole('测试已停止','info');
  }

  function _logConsole(message, type) {
    type = type || 'log';
    var c = document.getElementById('console-output');
    if (!c) return;
    var line = document.createElement('div');
    line.className = 'console-line ' + type;
    line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
    c.appendChild(line);
    c.scrollTop = c.scrollHeight;
  }

  // ========== 导出对话框 ==========
  async function _showExportDialog() {
    var ov = document.createElement('div');
    ov.className = 'custom-prompt-overlay';
    ov.innerHTML =
      '<div class="custom-prompt-box" style="max-width:360px;">' +
        '<div class="custom-prompt-title">导出项目</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px;margin:16px 0;">' +
          '<button class="export-option" data-opt="zip" style="padding:12px;border:1px solid var(--border);border-radius:6px;cursor:pointer;text-align:left;background:transparent;color:var(--text-primary);">' +
            '<div style="font-size:14px;font-weight:600;">📦 导出项目压缩包 (.zip)</div>' +
            '<div style="font-size:11px;opacity:0.6;margin-top:4px;">包含所有源码和资源，可在 Objector 中重新打开</div>' +
          '</button>' +
          '<button class="export-option" data-opt="html" style="padding:12px;border:1px solid var(--border);border-radius:6px;cursor:pointer;text-align:left;background:transparent;color:var(--text-primary);">' +
            '<div style="font-size:14px;font-weight:600;">🌐 导出为 HTML 网页</div>' +
            '<div style="font-size:11px;opacity:0.6;margin-top:4px;">生成独立 HTML 文件，可在浏览器中运行</div>' +
          '</button>' +
          '<button class="export-option" data-opt="exe" style="padding:12px;border:1px solid var(--border);border-radius:6px;cursor:pointer;text-align:left;background:transparent;color:var(--text-primary);">' +
            '<div style="font-size:14px;font-weight:600;">💻 导出为 Windows EXE</div>' +
            '<div style="font-size:11px;opacity:0.6;margin-top:4px;">生成独立可执行文件（需要 electron-packager）</div>' +
          '</button>' +
        '</div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
          '<button class="tb-btn" id="export-cancel">取消</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelectorAll('.export-option').forEach(function(btn) {
      btn.addEventListener('click', function() { ov.remove(); _doExport(btn.dataset.opt); });
    });
    ov.querySelector('#export-cancel').addEventListener('click', function() { ov.remove(); });
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
  }

  // ========== EXE 平台选择对话框 ==========
  function _showExePlatformDialog() {
    return new Promise(function(resolve) {
      var ov = document.createElement('div');
      ov.className = 'custom-prompt-overlay';
      ov.innerHTML =
        '<div class="custom-prompt-box" style="max-width:400px;">' +
          '<div class="custom-prompt-title">导出可执行文件</div>' +
          '<div style="margin:12px 0;">' +
            '<label style="display:block;margin-bottom:8px;font-size:12px;color:var(--text-secondary);">目标平台</label>' +
            '<div style="display:flex;gap:8px;">' +
              '<label style="flex:1;display:flex;align-items:center;gap:6px;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px;color:var(--text-primary);">' +
                '<input type="radio" name="exe-platform" value="win32" checked style="accent-color:var(--accent);" /> Windows' +
              '</label>' +
              '<label style="flex:1;display:flex;align-items:center;gap:6px;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px;color:var(--text-primary);">' +
                '<input type="radio" name="exe-platform" value="darwin" style="accent-color:var(--accent);" /> macOS' +
              '</label>' +
              '<label style="flex:1;display:flex;align-items:center;gap:6px;padding:10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px;color:var(--text-primary);">' +
                '<input type="radio" name="exe-platform" value="linux" style="accent-color:var(--accent);" /> Linux' +
              '</label>' +
            '</div>' +
          '</div>' +
          '<div style="margin:12px 0;">' +
            '<label style="display:block;margin-bottom:8px;font-size:12px;color:var(--text-secondary);">打包方式</label>' +
            '<div style="display:flex;flex-direction:column;gap:6px;">' +
              '<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px;color:var(--text-primary);">' +
                '<input type="radio" name="exe-package" value="zip" checked style="accent-color:var(--accent);" />' +
                '<span>压缩包（免安装，解压即用）</span>' +
              '</label>' +
              '<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:13px;color:var(--text-primary);">' +
                '<input type="radio" name="exe-package" value="installer" style="accent-color:var(--accent);" />' +
                '<span>安装程序（带安装向导）</span>' +
              '</label>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">' +
            '<button class="tb-btn" id="exe-platform-cancel">取消</button>' +
            '<button class="tb-btn tb-run" id="exe-platform-confirm">导出</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(ov);
      ov.querySelector('#exe-platform-cancel').addEventListener('click', function() { ov.remove(); resolve(null); });
      ov.querySelector('#exe-platform-confirm').addEventListener('click', function() {
        var platform = ov.querySelector('input[name="exe-platform"]:checked')?.value || 'win32';
        var pkg = ov.querySelector('input[name="exe-package"]:checked')?.value || 'zip';
        ov.remove();
        resolve({ targetPlatform: platform, packageType: pkg });
      });
      ov.addEventListener('click', function(e) { if (e.target === ov) { ov.remove(); resolve(null); } });
    });
  }

  async function _doExport(type) {
    try {
      await _saveProject();
      if (type === 'zip') {
        var savePath = await window.api.saveFileDialog(
          (document.getElementById('project-name').textContent || 'APP项目') + '.zip',
          [{ name: 'ZIP 压缩包', extensions: ['zip'] }]
        );
        if (!savePath) return;
        _logConsole('正在导出项目压缩包...', 'info');
        // 使用主进程的 zip 能力
        if (window.api.buildExe) {
          await window.api.buildExe({ type: 'zip-project', srcPath: _projectPath, outPath: savePath });
        } else {
          // 前端简单导出：打包 project.json
          _logConsole('导出功能需要主进程支持，请检查 main.js 的 build-exe handler', 'error');
        }
        _logConsole('已导出: ' + savePath, 'info');
      } else if (type === 'html') {
        var savePath = await window.api.saveFileDialog(
          (document.getElementById('project-name').textContent || 'APP项目') + '.html',
          [{ name: 'HTML 文件', extensions: ['html'] }]
        );
        if (!savePath) return;
        _logConsole('正在导出 HTML...', 'info');
        var html = _generateExportHtml();
        await window.api.writeFile(savePath, html);
        _logConsole('已导出 HTML: ' + savePath, 'info');
      } else if (type === 'exe') {
        // EXE 导出：平台选择 + 依赖检测 + 自动下载 + 打包
        var platformResult = await _showExePlatformDialog();
        if (!platformResult) return; // 用户取消
        var targetPlatform = platformResult.targetPlatform;
        var packageType = platformResult.packageType;
        var projectName = document.getElementById('project-name').textContent || 'APP项目';
        var safeName = projectName.replace(/[^a-zA-Z0-9\u4e00-\u9fff_\-]/g, '_');

        _logConsole('正在准备导出环境...', 'info');

        // 1. 检测依赖
        var depsOk = false;
        if (window.api.checkExportDeps) {
          try {
            var deps = await window.api.checkExportDeps({ targetPlatform: targetPlatform, packageType: packageType });
            depsOk = deps.available;
            _logConsole('依赖检测: ' + (depsOk ? '全部就绪' : '缺失 ' + deps.missing.join(', ')), depsOk ? 'info' : 'warn');
          } catch (e) {
            _logConsole('依赖检测失败: ' + e.message, 'warn');
          }
        }

        // 2. 下载缺失依赖
        if (!depsOk && window.api.downloadExportDeps) {
          var progressDialog = document.getElementById('export-progress-dialog');
          var progressStatus = document.getElementById('export-progress-status');
          var progressBar = document.getElementById('export-progress-bar');
          var progressDetail = document.getElementById('export-progress-detail');
          if (progressDialog) progressDialog.classList.remove('hidden');
          if (progressStatus) progressStatus.textContent = '准备导出环境';

          if (window.api.onExportDepsProgress) {
            window.api.onExportDepsProgress(function(data) {
              if (progressStatus) progressStatus.textContent = data.message || data.stage;
              if (progressBar) progressBar.style.width = (data.percent || 0) + '%';
              if (progressDetail) {
                if (data.transferred && data.total) {
                  progressDetail.textContent = (data.transferred / 1048576).toFixed(1) + ' / ' + (data.total / 1048576).toFixed(1) + ' MB';
                } else {
                  progressDetail.textContent = '';
                }
              }
            });
          }

          try {
            var dlResult = await window.api.downloadExportDeps({ targetPlatform: targetPlatform, packageType: packageType });
            if (!dlResult.success) {
              _logConsole('下载失败: ' + dlResult.error, 'error');
              if (progressDialog) progressDialog.classList.add('hidden');
              return;
            }
          } catch (dlErr) {
            _logConsole('下载失败: ' + dlErr.message, 'error');
            if (progressDialog) progressDialog.classList.add('hidden');
            return;
          }
          if (progressDialog) progressDialog.classList.add('hidden');
          _logConsole('下载完成', 'info');
        }

        // 3. 生成 HTML 并打包
        _logConsole('正在生成可执行文件，请稍候...', 'info');
        var html = _generateExportHtml();

        // 先获取文件信息并让用户选择保存路径（避免打包完成后返回超大 base64）
        var fileExt = 'zip', filterName = 'ZIP 压缩包', defaultFileName = safeName + '.zip';
        if (window.api.getExportFileInfo) {
          try {
            var fileInfo = await window.api.getExportFileInfo({ targetPlatform: targetPlatform, packageType: packageType, projectName: projectName });
            fileExt = fileInfo.fileExt || 'zip';
            filterName = fileInfo.filterName || 'ZIP 压缩包';
            defaultFileName = fileInfo.safeFileName || (safeName + '.' + fileExt);
          } catch(e) { _logConsole('获取文件信息失败: ' + e.message, 'warn'); }
        }
        var outPath = null;
        if (window.api.saveFileDialog) {
          outPath = await window.api.saveFileDialog(defaultFileName, [{ name: filterName, extensions: [fileExt] }]);
          if (!outPath) { _logConsole('用户取消导出', 'info'); return; }
        }

        if (window.api.onExportDepsProgress) {
          window.api.onExportDepsProgress(function(data) {
            if (data.message) _logConsole(data.message, 'info');
          });
        }

        // 先将 HTML 写入临时文件（直接用 Node.js fs，绕过 IPC 避免大内容序列化超时）
        var tempHtmlPath = null;
        if (window.api.writeFileTempLocal) {
          tempHtmlPath = await window.api.writeFileTempLocal('export-html-' + Date.now() + '.html', html);
        } else if (window.api.writeFileTemp) {
          tempHtmlPath = await window.api.writeFileTemp('export-html-' + Date.now() + '.html', html);
        }
        if (!tempHtmlPath) { _logConsole('写入临时文件失败', 'error'); return; }
        _logConsole('HTML 已写入临时文件: ' + tempHtmlPath, 'info');

        try {
          var result = await window.api.buildExe({
            htmlPath: tempHtmlPath || null,
            projectName: projectName,
            iconPath: null,
            outPath: outPath,
            targetPlatform: targetPlatform,
            packageType: packageType,
            installPathType: 'user-select',
          });
          if (result.error) {
            _logConsole('打包失败: ' + result.error, 'error');
            return;
          }
          if (result.success && result.savedPath) {
            _logConsole('已导出: ' + result.savedPath, 'info');
            return;
          }
          // 兼容旧流程
          if (result.fileBase64 && outPath) {
            var wr = await window.api.writeFileBinary(outPath, result.fileBase64);
            if (wr && wr.error) { _logConsole('写入失败: ' + wr.error, 'error'); return; }
            _logConsole('已导出: ' + outPath, 'info');
          }
        } catch(e) {
          _logConsole('打包失败: ' + e.message, 'error');
        }
      }
    } catch(e) {
      _logConsole('导出失败: ' + e.message, 'error');
    }
  }

  function _generateExportHtml() {
    var config = AppWindowManager.toJSON();
    var wins = config.windows || [];
    var sw = config.appConfig.startWindow;
    var startWin = wins.find(function(w){ return w.id === sw; }) || wins[0];
    var html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n' +
      '<title>' + _escHtml(config.appConfig.title || 'APP') + '</title>\n' +
      '<style>\n* { box-sizing: border-box; margin: 0; padding: 0; }\n' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #1e1e2e; color: #cdd6f4; }\n' +
      '.app-window { position: relative; width: ' + (startWin.width||800) + 'px; height: ' + (startWin.height||600) + 'px; margin: 20px auto; background: #313244; border-radius: 8px; overflow: hidden; }\n' +
      '.comp { position: absolute; font-size: 14px; }\n' +
      '.comp-button { padding: 8px 16px; background: #3b82f6; color: #fff; border: none; border-radius: 6px; cursor: pointer; }\n' +
      '.comp-input { padding: 8px; background: #45475a; color: #cdd6f4; border: 1px solid #585b70; border-radius: 4px; }\n' +
      '.comp-textarea { padding: 8px; background: #45475a; color: #cdd6f4; border: 1px solid #585b70; border-radius: 4px; resize: vertical; }\n' +
      '.comp-label { color: #cdd6f4; }\n' +
      '.comp-list { background: #45475a; border-radius: 4px; overflow: auto; }\n' +
      '.comp-list-item { padding: 6px 12px; border-bottom: 1px solid #585b70; }\n' +
      '</style>\n</head>\n<body>\n<div class="app-window" id="main-window">\n';
    (startWin.components || []).forEach(function(comp) {
      var style = 'left:' + (comp.x||0) + 'px;top:' + (comp.y||0) + 'px;width:' + (comp.width||120) + 'px;';
      if (comp.bgColor) style += 'background:' + comp.bgColor + ';';
      if (comp.textColor) style += 'color:' + comp.textColor + ';';
      if (comp.fontSize) style += 'font-size:' + comp.fontSize + 'px;';
      if (comp.type === 'button')
        html += '<button class="comp comp-button" style="' + style + 'height:' + (comp.height||32) + 'px;">' + _escHtml(comp.text||comp.name) + '</button>\n';
      else if (comp.type === 'input')
        html += '<input class="comp comp-input" style="' + style + 'height:' + (comp.height||32) + 'px;" placeholder="' + _escHtml(comp.defaultValue||'') + '">\n';
      else if (comp.type === 'textarea')
        html += '<textarea class="comp comp-textarea" style="' + style + 'height:' + (comp.height||100) + 'px;">' + _escHtml(comp.defaultValue||'') + '</textarea>\n';
      else if (comp.type === 'label')
        html += '<div class="comp comp-label" style="' + style + 'height:' + (comp.height||32) + 'px;">' + _escHtml(comp.text||comp.name) + '</div>\n';
      else if (comp.type === 'list')
        html += '<div class="comp comp-list" style="' + style + 'height:' + (comp.height||150) + 'px;"><div class="comp-list-item">示例项目</div></div>\n';
    });
    html += '</div>\n</body>\n</html>';
    return html;
  }

  // ========== 帮助 ==========
  function _openHelp() {
    if (window.api.openExternal) {
      window.api.openExternal('https://docs.objector.dev/app-editor');
    } else {
      _logConsole('APP开发指南: https://docs.objector.dev/app-editor', 'info');
    }
  }

  // 组件属性参考
  function _showPropReference() {
    var win = AppWindowManager.getSelectedWindow();
    if (!win) { _logConsole('请先选择一个窗口', 'warn'); return; }
    var comps = win.components || [];
    if (comps.length === 0) { _logConsole('当前窗口没有组件', 'info'); return; }

    // 通用属性
    var commonProps = [
      { name: 'text', desc: '文本内容', type: 'string' },
      { name: 'value', desc: '值', type: 'any' },
      { name: 'x', desc: 'X 坐标', type: 'number' },
      { name: 'y', desc: 'Y 坐标', type: 'number' },
      { name: 'width', desc: '宽度', type: 'number' },
      { name: 'height', desc: '高度', type: 'number' },
      { name: 'visible', desc: '是否可见', type: 'boolean' },
      { name: 'enabled', desc: '是否启用', type: 'boolean' },
      { name: 'bgColor', desc: '背景色', type: 'string (颜色)' },
      { name: 'textColor', desc: '文字色', type: 'string (颜色)' },
      { name: 'fontSize', desc: '字号', type: 'number' },
      { name: 'border', desc: '边框样式', type: 'string (default/none/rounded/circle)' },
      { name: 'name', desc: '组件名称', type: 'string (只读)' },
      { name: 'type', desc: '组件类型', type: 'string (只读)' },
    ];

    // 特殊属性
    var specialProps = {
      input: [{ name: 'defaultValue', desc: '默认值', type: 'string' }],
      textarea: [{ name: 'defaultValue', desc: '默认值', type: 'string' }],
      image: [{ name: 'src', desc: '图片路径', type: 'string' }],
      dropdown: [{ name: 'items', desc: '选项列表', type: 'array' }],
      list: [{ name: 'items', desc: '列表项', type: 'array' }],
      slider: [{ name: 'min', desc: '最小值', type: 'number' }, { name: 'max', desc: '最大值', type: 'number' }],
      progress: [{ name: 'min', desc: '最小值', type: 'number' }, { name: 'max', desc: '最大值', type: 'number' }],
    };

    var html = '<div class="custom-prompt-overlay" id="prop-ref-overlay"><div class="custom-prompt-box" style="max-width:600px;max-height:500px;overflow-y:auto;">' +
      '<div class="custom-prompt-title">组件属性参考 - ' + _escHtml(win.name) + '</div>' +
      '<div style="font-size:11px;color:#888;margin:8px 0;">积木用法: <code>设置 [组件名] 的 [属性] = [值]</code></div>';

    comps.forEach(function(comp) {
      var props = commonProps.slice();
      if (specialProps[comp.type]) props = props.concat(specialProps[comp.type]);
      html += '<div style="margin:12px 0;padding:10px;background:var(--bg-tertiary,#11111b);border-radius:6px;">' +
        '<div style="font-weight:600;margin-bottom:6px;">' + (comp.type === 'button' ? '🔘' : comp.type === 'input' ? '📝' : comp.type === 'label' ? '🏷️' : comp.type === 'list' ? '📋' : comp.type === 'image' ? '🖼️' : comp.type === 'checkbox' ? '☑️' : comp.type === 'radio' ? '⚪' : comp.type === 'dropdown' ? '📃' : comp.type === 'slider' ? '🎚️' : comp.type === 'progress' ? '📊' : '📦') + ' ' + _escHtml(comp.name) + ' <span style="font-weight:normal;color:#888;">(' + comp.type + ')</span></div>' +
        '<table style="width:100%;font-size:11px;border-collapse:collapse;"><tr style="color:#888;"><th style="text-align:left;padding:3px 6px;border-bottom:1px solid #444;">属性</th><th style="text-align:left;padding:3px 6px;border-bottom:1px solid #444;">类型</th><th style="text-align:left;padding:3px 6px;border-bottom:1px solid #444;">说明</th></tr>';
      props.forEach(function(p) {
        html += '<tr><td style="padding:3px 6px;"><code>' + p.name + '</code></td><td style="padding:3px 6px;color:#a6e3a1;">' + p.type + '</td><td style="padding:3px 6px;">' + p.desc + '</td></tr>';
      });
      html += '</table></div>';
    });

    html += '<div style="display:flex;justify-content:flex-end;margin-top:16px;"><button class="tb-btn" id="prop-ref-close">关闭</button></div></div></div>';

    var container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container.firstElementChild);

    document.getElementById('prop-ref-close')?.addEventListener('click', function() {
      document.getElementById('prop-ref-overlay')?.remove();
    });
    document.getElementById('prop-ref-overlay')?.addEventListener('click', function(e) {
      if (e.target.id === 'prop-ref-overlay') e.target.remove();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { saveProject: _saveProject, logConsole: _logConsole };
})();
