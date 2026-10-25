/**
 * APP 窗口管理器 - 管理应用窗口和组件的数据结构
 * 支持撤销/重做、剪贴板、组件拖拽同步
 */
const AppWindowManager = (function() {
  // 窗口数据
  let _windows = [];
  let _selectedWindowId = null;
  let _selectedComponentId = null;
  
  // 应用配置
  let _appConfig = {
    title: '我的应用',
    appType: 'win',  // win | html | cli | console
    startWindow: null,
    icon: '',
  };
  
  // 变更回调
  let _onChangeCallback = null;
  
  // ========== 撤销/重做 ==========
  const MAX_HISTORY = 50;
  let _undoStack = [];
  let _redoStack = [];
  let _isUndoRedo = false;  // 防止撤销操作本身被记录
  
  function _snapshot() {
    return JSON.stringify({
      appConfig: { ..._appConfig },
      windows: _windows.map(w => ({ ...w, components: w.components.map(c => ({ ...c })) })),
    });
  }
  
  function _pushUndo() {
    if (_isUndoRedo) return;
    _undoStack.push(_snapshot());
    if (_undoStack.length > MAX_HISTORY) _undoStack.shift();
    _redoStack = [];
  }
  
  function undo() {
    if (_undoStack.length === 0) return false;
    _isUndoRedo = true;
    _redoStack.push(_snapshot());
    var state = JSON.parse(_undoStack.pop());
    _appConfig = state.appConfig;
    _windows = state.windows;
    _selectedComponentId = null;
    _isUndoRedo = false;
    _notifyChange();
    return true;
  }
  
  function redo() {
    if (_redoStack.length === 0) return false;
    _isUndoRedo = true;
    _undoStack.push(_snapshot());
    var state = JSON.parse(_redoStack.pop());
    _appConfig = state.appConfig;
    _windows = state.windows;
    _selectedComponentId = null;
    _isUndoRedo = false;
    _notifyChange();
    return true;
  }
  
  function canUndo() { return _undoStack.length > 0; }
  function canRedo() { return _redoStack.length > 0; }
  
  // ========== 剪贴板 ==========
  let _clipboard = null;  // { type: 'component'|'window', data: {...} }
  
  function copySelected() {
    if (_selectedComponentId) {
      var comp = getSelectedComponent();
      if (comp) {
        _clipboard = { type: 'component', data: JSON.parse(JSON.stringify(comp)) };
        return true;
      }
    } else if (_selectedWindowId) {
      var win = getSelectedWindow();
      if (win) {
        _clipboard = { type: 'window', data: JSON.parse(JSON.stringify(win)) };
        return true;
      }
    }
    return false;
  }
  
  function paste(offsetX, offsetY) {
    if (!_clipboard) return null;
    offsetX = offsetX || 20;
    offsetY = offsetY || 20;
    _pushUndo();
    if (_clipboard.type === 'component' && _selectedWindowId) {
      var win = getWindow(_selectedWindowId);
      if (!win) return null;
      var newComp = JSON.parse(JSON.stringify(_clipboard.data));
      newComp.id = _generateId('comp');
      newComp.name = (newComp.name || '') + ' (副本)';
      newComp.x = (newComp.x || 10) + offsetX;
      newComp.y = (newComp.y || 10) + offsetY;
      win.components.push(newComp);
      _selectedComponentId = newComp.id;
      _notifyChange();
      return newComp.id;
    }
    return null;
  }
  
  function hasClipboard() { return _clipboard !== null; }
  
  /**
   * 初始化窗口管理器
   */
  function init(config) {
    if (config) {
      _appConfig = { ..._appConfig, ...config };
      _windows = config.windows || [];
      _selectedWindowId = config.startWindow || (_windows.length > 0 ? _windows[0].id : null);
    }
    _notifyChange();
  }
  
  /**
   * 设置变更回调
   */
  function onChange(callback) {
    _onChangeCallback = callback;
  }
  
  /**
   * 触发变更通知
   */
  function _notifyChange() {
    if (_onChangeCallback) {
      _onChangeCallback();
    }
  }
  
  /**
   * 生成唯一ID
   */
  function _generateId(prefix) {
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
  
  // ========== 窗口操作 ==========
  
  /**
   * 添加新窗口
   */
  function addWindow(name) {
    _pushUndo();
    const id = _generateId('window');
    const newWindow = {
      id: id,
      name: name || '新窗口',
      title: name || '新窗口',
      width: 800,
      height: 600,
      components: [],
      blocksData: {},
    };
    _windows.push(newWindow);
    
    // 如果是第一个窗口，自动选中
    if (_windows.length === 1) {
      _selectedWindowId = id;
      _appConfig.startWindow = id;
    }
    
    _notifyChange();
    return id;
  }
  
  /**
   * 删除窗口
   */
  function removeWindow(windowId) {
    _pushUndo();
    const index = _windows.findIndex(w => w.id === windowId);
    if (index === -1) return false;
    
    _windows.splice(index, 1);
    
    // 如果删除的是选中的窗口，选中第一个
    if (_selectedWindowId === windowId) {
      _selectedWindowId = _windows.length > 0 ? _windows[0].id : null;
      _selectedComponentId = null;
    }
    
    // 如果删除的是启动窗口，更新启动窗口
    if (_appConfig.startWindow === windowId && _windows.length > 0) {
      _appConfig.startWindow = _windows[0].id;
    }
    
    _notifyChange();
    return true;
  }
  
  /**
   * 获取所有窗口
   */
  function getWindows() {
    return _windows;
  }
  
  /**
   * 获取指定窗口
   */
  function getWindow(windowId) {
    return _windows.find(w => w.id === windowId);
  }
  
  /**
   * 选中窗口
   */
  function selectWindow(windowId) {
    if (_windows.find(w => w.id === windowId)) {
      _selectedWindowId = windowId;
      _selectedComponentId = null;  // 切换窗口时清除组件选择
      _notifyChange();
      return true;
    }
    return false;
  }
  
  /**
   * 获取选中的窗口
   */
  function getSelectedWindow() {
    return _windows.find(w => w.id === _selectedWindowId);
  }
  
  /**
   * 获取选中的窗口ID
   */
  function getSelectedWindowId() {
    return _selectedWindowId;
  }
  
  /**
   * 更新窗口属性
   */
  function updateWindowProp(windowId, key, value) {
    const win = getWindow(windowId);
    if (win) {
      _pushUndo();
      win[key] = value;
      _notifyChange();
      return true;
    }
    return false;
  }
  
  // ========== 组件操作 ==========
  
  /**
   * 添加组件到窗口
   */
  function addComponent(windowId, componentType, props) {
    const win = getWindow(windowId);
    if (!win) return null;
    _pushUndo();
    const id = _generateId('comp');
    // 默认样式
    var defaults = {
      x: 10, y: 10, width: 120, height: 32,
      bgColor: '', textColor: '', fontSize: 14, border: 'default',
      text: '', defaultValue: '', items: [], src: '',
    };
    // 组件类型特有默认值
    if (componentType === 'list') defaults.height = 150;
    if (componentType === 'textarea') { defaults.width = 200; defaults.height = 100; }
    if (componentType === 'checkbox' || componentType === 'radio') { defaults.width = 140; defaults.height = 24; }
    if (componentType === 'slider') defaults.width = 160;
    if (componentType === 'progress') { defaults.width = 160; defaults.value = 0; }
    if (componentType === 'dropdown') defaults.items = ['选项1', '选项2', '选项3'];
    const component = {
      id: id,
      type: componentType,
      name: props.name || componentType,
      ...defaults,
      ...props,
    };
    
    win.components.push(component);
    _notifyChange();
    return id;
  }
  
  /**
   * 删除组件
   */
  function removeComponent(windowId, componentId) {
    const win = getWindow(windowId);
    if (!win) return false;
    const index = win.components.findIndex(c => c.id === componentId);
    if (index === -1) return false;
    _pushUndo();
    win.components.splice(index, 1);
    
    // 如果删除的是选中的组件，清除选择
    if (_selectedComponentId === componentId) {
      _selectedComponentId = null;
    }
    
    _notifyChange();
    return true;
  }
  
  /**
   * 选中组件
   */
  function selectComponent(componentId) {
    _selectedComponentId = componentId;
    _notifyChange();
  }
  
  /**
   * 获取选中的组件
   */
  function getSelectedComponent() {
    const win = getSelectedWindow();
    if (!win) return null;
    return win.components.find(c => c.id === _selectedComponentId);
  }
  
  /**
   * 获取选中的组件ID
   */
  function getSelectedComponentId() {
    return _selectedComponentId;
  }
  
  /**
   * 更新组件属性
   */
  function updateComponentProp(windowId, componentId, key, value) {
    const win = getWindow(windowId);
    if (!win) return false;
    const comp = win.components.find(c => c.id === componentId);
    if (!comp) return false;
    _pushUndo();
    comp[key] = value;
    _notifyChange();
    return true;
  }
  
  // ========== 积木数据操作 ==========
  
  /**
   * 设置窗口的积木数据
   */
  function setWindowBlocks(windowId, blocksData) {
    const win = getWindow(windowId);
    if (win) {
      win.blocksData = blocksData;
      _notifyChange();
      return true;
    }
    return false;
  }
  
  /**
   * 获取窗口的积木数据
   */
  function getWindowBlocks(windowId) {
    const win = getWindow(windowId);
    return win ? win.blocksData : null;
  }
  
  /**
   * 设置组件的积木数据
   */
  function setComponentBlocks(windowId, componentId, blocksData) {
    const win = getWindow(windowId);
    if (!win) return false;
    const comp = win.components.find(c => c.id === componentId);
    if (!comp) return false;
    comp.blocksData = blocksData;
    _notifyChange();
    return true;
  }
  
  /**
   * 获取组件的积木数据
   */
  function getComponentBlocks(windowId, componentId) {
    const win = getWindow(windowId);
    if (!win) return null;
    const comp = win.components.find(c => c.id === componentId);
    return comp ? comp.blocksData : null;
  }
  
  // ========== 应用配置操作 ==========
  
  /**
   * 获取应用配置
   */
  function getAppConfig() {
    return _appConfig;
  }
  
  /**
   * 更新应用配置
   */
  function updateAppConfig(key, value) {
    _pushUndo();
    _appConfig[key] = value;
    _notifyChange();
  }
  
  /**
   * 设置启动窗口
   */
  function setStartWindow(windowId) {
    if (_windows.find(w => w.id === windowId)) {
      _appConfig.startWindow = windowId;
      _notifyChange();
      return true;
    }
    return false;
  }
  
  // ========== 序列化 ==========
  
  /**
   * 导出为JSON
   */
  function toJSON() {
    return {
      appConfig: { ..._appConfig },
      windows: _windows.map(w => ({
        ...w,
        components: w.components.map(c => ({ ...c })),
        blocksData: { ...w.blocksData },
      })),
    };
  }
  
  /**
   * 从JSON导入
   */
  function fromJSON(data) {
    if (data.appConfig) {
      _appConfig = { ..._appConfig, ...data.appConfig };
    }
    if (data.windows) {
      _windows = data.windows;
    }
    if (data.appConfig && data.appConfig.startWindow) {
      _selectedWindowId = data.appConfig.startWindow;
    } else if (_windows.length > 0) {
      _selectedWindowId = _windows[0].id;
    }
    _selectedComponentId = null;
    _notifyChange();
  }
  
  // 暴露公共API
  return {
    init,
    onChange,
    
    // 撤销/重做
    undo,
    redo,
    canUndo,
    canRedo,
    
    // 剪贴板
    copySelected,
    paste,
    hasClipboard,
    
    // 窗口操作
    addWindow,
    removeWindow,
    getWindows,
    getWindow,
    selectWindow,
    getSelectedWindow,
    getSelectedWindowId,
    updateWindowProp,
    
    // 组件操作
    addComponent,
    removeComponent,
    selectComponent,
    getSelectedComponent,
    getSelectedComponentId,
    updateComponentProp,
    
    // 积木操作
    setWindowBlocks,
    getWindowBlocks,
    setComponentBlocks,
    getComponentBlocks,
    
    // 应用配置
    getAppConfig,
    updateAppConfig,
    setStartWindow,
    
    // 序列化
    toJSON,
    fromJSON,
  };
})();
