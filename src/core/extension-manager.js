/**
 * 扩展管理器 - 支持加载自定义扩展积木（JSON / JS / Python 三种格式）
 *
 * === 格式一：JSON 文件 ===
 * {
 *   "id": "my-extension",
 *   "name": "我的扩展",
 *   "color": "#FF6B6B",
 *   "blocks": [ { "type": "ext_block", "label": "...", "shape": "stack", "params": [...] } ],
 *   "executors": {
 *     "ext_block": "function(params, scope) { ... }"   // 函数字符串
 *   }
 * }
 *
 * === 格式二：JS 文件 ===
 * ExtensionManager.registerExtension({
 *   id: 'my-extension',
 *   name: '我的扩展',
 *   color: '#FF6B6B',
 *   blocks: [ ... ],
 *   executors: {
 *     ext_block: function(params, scope) { ... }   // 直接写函数，不需要字符串
 *   }
 * });
 *
 * === 积木可选属性 code_exp（代码编程模式动态 API, 非必填） ===
 * blocks: [ {
 *   type: 'ext_hello', label: '...', shape: 'stack', params: [...],
 *   code_exp: { "python": "hello", "ALB": "hello", "JavaScript": "hello" }  // 对应语言下的函数名
 * } ]
 * JS/Python 中按扩展命名空间对象调用: h.hello()；ALB 中函数名前加扩展名用_分隔: h_hello
 * （安装扩展后或打开项目时由 CodeRuntime 动态注入 API）
 *
 * === 格式三：Python 文件（.py, 由内置 Skulpt 解释器执行） ===
 * 先定义执行函数, 再调用 register_extension({...})（宿主注入的钩子, 不需要 import）：
 *   def ext_hello(params, scope):
 *       say(params["text"])          # 可直接调用舞台 API: say/move/set_x/get_x/set_sprite ...
 *       print("输出去控制台")
 *
 *   register_extension({
 *       "id": "my-extension", "name": "我的扩展", "color": "#FF6B6B",
 *       "blocks": [ { "type": "ext_hello", "label": "说 {text}", "shape": "stack",
 *                     "params": [ {"name": "text", "type": "string", "default": "你好"} ] } ],
 *       "executors": { "ext_hello": ext_hello },
 *   })
 * 执行器接收两个 dict: params（积木参数）与 scope（执行上下文）, 返回值作为 reporter 结果。
 * 注意: Python 执行器只在桌面编辑器内运行（导出 HTML 不包含 Skulpt, 会跳过并告警）;
 *             C 型积木的子代码槽在 Python 执行器中不可执行（无 await）。
 */
const ExtensionManager = (function () {
  const _extensions = new Map(); // id -> extension definition (已安装)
  const _customExecutors = new Map(); // blockType -> executor function
  const _jsSources = []; // 原始 JS 源码（用于导出）
  const _pySources = []; // 原始 Python 扩展源码（用于项目内溯源/提示）
  const _availableExtensions = new Map(); // id -> extension definition (可用但未安装)
  const _installedIds = new Set(); // 当前已安装的扩展 ID
  let _lastRegisteredId = null; // 最近一次 registerExtension 成功注册的扩展 ID
  let _availableOnly = false; // 加载模式标记：true 时 registerExtension 只注册不安装

  /**
   * 注册一个扩展
   * @param {Object} extDef - 扩展定义对象
   */
  function registerExtension(extDef) {
    if (!extDef || !extDef.id || !extDef.blocks) {
      console.error('ExtensionManager: 无效的扩展定义', extDef);
      return false;
    }

    // 如果已存在同 id 扩展，先卸载旧版
    if (_extensions.has(extDef.id)) {
      uninstallExtension(extDef.id);
    }

    // 注册分类（避免与内置分类重复时报错）
    if (!_existsCategory(extDef.id)) {
      BlockRegistry.registerCategory(extDef.id, extDef.name || extDef.id, extDef.color || '#888888');
    }

    // 注册积木
    extDef.blocks.forEach(blockDef => {
      blockDef.category = extDef.id;
      if (!blockDef.color) blockDef.color = extDef.color || '#888888';

      if (!blockDef.ports) {
        blockDef.ports = {
          flowIn: blockDef.shape === 'stack' || blockDef.shape === 'c-block',
          flowOut: blockDef.shape === 'stack' || blockDef.shape === 'c-block',
        };
      }

      BlockRegistry.register(blockDef);
    });

    // 注册执行器：支持字符串和函数两种类型
    if (extDef.executors) {
      Object.entries(extDef.executors).forEach(([blockType, executor]) => {
        try {
          let fn;
          if (typeof executor === 'function') {
            // JS 文件：直接传函数对象
            fn = executor;
          } else if (typeof executor === 'string') {
            // JSON 文件：函数字符串，动态解析
            fn = new Function('return ' + executor)();
          } else {
            console.error(`ExtensionManager: 执行器 ${blockType} 类型无效`);
            return;
          }
          _customExecutors.set(blockType, fn);
        } catch (err) {
          console.error(`ExtensionManager: 无法解析执行器 ${blockType}:`, err);
        }
      });
    }

    // 可用池始终记录
    if (!_availableExtensions.has(extDef.id)) {
      _availableExtensions.set(extDef.id, extDef);
    }
    // 根据模式决定是否自动安装
    if (!_availableOnly) {
      _extensions.set(extDef.id, extDef);
      _installedIds.add(extDef.id);
    }
    _lastRegisteredId = extDef.id;
    console.log(`ExtensionManager: 已注册扩展 "${extDef.name || extDef.id}"，包含 ${extDef.blocks.length} 个积木`);
    return true;
  }

  function _existsCategory(catId) {
    return BlockRegistry.getCategories().some(c => c.id === catId);
  }

  /**
   * 从 JSON 字符串加载扩展
   */
  function loadFromJSON(jsonStr) {
    try {
      const extDef = JSON.parse(jsonStr);
      return registerExtension(extDef);
    } catch (err) {
      console.error('ExtensionManager: JSON 解析失败:', err);
      return false;
    }
  }

  /**
   * 从 JS 文件内容加载扩展（动态执行脚本）
   * JS 文件内应调用 ExtensionManager.registerExtension({...})
   */
  function loadFromJS(jsContent) {
    try {
      _jsSources.push(jsContent); // 存储原始源码
      const script = document.createElement('script');
      script.textContent = jsContent;
      document.head.appendChild(script);
      document.head.removeChild(script);
      return true;
    } catch (err) {
      console.error('ExtensionManager: JS 执行失败:', err);
      alert((i18n.isEnglish() ? 'Extension JS execution error: ' : '扩展 JS 文件执行出错：') + err.message);
      return false;
    }
  }

  /**
   * 把代码编程模式的平铺舞台 API（say/move/get_x/set_var ...）注入 Python 解释器,
   * 使 Python 扩展的执行器内能直接操作舞台（PyRunner.setFunc 已配置时立即写入 Sk.builtins）
   */
  function _injectPythonHostAPI() {
    if (typeof PyRunner === 'undefined' || !PyRunner.isReady()) return;
    if (typeof CodeRuntime === 'undefined' || !CodeRuntime.getFlatAPI) return;
    let f = null;
    try { f = CodeRuntime.getFlatAPI(); } catch (e) { /* 运行时不可用时忽略 */ }
    if (!f) return;
    Object.keys(f).forEach(name => {
      if (typeof f[name] !== 'function') return;
      try { PyRunner.setFunc(name, f[name]); } catch (e) { /* 跳过非法标识符 */ }
    });
  }

  /** Python 执行器内的 print 输出去向（无通用控制台, 只进开发者工具） */
  function _pyExtOutput(text) {
    console.log('[Python 扩展]', text);
  }

  /**
   * 规范化 Python 侧递过来的扩展定义：
   * 把 executors 里的 Python 函数（_pyToJs 包装带 pythonCallable）包成可调用的 JS 执行器
   */
  function _normalizePythonExtDef(def) {
    if (!def || typeof def !== 'object') return null;
    const extDef = Object.assign({}, def);
    if (!Array.isArray(extDef.blocks)) extDef.blocks = [];
    if (!extDef.id) extDef.id = _safeIdent(extDef.name) || ('py-extension-' + (_pySources.length + 1));
    if (extDef.executors && typeof extDef.executors === 'object') {
      const executors = {};
      Object.entries(extDef.executors).forEach(([blockType, executor]) => {
        if (typeof executor === 'function' && executor.pythonCallable) {
          const wrapped = PyRunner.makeExecutor(executor, _pyExtOutput);
          if (wrapped) { executors[blockType] = wrapped; return; }
          console.error(`ExtensionManager: Python 执行器 ${blockType} 包装失败`);
          return;
        }
        executors[blockType] = executor;   // 字符串/普通 JS 函数按原规则处理
      });
      extDef.executors = executors;
    }
    extDef.__lang = 'python';   // 标记扩展源码语言, 导出 HTML 时需跳过
    return extDef;
  }

  /**
   * 从 Python 文件内容加载扩展（Skulpt 执行整段源码, 文件内调用 register_extension({...})）
   * @param {string} pyContent Python 源码
   * @param {{availableOnly?: boolean}} opts true 时只入可用池不自动安装
   */
  async function loadFromPython(pyContent, opts) {
    if (typeof PyRunner === 'undefined' || !PyRunner.isReady()) {
      const msg = i18n && i18n.isEnglish && i18n.isEnglish()
        ? 'Python interpreter not loaded (interpreter/skulpt.min.js)'
        : 'Python 解释器未加载 (interpreter/skulpt.min.js)';
      console.error('ExtensionManager:', msg);
      if (!(opts && opts.availableOnly)) alert(msg);
      return false;
    }
    if (_pySources.indexOf(pyContent) < 0) _pySources.push(pyContent); // 无论成败都保留源码, 同一内容不重复记录
    _injectPythonHostAPI();
    let registered = false;
    const prevAvailable = _availableOnly;
    if (opts && opts.availableOnly) _availableOnly = true;
    try {
      const res = await PyRunner.runWithHooks(pyContent, {
        register_extension: function (def) {
          try {
            const extDef = _normalizePythonExtDef(def);
            if (extDef) registered = registerExtension(extDef) || registered;
          } catch (err) {
            console.error('ExtensionManager: Python 扩展定义无效:', err);
          }
          return null;
        },
      });
      if (res && res.error) {
        console.error('ExtensionManager: Python 扩展执行失败:', res.error);
        if (!(opts && opts.availableOnly)) {
          alert((i18n.isEnglish() ? 'Python extension error: ' : '扩展 Python 文件执行出错：') + res.error);
        }
      }
      if (res && res.output && res.output.length && !(opts && opts.availableOnly)) {
        res.output.forEach(_pyExtOutput);
      }
      return registered;
    } finally {
      _availableOnly = prevAvailable;
    }
  }

  /**
   * 从文件路径加载扩展（自动检测 JSON / JS / Python 格式）
   * 返回值: { ok: boolean, id: string|null }
   */
  async function loadFromFile(filePath) {
    const content = await window.api.readFile(filePath);
    if (!content) return { ok: false, id: null };

    if (filePath.endsWith('.js')) {
      _lastRegisteredId = null;
      const result = loadFromJS(content);
      return { ok: result, id: _lastRegisteredId };
    }

    if (filePath.endsWith('.py')) {
      _lastRegisteredId = null;
      const result = await loadFromPython(content);
      return { ok: result, id: _lastRegisteredId };
    }

    // JSON 格式：先解析拿 id，再注册
    try {
      const extDef = JSON.parse(content);
      const ok = registerExtension(extDef);
      return { ok, id: extDef.id || null };
    } catch (err) {
      console.error('ExtensionManager: JSON 解析失败:', err);
      return { ok: false, id: null };
    }
  }

  /**
   * 从项目的 extensions 目录加载所有扩展到可用池（不自动安装，仅注册定义）
   */
  async function loadFromProject(projectPath) {
    const extDir = projectPath + '/extensions';
    await window.api.ensureDir(extDir);
    const files = await window.api.listDir(extDir);
    let count = 0;
    for (const file of files) {
      if (file.endsWith('.json') || file.endsWith('.js') || file.endsWith('.py')) {
        const ok = await _loadFileAsAvailable(extDir + '/' + file);
        if (ok) count++;
      }
    }
    return count;
  }

  /**
   * 从文件加载扩展到可用池（不自动安装，仅注册定义）
   */
  async function _loadFileAsAvailable(filePath) {
    const content = await window.api.readFile(filePath);
    if (!content) return false;

    if (filePath.endsWith('.py')) {
      // Python 文件: 异步执行, _availableOnly 必须包住整个 await 过冲
      _lastRegisteredId = null;
      return await loadFromPython(content, { availableOnly: true });
    }

    if (filePath.endsWith('.js')) {
      // JS 文件：执行脚本，用 _availableOnly 标记让 registerExtension 只注册不安装
      try {
        _jsSources.push(content);
        _availableOnly = true;
        const script = document.createElement('script');
        script.textContent = content;
        document.head.appendChild(script);
        document.head.removeChild(script);
        _availableOnly = false;
        return true;
      } catch (err) {
        console.error('ExtensionManager: JS 执行失败:', err);
        return false;
      }
    }

    // JSON 文件：仅注册到可用池
    try {
      const extDef = JSON.parse(content);
      registerAvailable(extDef);
      return true;
    } catch (err) {
      console.error('ExtensionManager: JSON 解析失败:', err);
      return false;
    }
  }

  /**
   * 获取自定义执行器
   */
  function getExecutor(blockType) {
    return _customExecutors.get(blockType) || null;
  }

  /**
   * 获取所有自定义执行器（用于导出）
   */
  function getExecutors() {
    return _customExecutors;
  }

  /**
   * 获取所有扩展的原始 JS 源码（用于导出）
   */
  function getJsSources() {
    return _jsSources.slice();
  }

  /**
   * 获取所有已加载的 Python 扩展源码（导出 HTML 不支持, 用于提示）
   */
  function getPySources() {
    return _pySources.slice();
  }

  /**
   * 获取所有已加载的扩展
   */
  function getExtensions() {
    return Array.from(_extensions.values());
  }

  /**
   * 注册一个可用扩展定义（不自动安装，仅记录定义供后续 installExtension 使用）
   */
  function registerAvailable(extDef) {
    if (!extDef || !extDef.id || !extDef.blocks) return false;
    _availableExtensions.set(extDef.id, extDef);
    return true;
  }

  /**
   * 获取所有可用扩展定义（包括已安装和未安装的）
   */
  function getAvailableExtensions() {
    return Array.from(_availableExtensions.values());
  }

  /**
   * 获取可用扩展定义
   */
  function getAvailableDefinition(extId) {
    return _availableExtensions.get(extId) || null;
  }

  /**
   * 安装扩展（从可用池中取出并注册到积木系统）
   */
  function installExtension(extId) {
    if (_extensions.has(extId)) return true; // 已安装
    const def = _availableExtensions.get(extId);
    if (!def) {
      console.warn(`ExtensionManager: 可用扩展 "${extId}" 未找到`);
      return false;
    }
    const ok = registerExtension(def);
    if (ok) _installedIds.add(extId);
    return ok;
  }

  /**
   * 卸载扩展（同时清理 BlockRegistry 中的分类和积木）
   */
  function uninstallExtension(extId) {
    const ext = _extensions.get(extId);
    if (!ext) return false;
    // 清理自定义执行器
    ext.blocks.forEach(b => _customExecutors.delete(b.type));
    // 清理 BlockRegistry 中的分类和积木
    if (typeof BlockRegistry !== 'undefined' && BlockRegistry.unregisterCategory) {
      BlockRegistry.unregisterCategory(extId);
    } else {
      ext.blocks.forEach(b => {
        if (typeof BlockRegistry !== 'undefined' && BlockRegistry.unregisterBlock) {
          BlockRegistry.unregisterBlock(b.type);
        }
      });
    }
    _extensions.delete(extId);
    _installedIds.delete(extId);
    console.log(`ExtensionManager: 已卸载扩展 "${ext.name || extId}"`);
    return true;
  }

  /** 获取已安装扩展 ID 列表（用于项目保存） */
  function getInstalledIds() {
    return Array.from(_installedIds);
  }

  /** 字符串规整为合法 JS/Python 标识符（扩展命名空间对象名用） */
  function _safeIdent(s) {
    let v = String(s || '').trim().replace(/[^a-zA-Z0-9_]/g, '_');
    if (/^\d/.test(v)) v = '_' + v;
    return v;
  }

  /** 取单个积木定义的 code_exp 属性（兼容放在 extDef.code_exps[type] 处的写法） */
  function _blockCodeExp(extDef, blockDef) {
    if (blockDef && blockDef.code_exp) return blockDef.code_exp;
    if (extDef && extDef.code_exps && extDef.code_exps[blockDef && blockDef.type]) return extDef.code_exps[blockDef.type];
    return null;
  }

  /**
   * 收集所有已安装扩展中带 code_exp 属性的积木（供代码编程模式动态注入 API）
   * 返回: [{ extId, objName, fns: { 函数名: { def: blockDef, exec: executorFn } } }]
   * objName: 扩展 id/名称规整为标识符, JS/Python 内以 h.hello() 形式调用
   */
  function getCodeExpApis() {
    const result = [];
    _extensions.forEach((extDef, extId) => {
      const fns = {};
      let has = false;
      (extDef.blocks || []).forEach(blockDef => {
        const codeExp = _blockCodeExp(extDef, blockDef);
        if (!codeExp || typeof codeExp !== 'object') return;
        const exec = _customExecutors.get(blockDef.type);
        if (!exec) return; // 没有执行器的 code_exp 无法生效
        const key = blockDef.type + ':' + (codeExp.python || '') + (codeExp.ALB || '') + (codeExp.JavaScript || '');
        if (fns[key]) return;
        fns[key] = { def: Object.assign({}, blockDef, { code_exp: codeExp }), exec };
        has = true;
      });
      if (!has) return;
      const objName = _safeIdent(extDef.name) || _safeIdent(extId) || ('ext_' + (result.length + 1));
      result.push({ extId, objName, fns });
    });
    return result;
  }

  /** 设置已安装扩展 ID 列表（用于项目加载时恢复） */
  function setInstalledIds(ids) {
    _installedIds.clear();
    (ids || []).forEach(id => _installedIds.add(id));
  }

  /** 检查扩展是否已安装 */
  function isInstalled(extId) {
    return _extensions.has(extId);
  }

  /**
   * 批量安装已保存的扩展（项目加载时调用）
   */
  function restoreInstalled(ids) {
    let count = 0;
    (ids || []).forEach(id => {
      if (installExtension(id)) count++;
    });
    return count;
  }

  return {
    registerExtension,
    registerAvailable,
    getAvailableExtensions,
    getAvailableDefinition,
    installExtension,
    loadFromJSON,
    loadFromJS,
    loadFromPython,
    loadFromFile,
    loadFromProject,
    getExecutor,
    getExecutors,
    getJsSources,
    getPySources,
    getExtensions,
    uninstallExtension,
    getInstalledIds,
    setInstalledIds,
    isInstalled,
    restoreInstalled,
    getCodeExpApis,
  };
})();
