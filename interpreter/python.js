/**
 * python.js — Objector 代码编程模式的 Python 执行适配器
 *
 * 基于开源 Skulpt 解释器（MIT License, https://github.com/skulpt/skulpt）,
 * 纯 JavaScript 实现，在渲染进程内解释执行 Python 3 代码。
 *
 * 接口与 alb.js 对齐，支持向解释器内注入自定义常量 / 变量 / 函数:
 *   PyRunner.setFunc('move', (steps) => { ... });   // 注册原生函数（Python 可直接调用）
 *   PyRunner.setConst('STAGE_W', 480);              // 注册常量（每帧同步, Python 读取）
 *   PyRunner.setVar('score', 0);                    // 注册变量（每帧同步, Python 读取）
 *   PyRunner.run('print(move(10))');                // 执行代码, 返回 { output, error }
 *
 * 依赖: interpreter/skulpt.min.js + interpreter/skulpt-stdlib.js（可选, 提供 import 标准库）
 */
(function () {
  'use strict';

  var _configured = false;
  var _funcs = {};    // name -> JS function
  var _consts = {};   // name -> JS value
  var _vars = {};     // name -> JS value
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

    /** 注册原生函数（Python 代码中可直接按名字调用） */
    setFunc: function (name, fn) { _funcs[name] = fn; return PyRunner; },

    /** 注册常量（每次 run 前同步; Python 内对该名字的重新赋值只影响其局部） */
    setConst: function (name, value) { _consts[name] = value; return PyRunner; },

    /** 注册变量（每次 run 前同步, 语义同 setConst） */
    setVar: function (name, value) { _vars[name] = value; return PyRunner; },

    /** 读取当前注册的变量值 */
    getVar: function (name) { return _vars[name]; },

    /** 清除所有注入的函数/常量/变量 */
    clearInjected: function () {
      var name;
      for (name in _funcs) { delete _funcs[name]; delete Sk.builtins[name]; }
      for (name in _consts) { delete _consts[name]; delete Sk.builtins[name]; }
      for (name in _vars) { delete _vars[name]; delete Sk.builtins[name]; }
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
      try {
        return sk.misceval.asyncToPromise(function () {
          return sk.importMainWithBody(name, false, src, true);
        }).then(
          function () { return { output: out, error: null }; },
          function (e) { _recordTraceback(e, out); return { output: out, error: _formatError(e) }; }
        );
      } catch (e) {
        // 语法错误等在异步桥建立前同步抛出的情况
        _recordTraceback(e, out);
        return Promise.resolve({ output: out, error: _formatError(e) });
      }
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
