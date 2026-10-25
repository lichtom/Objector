/**
 * APP 运行时 - 测试运行引擎
 * 根据窗口配置渲染预览，执行 APP 专用积木
 */
const AppRuntime = (function () {
  let _running = false;
  let _stopRequested = false;
  let _window = null;       // 当前运行窗口配置
  let _allWindows = [];     // 所有窗口
  let _callbacks = null;    // { onLog, onEnd }
  let _previewEl = null;    // 预览容器 DOM
  let _vars = {};           // 运行时变量
  let _timers = [];         // 定时器 ID
  let _storage = {};        // 模拟本地存储
  let _components = {};     // 运行时组件 DOM 引用

  /**
   * 启动测试运行
   * @param {object} startWindow - 启动窗口配置
   * @param {array} allWindows - 所有窗口列表
   * @param {object} callbacks - { onLog(msg, type), onEnd() }
   */
  function run(startWindow, allWindows, callbacks) {
    if (_running) return;
    _running = true;
    _stopRequested = false;
    _window = startWindow;
    _allWindows = allWindows || [];
    _callbacks = callbacks || {};
    _vars = {};
    _timers = [];
    _storage = {};
    _components = {};

    _log('▶ 启动测试: ' + (_window.title || _window.name), 'info');
    _renderPreview();
    _executeStartBlocks();
  }

  /** 停止测试运行 */
  function stop() {
    _stopRequested = true;
    _running = false;
    _timers.forEach(id => clearInterval(id));
    _timers = [];
    _removePreview();
    _log('■ 测试已停止', 'info');
    if (_callbacks.onEnd) _callbacks.onEnd();
  }

  // ========== 预览渲染 ==========

  function _renderPreview() {
    const consolePanel = document.getElementById('app-console-panel');
    if (!consolePanel) return;

    _previewEl = document.createElement('div');
    _previewEl.id = 'app-runtime-preview';
    _previewEl.style.cssText = 'position:absolute;top:40px;left:0;right:0;bottom:0;z-index:10;background:#fff;border-radius:0 0 0 0;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.3);';

    // 标题栏
    const titleBar = document.createElement('div');
    titleBar.style.cssText = 'height:30px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;padding:0 10px;color:#fff;font-size:12px;font-weight:600;user-select:none;';
    titleBar.innerHTML = `<span style="flex:1">${_window.title || _window.name}</span><span style="font-size:10px;opacity:0.7;">${_window.width}×${_window.height}</span>`;
    _previewEl.appendChild(titleBar);

    // 内容区
    const content = document.createElement('div');
    content.id = 'app-preview-content';
    content.style.cssText = 'flex:1;position:relative;overflow:auto;background:#f5f5f5;padding:0;';
    _previewEl.style.display = 'flex';
    _previewEl.style.flexDirection = 'column';
    _previewEl.appendChild(content);

    // 渲染组件
    (_window.components || []).forEach(comp => {
      const el = _createComponentElement(comp);
      if (el) {
        content.appendChild(el);
        _components[comp.name] = { dom: el, config: comp };
      }
    });

    consolePanel.style.position = 'relative';
    consolePanel.appendChild(_previewEl);
    _log('预览已渲染 (' + (_window.components || []).length + ' 个组件)', 'info');
  }

  function _createComponentElement(comp) {
    const x = comp.x || 10;
    const y = comp.y || 10;
    let el;

    switch (comp.type) {
      case 'button':
        el = document.createElement('button');
        el.textContent = comp.text || comp.name;
        el.style.cssText = `position:absolute;left:${x}px;top:${y}px;padding:8px 16px;border:none;border-radius:4px;background:#667eea;color:#fff;cursor:pointer;font-size:13px;`;
        el.addEventListener('click', () => {
          _log('按钮点击: ' + comp.name, 'log');
          _fireEvent('app_on_button_click', { name: comp.name });
        });
        break;

      case 'input':
        el = document.createElement('input');
        el.type = 'text';
        el.value = comp.defaultValue || '';
        el.placeholder = comp.name;
        el.style.cssText = `position:absolute;left:${x}px;top:${y}px;padding:6px 10px;border:1px solid #ddd;border-radius:4px;font-size:13px;min-width:150px;`;
        el.addEventListener('input', () => {
          _fireEvent('app_on_input_change', { name: comp.name });
        });
        break;

      case 'label':
        el = document.createElement('span');
        el.textContent = comp.text || comp.name;
        el.style.cssText = `position:absolute;left:${x}px;top:${y}px;font-size:14px;color:#333;`;
        break;

      case 'list':
        el = document.createElement('div');
        el.style.cssText = `position:absolute;left:${x}px;top:${y}px;min-width:150px;min-height:80px;border:1px solid #ddd;border-radius:4px;background:#fff;overflow-y:auto;`;
        el.innerHTML = '<div style="padding:4px 8px;font-size:11px;color:#999;border-bottom:1px solid #eee;">列表 (空)</div>';
        break;

      case 'image':
        el = document.createElement('div');
        el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:100px;height:100px;border:1px dashed #ccc;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#999;font-size:12px;`;
        el.textContent = '🖼️ ' + comp.name;
        break;

      case 'html':
        el = document.createElement('iframe');
        el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${comp.width || 300}px;height:${comp.height || 200}px;border:none;background:#fff;`;
        el.sandbox = 'allow-scripts allow-forms allow-popups allow-same-origin';
        if (comp.htmlContent) {
          setTimeout(() => {
            const doc = el.contentDocument || el.contentWindow.document;
            doc.open(); doc.write(comp.htmlContent); doc.close();
          }, 50);
        }
        break;

      case 'canvas':
        el = document.createElement('canvas');
        el.width = comp.width || 200;
        el.height = comp.height || 150;
        el.style.cssText = `position:absolute;left:${x}px;top:${y}px;background:#fff;border:1px solid #ccc;`;
        break;

      default:
        el = document.createElement('div');
        el.textContent = comp.name;
        el.style.cssText = `position:absolute;left:${x}px;top:${y}px;padding:4px;border:1px solid #ccc;font-size:11px;`;
    }
    return el;
  }

  function _removePreview() {
    if (_previewEl && _previewEl.parentNode) {
      _previewEl.parentNode.removeChild(_previewEl);
    }
    _previewEl = null;
    _components = {};
  }

  // ========== 积木执行 ==========

  function _executeStartBlocks() {
    const blocks = _window.blocksData || {};
    const startBlocks = Object.values(blocks).filter(b => b.type === 'app_on_window_start');

    if (startBlocks.length === 0) {
      _log('窗口启动: 无启动事件积木', 'log');
      return;
    }

    startBlocks.forEach(sb => {
      _executeChain(sb, blocks, {}).catch(err => {
        _log('启动事件错误: ' + err.message, 'error');
      });
    });

    // 注册定时器事件
    const timerBlocks = Object.values(blocks).filter(b => b.type === 'app_on_timer');
    timerBlocks.forEach(tb => {
      const sec = Number(tb.params?.sec || 1);
      const ms = Math.max(sec * 1000, 50);
      const id = setInterval(() => {
        if (_stopRequested) return;
        _executeChain(tb, blocks, {}).catch(err => _log('定时器错误: ' + err.message, 'error'));
      }, ms);
      _timers.push(id);
    });

    // 注册按键事件
    const keyBlocks = Object.values(blocks).filter(b => b.type === 'app_on_key_pressed');
    if (keyBlocks.length > 0) {
      const handler = (e) => {
        if (_stopRequested) return;
        const key = e.key.toLowerCase();
        keyBlocks.forEach(kb => {
          if ((kb.params?.key || '').toLowerCase() === key) {
            _executeChain(kb, blocks, {}).catch(err => _log('按键错误: ' + err.message, 'error'));
          }
        });
      };
      document.addEventListener('keydown', handler);
      _timers.push(handler); // 存储引用以便清理
    }
  }

  function _fireEvent(eventType, params) {
    const blocks = _window.blocksData || {};
    const matching = Object.values(blocks).filter(b => b.type === eventType);
    matching.forEach(b => {
      // 检查参数匹配（如按钮名）
      if (params.name && b.params?.name && b.params.name !== params.name) return;
      _executeChain(b, blocks, {}).catch(err => _log('事件错误: ' + err.message, 'error'));
    });
  }

  async function _executeChain(startBlock, blocks, scope) {
    let cur = startBlock;
    while (cur && !_stopRequested) {
      await _executeBlock(cur, blocks, scope);
      cur = cur.flowOut ? blocks[cur.flowOut] : null;
    }
  }

  async function _executeBlock(block, blocks, scope) {
    const type = block.type;
    const p = block.params || {};

    // APP 专用积木执行器
    switch (type) {
      // 事件入口（无操作）
      case 'app_on_window_start':
      case 'app_on_window_close':
      case 'app_on_window_resize':
      case 'app_on_button_click':
      case 'app_on_input_change':
      case 'app_on_key_pressed':
      case 'app_on_timer':
        break;

      // UI 组件操作
      case 'app_set_button_text': {
        const comp = _components[p.name];
        if (comp && comp.dom) comp.dom.textContent = String(p.text);
        break;
      }
      case 'app_set_button_enabled': {
        const comp = _components[p.name];
        if (comp && comp.dom) comp.dom.disabled = (p.enabled === '禁用');
        break;
      }
      case 'app_set_input_value': {
        const comp = _components[p.name];
        if (comp && comp.dom) comp.dom.value = String(p.value);
        break;
      }
      case 'app_set_label_text': {
        const comp = _components[p.name];
        if (comp && comp.dom) comp.dom.textContent = String(p.text);
        break;
      }
      case 'app_list_add_item': {
        const comp = _components[p.name];
        if (comp && comp.dom) {
          const item = document.createElement('div');
          item.style.cssText = 'padding:4px 8px;border-bottom:1px solid #eee;font-size:12px;';
          item.textContent = String(p.item);
          comp.dom.appendChild(item);
        }
        break;
      }
      case 'app_list_clear': {
        const comp = _components[p.name];
        if (comp && comp.dom) comp.dom.innerHTML = '';
        break;
      }
      case 'app_show_component': {
        const comp = _components[p.name];
        if (comp && comp.dom) comp.dom.style.display = '';
        break;
      }
      case 'app_hide_component': {
        const comp = _components[p.name];
        if (comp && comp.dom) comp.dom.style.display = 'none';
        break;
      }
      case 'app_set_component_pos': {
        const comp = _components[p.name];
        if (comp && comp.dom) {
          comp.dom.style.left = Number(p.x) + 'px';
          comp.dom.style.top = Number(p.y) + 'px';
        }
        break;
      }
      case 'app_set_component_size': {
        const comp = _components[p.name];
        if (comp && comp.dom) {
          comp.dom.style.width = Number(p.w) + 'px';
          comp.dom.style.height = Number(p.h) + 'px';
        }
        break;
      }

      // 窗口操作
      case 'app_set_window_title': {
        if (_previewEl) {
          const tb = _previewEl.querySelector('div');
          if (tb) tb.querySelector('span').textContent = String(p.title);
        }
        _log('窗口标题已设为: ' + p.title, 'log');
        break;
      }
      case 'app_open_window':
        _log('打开窗口: ' + p.name, 'log');
        break;
      case 'app_close_window':
        _log('关闭窗口: ' + p.name, 'log');
        break;

      // 对话框
      case 'app_alert':
        _log('[对话框] ' + p.msg, 'info');
        break;
      case 'app_confirm':
        _log('[确认框] ' + p.msg + ' → 是', 'info');
        return true;
      case 'app_prompt':
        _log('[输入框] ' + p.msg + ' → 用户输入', 'info');
        return '用户输入';
      case 'app_open_file_dialog':
        _log('[文件选择] 选择文件...', 'info');
        return 'file.txt';
      case 'app_save_file_dialog':
        _log('[文件保存] 保存为 ' + p.name, 'info');
        return p.name;

      // 数据操作
      case 'app_write_file':
        _log('写入文件: ' + p.path, 'log');
        break;
      case 'app_read_file':
        _log('读取文件: ' + p.path, 'log');
        return '[文件内容]';
      case 'app_save_storage':
        _storage[p.key] = p.val;
        _log('保存数据: ' + p.key + ' = ' + p.val, 'log');
        break;
      case 'app_load_storage':
        _log('加载数据: ' + p.key + ' = ' + (_storage[p.key] || ''), 'log');
        return _storage[p.key] || '';
      case 'app_http_get':
        _log('HTTP GET: ' + p.url, 'log');
        return '{"status":"ok"}';
      case 'app_http_post':
        _log('HTTP POST: ' + p.url, 'log');
        return '{"status":"ok"}';

      // 控制台
      case 'app_console_log':
        _log(String(p.text), 'log');
        break;
      case 'app_console_warn':
        _log(String(p.text), 'warn');
        break;
      case 'app_console_error':
        _log(String(p.text), 'error');
        break;
      case 'app_console_clear': {
        const c = document.getElementById('console-output');
        if (c) c.innerHTML = '';
        break;
      }

      // ===== 复用通用积木 =====
      // 控制流
      case 'wait':
        await new Promise(r => setTimeout(r, Number(p.sec) * 1000));
        break;
      case 'repeat': {
        const times = Number(p.times);
        const bodyId = block.subBlocks?.body;
        if (bodyId && blocks[bodyId]) {
          for (let i = 0; i < times && !_stopRequested; i++) {
            scope._index = i;
            await _executeChain(blocks[bodyId], blocks, scope);
          }
        }
        break;
      }
      case 'forever': {
        const bodyId = block.subBlocks?.body;
        if (bodyId && blocks[bodyId]) {
          while (!_stopRequested) {
            await _executeChain(blocks[bodyId], blocks, scope);
            await new Promise(r => setTimeout(r, 16));
          }
        }
        break;
      }
      case 'if_then': {
        const cond = await _resolveValue(p.cond, block, blocks, scope);
        if (cond) {
          const bodyId = block.subBlocks?.body;
          if (bodyId && blocks[bodyId]) await _executeChain(blocks[bodyId], blocks, scope);
        }
        break;
      }
      case 'if_else': {
        const cond = await _resolveValue(p.cond, block, blocks, scope);
        const subName = cond ? 'then' : 'else';
        const bodyId = block.subBlocks?.[subName];
        if (bodyId && blocks[bodyId]) await _executeChain(blocks[bodyId], blocks, scope);
        break;
      }

      // 变量
      case 'var_set':
        _vars[p.name] = await _resolveValue(p.val, block, blocks, scope);
        break;
      case 'var_change':
        _vars[p.name] = (Number(_vars[p.name]) || 0) + Number(p.val);
        break;
      case 'var_get':
        return _vars[p.name] !== undefined ? _vars[p.name] : 0;

      // 运算
      case 'op_add': return Number(await _resolveValue(p.a, block, blocks, scope)) + Number(await _resolveValue(p.b, block, blocks, scope));
      case 'op_sub': return Number(await _resolveValue(p.a, block, blocks, scope)) - Number(await _resolveValue(p.b, block, blocks, scope));
      case 'op_mul': return Number(await _resolveValue(p.a, block, blocks, scope)) * Number(await _resolveValue(p.b, block, blocks, scope));
      case 'op_div': return Number(await _resolveValue(p.a, block, blocks, scope)) / Number(await _resolveValue(p.b, block, blocks, scope));

      // IO (映射到控制台)
      case 'io_print':
      case 'io_print_line':
        _log(String(p.text), 'log');
        break;
      case 'io_log':
        _log(String(p.text), 'log');
        break;

      // 函数
      case 'func_define':
        break; // 函数定义不直接执行
      case 'func_call': {
        const fnName = p.name;
        const fnDef = Object.values(blocks).find(b => b.type === 'func_define' && b.params?.name === fnName);
        if (fnDef && fnDef.flowOut && blocks[fnDef.flowOut]) {
          await _executeChain(blocks[fnDef.flowOut], blocks, {});
        }
        break;
      }

      // Reporter 积木
      case 'app_get_input_value': {
        const comp = _components[p.name];
        return comp && comp.dom ? comp.dom.value : '';
      }
      case 'app_get_label_text': {
        const comp = _components[p.name];
        return comp && comp.dom ? comp.dom.textContent : '';
      }
      case 'app_list_get_selected':
        return '';
      case 'app_get_window_width':
        return _window.width || 800;
      case 'app_get_window_height':
        return _window.height || 600;

      default:
        // 未知积木类型，跳过
        break;
    }

    await new Promise(r => setTimeout(r, 1));
  }

  async function _resolveValue(val, block, blocks, scope) {
    // 检查是否有参数连接（reporter 积木）
    if (block && block.paramConnections) {
      for (const [paramName, reporterId] of Object.entries(block.paramConnections)) {
        const reporter = blocks[reporterId];
        if (reporter) {
          const result = await _executeBlock(reporter, blocks, scope);
          if (result !== undefined) return result;
        }
      }
    }
    return val;
  }

  function _log(msg, type = 'log') {
    if (_callbacks && _callbacks.onLog) {
      _callbacks.onLog(msg, type);
    }
  }

  return { run, stop };
})();
