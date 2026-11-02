/**
 * python.js — Objector 代码编程模式的 Python 执行适配器
 *
 * 基于开源 Skulpt 解释器（MIT License, https://github.com/skulpt/skulpt）,
 * 纯 JavaScript 实现，在渲染进程内解释执行 Python 3 代码。
 *
 * 接口与 alb.js 对齐，支持向解释器内注入自定义常量 / 变量 / 函数:
 *   PyRunner.setFunc('move', (steps) => { ... });   // 注册原生函数（Python 可直接调用）
 *   PyRunner.setObjectGroup('h', { hello: fn });     // 注册命名空间对象（Python 内 h.hello() 调用）
 *   PyRunner.setConst('STAGE_W', 480);              // 注册常量（每帧同步, Python 读取）
 *   PyRunner.setVar('score', 0);                    // 注册变量（每帧同步, Python 读取）
 *   PyRunner.run('print(move(10))');                // 执行代码, 返回 { output, error }
 *
 * 扩展开发（Python 扩展文件）支持: （供 ExtensionManager 加载 .py 扩展使用）
 *   PyRunner.runWithHooks(src, { register_extension: fn })  // 注入宿主钩子执行整段源码
 *   PyRunner.makeExecutor(pyFn, onOutput)                   // 把 Python def 包装成积木执行器
 *
 * 依赖: interpreter/skulpt.min.js + interpreter/skulpt-stdlib.js（可选, 提供 import 标准库）
 */
(function () {
  'use strict';

  var _configured = false;
  var _funcs = {};    // name -> JS function
  var _consts = {};   // name -> JS value
  var _vars = {};     // name -> JS value
  var _objs = {};     // name -> { key: JS function }（命名空间对象, 扩展 code_exp 用）
  var _runSeq = 0;    // 每次执行使用独立模块名, 避免 sys.modules 缓存

  function _sk() {
    if (typeof Sk === 'undefined') {
      throw new Error('Skulpt 未加载 (interpreter/skulpt.min.js)');
    }
    return Sk;
  }

  /** 把 JS 函数包装为 Python 内建函数（自动做参数/返回值转换） */
  function _wrapNative(fn) {
    var sk = _sk();
    return new sk.builtin.func(function () {
      var args = Array.prototype.slice.call(arguments).map(function (a) {
        return _remapArg(sk, a);
      });
      var r = fn.apply(null, args);
      if (r === undefined || r === null) return sk.builtin.none.none$;
      try { return sk.ffi.remapToPy(r); } catch (e) { return sk.builtin.none.none$; }
    });
  }
  
  /**
   * 参数转换: 普通值走 remapToJs;
   * Python 函数对象（def/lambda/内置函数）转成可调用的 JS 函数,
   * 供宿主侧高阶函数/线程调度器（如 thread_spawn）回调 Python 代码。
   */
  function _remapArg(sk, a) {
    var js;
    try { js = sk.ffi.remapToJs(a); } catch (e) { js = a; }
    if (typeof js === 'function') return js;
    var isCallable = (sk.builtin.func && a instanceof sk.builtin.func)
      || (sk.builtin.method && a instanceof sk.builtin.method)
      || (a && typeof a.tp$call === 'function');
    if (!isCallable) return js;
    return function () {
      var pyArgs = Array.prototype.slice.call(arguments).map(function (x) {
        try { return sk.ffi.remapToPy(x); } catch (e) { return x; }
      });
      var r;
      if (typeof a.tp$call === 'function' && !(sk.builtin.func && a instanceof sk.builtin.func) && !(sk.builtin.method && a instanceof sk.builtin.method)) {
        r = a.tp$call(pyArgs);
        if (r && typeof r.next === 'function') { // 挂起协程 → 同步驱动到完成
          r = sk.misceval.promiseToSuspension ? sk.misceval.asyncToPromise(function () {
            return sk.misceval.iterFor(r, function (v) { return v; });
          }) : undefined;
        }
      } else {
        r = sk.misceval.callsimArray(a, pyArgs); // 同步调用 def/lambda
      }
      try { return sk.ffi.remapToJs(r); } catch (e) { return r; }
    };
  }

  /** 是否为可调用的 Python 对象（def / lambda / 内建函数 / 类型实例） */
  function _isPyCallable(sk, v) {
    if (!v || typeof v !== 'object') return false;
    if (sk.builtin.func && v instanceof sk.builtin.func) return true;
    if (sk.builtin.method && v instanceof sk.builtin.method) return true;
    if (sk.builtin.builtin_function_or_method && v instanceof sk.builtin.builtin_function_or_method) return true;
    return typeof v.tp$call === 'function';
  }

  /** Sk 对象 → JS 值（深度转换; dict/list 递归, 函数保留为可调用的 JS 函数）
   *  注意: Sk.ffi.remapToJs 会丢掉 dict 里的函数值, 扩展定义需要自己遍历 */
  function _pyToJs(sk, v, depth) {
    depth = depth || 0;
    if (v === undefined || v === null) return null;
    if (sk.builtin.none && v instanceof sk.builtin.none) return null;
    if (depth > 8) return null;
    if (_isPyCallable(sk, v)) {
      var wrapper = function () {
        var pyArgs = Array.prototype.slice.call(arguments).map(function (x) {
          try { return sk.ffi.remapToPy(x); } catch (e) { return x; }
        });
        try { return _pyToJs(sk, sk.misceval.callsimArray(v, pyArgs), depth + 1); } catch (e) {
          throw new Error(_formatError(e));
        }
      };
      wrapper.pythonCallable = v;   // 保留原始 Python 函数对象, 供执行器包装使用
      return wrapper;
    }
    if (sk.builtin.dict && v instanceof sk.builtin.dict) {
      var out = {};
      var items = null;
      try { items = (typeof v.$items === 'function') ? v.$items() : null; } catch (e) { items = null; }
      if (!items) return out;
      var pairs = items.items || items.list$elems || items.v || items;
      Array.prototype.forEach.call(pairs, function (p) {
        var pair = (p && (p.items || p.v)) || p;
        var k = _pyToJs(sk, pair[0], depth + 1);
        out[String(k)] = _pyToJs(sk, pair[1], depth + 1);
      });
      return out;
    }
    if ((sk.builtin.list && v instanceof sk.builtin.list) || (sk.builtin.tuple && v instanceof sk.builtin.tuple)) {
      var elems = v.items || v.v || [];
      return Array.prototype.map.call(elems, function (x) { return _pyToJs(sk, x, depth + 1); });
    }
    try { return sk.ffi.remapToJs(v); } catch (e) { return null; }
  }

  /** 把 JS 值转为可安全 remapToPy 的纯数据（只保留标量, 丢弃 _block 等带循环引用的对象） */
  function _plainize(v, depth) {
    if (v === null || typeof v !== 'object') return (typeof v === 'function') ? undefined : v;
    if (depth <= 0) return undefined;
    if (Array.isArray(v)) return v.slice(0, 64).map(function (x) { return _plainize(x, depth - 1); });
    var out = {};
    Object.keys(v).forEach(function (k) {
      if (k === '_block' || k === '_id' || k === 'scope' || k === 'sprite') return;  // 积木/角色对象是复杂引用
      var x = v[k];
      if (x && typeof x === 'object') return;
      if (typeof x === 'function') return;
      out[k] = x;
    });
    return out;
  }

  /** 把 JS 函数包装为 Python 内建函数（参数做深度转换, 函数字典可直接传给宿主钩子） */
  function _wrapNativeDeep(fn) {
    var sk = _sk();
    return new sk.builtin.func(function () {
      var args = Array.prototype.slice.call(arguments).map(function (a) {
        return _pyToJs(sk, a, 0);
      });
      var r = fn.apply(null, args);
      if (r === undefined || r === null) return sk.builtin.none.none$;
      try { return sk.ffi.remapToPy(r); } catch (e) { return sk.builtin.none.none$; }
    });
  }

  /** 配置 Skulpt 输出捕获与标准库读取（只需一次） */
  function _ensureConfigure(sink) {
    var sk = _sk();
    sk.configure({
      output: function (t) { sink.push(String(t)); },
      read: function (name) {
        if (sk.builtinFiles && sk.builtinFiles.files && sk.builtinFiles.files[name] !== undefined) {
          return sk.builtinFiles.files[name];
        }
        throw 'Python 标准库模块不可用: ' + name + '（skulpt-stdlib.js 未加载?）';
      },
      __future__: sk.python3,
    });
    _configured = true;
  }

  /** 合法 Python 标识符 */
  function _ident(s) {
    var v = String(s || '').replace(/[^a-zA-Z0-9_]/g, '_');
    if (/^\d/.test(v)) v = '_' + v;
    return v;
  }

  /**
   * 把注册的命名空间对象成员包装为内建函数, 并生成前置定义代码:
   *   h = type('h', (), {'hello': _ext_h_hello, ...})
   * （Sk.builtin.object 不支持任意属性, 因此用类命名空间形式实现 h.hello() 调用）
   */
  function _buildObjectPrelude() {
    var lines = [];
    for (var objName in _objs) {
      var objIdent = _ident(objName);
      if (!objIdent) continue;
      var members = _objs[objName] || {};
      var pairs = [];
      for (var key in members) {
        var keyIdent = _ident(key);
        if (!keyIdent) continue;
        var builtinName = '_ext_' + objIdent + '_' + keyIdent;
        if (typeof members[key] === 'function') {
          Sk.builtins[builtinName] = _wrapNative(members[key]);
        } else {
          try { Sk.builtins[builtinName] = Sk.ffi.remapToPy(members[key]); } catch (e) { continue; }
        }
        pairs.push("'" + key + "': " + builtinName);
      }
      if (pairs.length) lines.push(objIdent + " = type('" + objIdent + "', (), {" + pairs.join(', ') + "})");
    }
    // 合并为一行, 保证用户代码的行号/报错位置不受前置定义影响
    return lines.length ? lines.join('; ') + '\n' : '';
  }

  /** 把注入的函数/常量/变量同步到 Sk.builtins, 使其在 Python 代码中可直接使用 */
  function _applyInjects() {
    var name;
    for (name in _funcs) {
      Sk.builtins[name] = _wrapNative(_funcs[name]);
    }
    for (name in _consts) {
      try { Sk.builtins[name] = Sk.ffi.remapToPy(_consts[name]); } catch (e) { /* 忽略非法值 */ }
    }
    for (name in _vars) {
      try { Sk.builtins[name] = Sk.ffi.remapToPy(_vars[name]); } catch (e) { /* 忽略非法值 */ }
    }
  }

  /** 格式化 Skulpt 异常为可读字符串 */
  function _formatError(e) {
    if (!e) return '未知错误';
    if (typeof e === 'string') return e;
    try {
      if (typeof Sk !== 'undefined' && e instanceof Sk.builtin.BaseException) {
        return String(e.type.tp$name$) + ': ' + String(e.args ? e.args.v.map(function (a) { return String(a); }).join(', ') : e.message);
      }
    } catch (err) { /* fallthrough */ }
    return e.toString();
  }

  var PyRunner = {
    /** 解释器是否可用 */
    isReady: function () { return typeof Sk !== 'undefined'; },

    /** 注册原生函数（Python 代码中可直接按名字调用; 已配置时立即生效, 供扩展执行器随时调用） */
    setFunc: function (name, fn) {
      _funcs[name] = fn;
      if (_configured && typeof Sk !== 'undefined') {
        try { Sk.builtins[name] = _wrapNative(fn); } catch (e) { /* 忽略非法名字 */ }
      }
      return PyRunner;
    },

    /** 注册常量（每次 run 前同步; Python 内对该名字的重新赋值只影响其局部） */
    setConst: function (name, value) { _consts[name] = value; return PyRunner; },

    /** 注册变量（每次 run 前同步, 语义同 setConst） */
    setVar: function (name, value) { _vars[name] = value; return PyRunner; },

    /** 注册命名空间对象: Python 内可用 objName.key(...) 调用（如扩展 API h.hello()） */
    setObjectGroup: function (objName, members) {
      _objs[objName] = members || {};
      return PyRunner;
    },

    /** 读取当前注册的变量值 */
    getVar: function (name) { return _vars[name]; },

    /** 清除所有注入的函数/常量/变量/对象 */
    clearInjected: function () {
      var name;
      for (name in _funcs) { delete _funcs[name]; delete Sk.builtins[name]; }
      for (name in _consts) { delete _consts[name]; delete Sk.builtins[name]; }
      for (name in _vars) { delete _vars[name]; delete Sk.builtins[name]; }
      for (name in _objs) {
        delete _objs[name];
        var m;
        for (m in Sk.builtins) { if (m.indexOf('_ext_' + name + '_') === 0) delete Sk.builtins[m]; }
      }
      return PyRunner;
    },

    /**
     * 执行 Python 代码。
     * @param {string} src Python 源码
     * @returns {Promise<{output: string[], error: string|null}>}
     */
    run: function (src) {
      var sk;
      try { sk = _sk(); } catch (e) { return Promise.resolve({ output: [], error: _formatError(e) }); }
      var out = [];
      _ensureConfigure(out);
      try { _applyInjects(); } catch (e) { return Promise.resolve({ output: out, error: _formatError(e) }); }
      var name = '<stdin_' + (++_runSeq) + '>';
      var prelude = '';
      try { prelude = _buildObjectPrelude(); } catch (e) { /* 无命名空间对象时忽略 */ }
      var preludeLines = prelude ? prelude.split('\n').length - 1 : 0;
      src = prelude + src;
      var _fixLines = function (text) {
        if (!preludeLines || !text) return text;
        // 把报错行号回退前置定义行, 使行号与用户代码一致（单次替换, 避免重复扣减）
        return String(text).replace(/\bline (\d+)\b/g, function (m, n) {
          return 'line ' + Math.max(1, Number(n) - preludeLines);
        });
      };
      try {
        return sk.misceval.asyncToPromise(function () {
          return sk.importMainWithBody(name, false, src, true);
        }).then(
          function () { return { output: out, error: null }; },
          function (e) { _recordTraceback(e, out); return { output: out, error: _fixLines(_formatError(e)) }; }
        );
      } catch (e) {
        // 语法错误等在异步桥建立前同步抛出的情况
        _recordTraceback(e, out);
        return Promise.resolve({ output: out, error: _fixLines(_formatError(e)) });
      }
    },

    /**
     * 注入宿主钩子后执行整段 Python 源码（用于加载 Python 扩展文件）。
     * 不插入命名空间对象前置定义, 以保证报错行号与源码一致。
     * @param {string} src Python 源码
     * @param {Object} hooks 钩子名 -> JS 函数（参数为深度转换后的 JS 值）
     * @returns {Promise<{output: string[], error: string|null}>}
     */
    runWithHooks: function (src, hooks) {
      var sk;
      try { sk = _sk(); } catch (e) { return Promise.resolve({ output: [], error: _formatError(e) }); }
      var out = [];
      _ensureConfigure(out);
      try { _applyInjects(); } catch (e) { /* 注入失败不阻断钩子执行 */ }
      var names = Object.keys(hooks || {});
      var saved = {};
      names.forEach(function (n) {
        saved[n] = sk.builtins[n];
        sk.builtins[n] = _wrapNativeDeep(hooks[n]);
      });
      var finish = function (e) {
        names.forEach(function (n) {
          if (saved[n] === undefined) delete sk.builtins[n]; else sk.builtins[n] = saved[n];
        });
        if (e) { _recordTraceback(e, out); return { output: out, error: _formatError(e) }; }
        return { output: out, error: null };
      };
      var name = '<hooks_' + (++_runSeq) + '>';
      try {
        return sk.misceval.asyncToPromise(function () {
          return sk.importMainWithBody(name, false, src, true);
        }).then(function () { return finish(null); }, function (e) { return finish(e); });
      } catch (e) {
        return Promise.resolve(finish(e));
      }
    },

    /**
     * 把 Python 函数包装成积木执行器: function (params, scope) => 返回值|Promise。
     * 执行期间的 print 输出通过 onOutput 转发; 参数/返回值自动做 Python <-> JS 转换。
     * @param {Function|Object} pyFn _pyToJs 产出的包装函数（带 pythonCallable）或原始 Sk 函数对象
     * @param {Function} onOutput 可选, print 输出回调
     * @returns {Function|null} 包装失败返回 null
     */
    makeExecutor: function (pyFn, onOutput) {
      var sk;
      try { sk = _sk(); } catch (e) { return null; }
      var raw = (pyFn && pyFn.pythonCallable) ? pyFn.pythonCallable : pyFn;
      if (!raw || !_isPyCallable(sk, raw)) return null;
      var exec = function (params, scope) {
        var sink = [];
        var prev = sk.output;
        sk.output = function (t) {
          sink.push(String(t));
          if (onOutput) { try { onOutput(String(t)); } catch (e) { /* 忽略 */ } }
        };
        var restore = function () { sk.output = prev; };
        var pyArgs;
        try {
          pyArgs = [sk.ffi.remapToPy(_plainize(params, 2) || {}), sk.ffi.remapToPy(_plainize(scope, 2) || {})];
        } catch (e) {
          restore();
          throw new Error('[Python 扩展] 参数转换失败: ' + _formatError(e));
        }
        try {
          var r = sk.misceval.callsimArray(raw, pyArgs);
          if (r && typeof r.next$ === 'function' && sk.misceval.iterFor) {
            // 函数内碰到了 await/休眠类挂起 → 异步驱动到完成（executor 会 await 本返回值）
            return sk.misceval.asyncToPromise(function () {
              return sk.misceval.iterFor(r, function (y) { return y; });
            }).then(function (v) { restore(); return _pyToJs(sk, v, 0); }, function (e) {
              restore();
              throw new Error('[Python 扩展] ' + _formatError(e));
            });
          }
          restore();
          return _pyToJs(sk, r, 0);
        } catch (e) {
          restore();
          throw new Error('[Python 扩展] ' + _formatError(e));
        }
      };
      exec.__extLang = 'python';   // 标记为 Python 执行器（导出 HTML 时无法在浏览器内运行）
      return exec;
    },
  };

  /** 把 Python traceback 尾部附加到 output（Skulpt 异常自带 traceback 文本） */
  function _recordTraceback(e, out) {
    try {
      if (typeof Sk !== 'undefined' && e && e.unsafeStack === undefined && e.traceback_mod) {
        out.push(String(e));
      }
    } catch (err) { /* 忽略 */ }
  }

  // 注册全局（浏览器 script 标签 / Node 均可）
  if (typeof window !== 'undefined') window.PyRunner = PyRunner;
  if (typeof globalThis !== 'undefined' && !globalThis.PyRunner) globalThis.PyRunner = PyRunner;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PyRunner;
    module.exports.default = PyRunner;
  }
})();
