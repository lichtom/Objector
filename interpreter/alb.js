/**
 * alb.js — ALB 语言的纯 JavaScript 解释器
 *
 * 可在浏览器 / Node / 任意 ES Module 环境中导入，用于解释执行 ALB 代码。
 * 语义与 C++ 参考实现 (main.cpp) 保持一致。
 *
 * 用法:
 *   import ALB from './web-tool/alb.js';          // 默认导出解释器实例
 *   import { createALB } from './web-tool/alb.js'; // 创建独立实例
 *
 *   ALB.setVar('name', 'Tom');          // 定义变量
 *   ALB.setConst('PI2', 6.28);          // 定义常量（ALB 代码不可修改）
 *   ALB.setFunc('shout', s => s.toUpperCase() + '!');  // 注册原生函数
 *   ALB.run('(shout name)');            // 执行 ALB 代码
 *
 *   const xs = ALB.list(1, 2, 3);       // 构造 ALB list
 *   const m  = ALB.map({ a: 1 });       // 构造 ALB map
 *
 * @license MIT
 */

/* ==================================================================== *
 *  第一部分：值模型 / 环境 / 解析器 / 求值器
 * ==================================================================== */

// ---------------------------- 值构造 ----------------------------

const NIL = { k: 'nil' };

/** 数值 */
const vNum = (n) => ({ k: 'num', n: typeof n === 'number' ? n : Number(n) });
/** 字符串（sym=false）或符号（sym=true） */
const vStr = (s, sym = false) => ({ k: 'str', s: String(s), sym: !!sym });
/** 符号 */
const vSym = (s) => ({ k: 'str', s: String(s), sym: true });
/** 列表 */
const vList = (arr) => ({ k: 'list', list: arr ? arr.slice() : [] });
/** 映射 */
const vMap = (m) => ({
  k: 'map',
  map: m instanceof Map ? m : new Map(Object.entries(m || {})),
});
/** 向量 */
const vVector = (arr) => ({ k: 'vector', vec: arr ? arr.slice() : [] });
/** 结构体 */
const vStruct = (type, fields) => ({
  k: 'struct',
  stype: type,
  fields: fields instanceof Map ? fields : new Map(Object.entries(fields || {})),
});
/** 函数 */
const vFn = (fn) => ({ k: 'fn', fn });

/** 判断一个 JS 值是否为 ALB 内部值对象 */
const isAlbVal = (x) => !!x && typeof x === 'object' && typeof x.k === 'string';

/** ALB 真值判定：0 / "" / nil / 空 map / 空 vector 为假 */
function truthy(v) {
  if (!v) return false;
  switch (v.k) {
    case 'num': return v.n !== 0;
    case 'str': return v.s.length > 0;
    case 'nil': return false;
    case 'map': return v.map.size > 0;
    case 'vector': return v.vec.length > 0;
    default: return true;
  }
}

/** 值的字符串表示（与 C++ Val::str() 一致） */
function valStr(v) {
  if (!v) return 'nil';
  switch (v.k) {
    case 'num': {
      const d = v.n;
      if (Number.isNaN(d)) return 'nan';
      if (!Number.isFinite(d)) return d > 0 ? 'inf' : '-inf';
      if (Number.isInteger(d) && Math.abs(d) < 1e15) return String(d);
      return String(d);
    }
    case 'str': return v.s;
    case 'nil': return 'nil';
    case 'list': return '(' + v.list.map(valStr).join(' ') + ')';
    case 'fn': return v.fn ? '<fn:' + (v.fn.name || 'anon') + '>' : '<fn>';
    case 'map': {
      const parts = [];
      for (const [key, val] of v.map) parts.push(key + ': ' + valStr(val));
      return '{' + parts.join(', ') + '}';
    }
    case 'struct': {
      const parts = [];
      for (const [key, val] of v.fields) parts.push(key + ':' + valStr(val));
      return '<' + v.stype + '{' + parts.join(', ') + '}>';
    }
    case 'vector': return '#[' + v.vec.map(valStr).join(' ') + ']';
  }
  return '?';
}

// ---------------------------- 错误 ----------------------------

class ALBError extends Error {
  constructor(type, message, data) {
    super(message || '');
    this.name = 'ALBError';
    this.type = type || 'Error';
    this.albMessage = message || '';
    this.data = data === undefined ? NIL : data;
  }
  /** 转换为 ALB map: {type, message, data} */
  toVal() {
    return vMap(new Map([
      ['type', vStr(this.type)],
      ['message', vStr(this.albMessage)],
      ['data', this.data || NIL],
    ]));
  }
  toString() {
    return this.type + ': ' + this.albMessage;
  }
}

/** break 信号（内部使用） */
class BreakSignal {}
const BREAK = new BreakSignal();

// ---------------------------- 环境 ----------------------------

class Env {
  constructor(parent) {
    this.vars = new Map();
    this.consts = new Set();
    this.macros = new Map();
    this.exports = new Set();
    this.parent = parent || null;
  }
  get(name) {
    if (this.vars.has(name)) return this.vars.get(name);
    if (this.parent) return this.parent.get(name);
    throw new ALBError('NameError', 'Undefined: ' + name);
  }
  /** 沿作用域链查找并更新；找不到则在当前作用域创建 */
  set(name, val) {
    if (this.vars.has(name)) {
      if (this.consts.has(name))
        throw new ALBError('ConstError', 'Cannot modify const: ' + name);
      this.vars.set(name, val);
      return;
    }
    if (this.parent) { this.parent.set(name, val); return; }
    this.vars.set(name, val);
  }
  setLocal(name, val) { this.vars.set(name, val); }
  setConst(name, val) { this.vars.set(name, val); this.consts.add(name); }
  unsetConst(name) { this.consts.delete(name); }
  has(name) {
    if (this.vars.has(name)) return true;
    return this.parent ? this.parent.has(name) : false;
  }
  getMacro(name) {
    if (this.macros.has(name)) return this.macros.get(name);
    return this.parent ? this.parent.getMacro(name) : null;
  }
}

// ---------------------------- 解析器 ----------------------------

const NUM_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const HEX_RE = /^[+-]?0[xX][0-9a-fA-F]+$/;
const INF_RE = /^([+-]?)(inf|infinity|nan)$/i;

/** 尝试把 token 解析为数字；失败返回 null */
function tryNumber(tok) {
  if (NUM_RE.test(tok)) return Number(tok);
  if (HEX_RE.test(tok)) return Number(tok);
  const m = INF_RE.exec(tok);
  if (m) {
    if (/nan/i.test(m[2])) return NaN;
    return m[1] === '-' ? -Infinity : Infinity;
  }
  return null;
}

const isSpace = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v';

class Parser {
  constructor(src) {
    this.src = String(src);
    this.pos = 0;
    this.ln = 1;
  }
  pk() { return this.pos < this.src.length ? this.src[this.pos] : '\0'; }
  nx() { return this.pos < this.src.length ? this.src[this.pos++] : '\0'; }
  eof() { return this.pos >= this.src.length; }

  /** 跳过空白与 ; 注释 */
  ws() {
    while (this.pos < this.src.length) {
      const c = this.src[this.pos];
      if (c === ';') {
        while (this.pos < this.src.length && this.src[this.pos] !== '\n') this.pos++;
      } else if (isSpace(c)) {
        if (c === '\n') this.ln++;
        this.pos++;
      } else break;
    }
  }

  parse() {
    this.ws();
    if (this.eof()) return NIL;
    const c = this.pk();

    // 列表
    if (c === '(') {
      this.nx(); this.ws();
      const arr = [];
      while (!this.eof() && this.pk() !== ')') {
        if (this.pk() === '\0') break;
        arr.push(this.parse());
        this.ws();
      }
      if (this.pk() === ')') this.nx();
      return vList(arr);
    }

    // 字符串
    if (c === '"') {
      this.nx();
      let s = '';
      while (!this.eof() && this.pk() !== '"') {
        if (this.pk() === '\\') {
          this.nx();
          const e = this.nx();
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r'
            : e === '\\' ? '\\' : e === '"' ? '"' : e;
        } else {
          if (this.pk() === '\n') this.ln++;
          s += this.nx();
        }
      }
      if (this.pk() === '"') this.nx();
      return vStr(s);
    }

    // 反引号：`( ... ) 为准引用，`text ${expr}` 为字符串插值
    if (c === '`') {
      this.nx();
      const after = this.pos;
      while (!this.eof() && (this.pk() === ' ' || this.pk() === '\t')) this.nx();
      if (this.pk() === '(') {
        this.pos = after;
        while (!this.eof() && (this.pk() === ' ' || this.pk() === '\t')) this.nx();
        const inner = this.parse();
        return vList([vSym('quasiquote'), inner]);
      }
      this.pos = after;
      let s = '';
      const parts = [];
      let hasInterp = false;
      while (!this.eof() && this.pk() !== '`') {
        if (this.pk() === '$' && this.pos + 1 < this.src.length && this.src[this.pos + 1] === '{') {
          hasInterp = true;
          if (s) { parts.push(vStr(s)); s = ''; }
          this.nx(); this.nx();
          let exprStr = '';
          let depth = 1;
          while (!this.eof() && depth > 0) {
            if (this.pk() === '{') depth++;
            else if (this.pk() === '}') { depth--; if (depth === 0) { this.nx(); break; } }
            exprStr += this.nx();
          }
          parts.push(new Parser(exprStr).parse());
        } else {
          if (this.pk() === '\n') this.ln++;
          s += this.nx();
        }
      }
      if (this.pk() === '`') this.nx();
      if (!hasInterp) return vStr(s);
      if (s) parts.push(vStr(s));
      return vList([vSym('str'), ...parts]);
    }

    // Heredoc: <<DELIM ... DELIM
    if (c === '<' && this.pos + 1 < this.src.length && this.src[this.pos + 1] === '<') {
      this.nx(); this.nx();
      let delim = '';
      while (!this.eof() && !isSpace(this.pk())) delim += this.nx();
      if (this.pk() === '\r') this.nx();
      if (this.pk() === '\n') { this.ln++; this.nx(); }
      let content = '';
      while (!this.eof()) {
        let line = '';
        while (!this.eof() && this.pk() !== '\n') line += this.nx();
        if (this.pk() === '\n') { this.ln++; this.nx(); }
        if (line.replace(/\s+$/, '') === delim) break;
        if (content) content += '\n';
        content += line;
      }
      return vStr(content);
    }

    // 引用
    if (c === "'") {
      this.nx();
      return vList([vSym('quote'), this.parse()]);
    }

    // 反引用
    if (c === ',') {
      this.nx();
      if (this.pk() === '@') {
        this.nx();
        return vList([vSym('unquote-splicing'), this.parse()]);
      }
      return vList([vSym('unquote'), this.parse()]);
    }

    // 原子 token
    let tok = '';
    while (!this.eof() && !isSpace(this.pk()) && this.pk() !== '(' && this.pk() !== ')'
      && this.pk() !== '\r' && this.pk() !== ',') {
      tok += this.nx();
    }
    if (!tok) return NIL;
    const n = tryNumber(tok);
    if (n !== null && !Number.isNaN(n)) return vNum(n);
    if (n !== null && Number.isNaN(n)) return vNum(NaN);
    return vSym(tok);
  }

  parseAll() {
    const exprs = [];
    for (;;) {
      this.ws();
      if (this.eof()) break;
      const before = this.pos;
      exprs.push(this.parse());
      if (this.pos === before) break; // 防御：无进展则退出
    }
    return exprs;
  }
}

// ---------------------------- 函数对象 ----------------------------

function makeFunc(opts) {
  return Object.assign({
    name: '',
    native: null,
    params: [],
    body: [],
    closure: null,
    isNative: false,
    isMacro: false,
    doc: '',
    caps: [],
    kwParams: [],      // [[name, defaultExpr], ...]
    rest: '',          // &rest 参数名
    macroBody: null,
    isStructCtor: false,
    structFields: [],
  }, opts || {});
}

/** 提取文档字符串：(func (params) "doc" (body...)) */
function extractDoc(f, env) {
  if (f.body.length >= 2
    && f.body[0].k === 'str' && !f.body[0].sym
    && f.body[1].k === 'list'
    && !env.has(f.body[0].s)) {
    f.doc = f.body[0].s;
    f.body.shift();
  }
}

/** 是否为对自身命名的尾递归调用 */
function isSelfCall(expr, name) {
  if (!name) return null;
  if (expr && expr.k === 'list' && expr.list.length
    && expr.list[0].k === 'str' && expr.list[0].sym && expr.list[0].s === name) return expr;
  return null;
}

// ---------------------------- 模式匹配 ----------------------------

function patMatch(val, pat, env) {
  if (!pat) return !val || val.k === 'nil';
  if (pat.k === 'str') {
    if (pat.sym) return true;                       // 符号 = 通配/变量
    return !!val && val.k === 'str' && !val.sym && val.s === pat.s;
  }
  if (pat.k === 'num') return !!val && val.k === 'num' && val.n === pat.n;
  if (pat.k === 'list') {
    const pl = pat.list;
    if (!val || val.k !== 'list') {
      // 结构体模式：(StructName f1 f2 ...)
      if (val && val.k === 'struct' && pl.length && pl[0].k === 'str' && pl[0].sym) {
        let st = null;
        try { st = env.get(pl[0].s); } catch (e) { st = null; }
        if (st && st.k === 'fn' && st.fn && st.fn.isStructCtor) {
          if (val.stype !== pl[0].s) return false;
          const names = st.fn.structFields;
          if (names.length !== pl.length - 1) return false;
          for (let i = 0; i < names.length; i++) {
            if (!val.fields.has(names[i])) return false;
            if (!patMatch(val.fields.get(names[i]), pl[i + 1], env)) return false;
          }
          return true;
        }
      }
      return false;
    }
    const vl = val.list;
    let pstart = 0;
    if (pl.length && pl[0].k === 'str' && pl[0].sym && pl[0].s === 'list') pstart = 1;
    let pi = pstart;
    for (let vi = 0; pi < pl.length; pi++, vi++) {
      if (pl[pi].k === 'str' && pl[pi].sym && pl[pi].s === '$') return true;
      if (vi >= vl.length) return false;
      if (!patMatch(vl[vi], pl[pi], env)) return false;
    }
    return vl.length <= (pl.length - pstart);
  }
  return false;
}

function patBind(val, pat, env) {
  if (!pat) return;
  if (pat.k === 'str') {
    if (!pat.sym) return;
    if (pat.s !== '_') env.setLocal(pat.s, val || NIL);
    return;
  }
  if (pat.k === 'list' && val) {
    const pl = pat.list;
    if (val.k === 'struct' && pl.length && pl[0].k === 'str' && pl[0].sym) {
      let st = null;
      try { st = env.get(pl[0].s); } catch (e) { st = null; }
      if (st && st.k === 'fn' && st.fn && st.fn.isStructCtor) {
        const names = st.fn.structFields;
        for (let i = 0; i < names.length && i + 1 < pl.length; i++) {
          if (val.fields.has(names[i])) patBind(val.fields.get(names[i]), pl[i + 1], env);
        }
        return;
      }
    }
    if (val.k !== 'list') return;
    const vl = val.list;
    let pstart = 0;
    if (pl.length && pl[0].k === 'str' && pl[0].sym && pl[0].s === 'list') pstart = 1;
    let pi = pstart;
    for (let vi = 0; pi < pl.length; pi++, vi++) {
      if (pl[pi].k === 'str' && pl[pi].sym && pl[pi].s === '$') {
        if (pi + 1 < pl.length && pl[pi + 1].k === 'str' && pl[pi + 1].sym && pl[pi + 1].s !== '_') {
          env.setLocal(pl[pi + 1].s, vList(vl.slice(Math.min(vi, vl.length))));
        }
        return;
      }
      if (vi < vl.length) patBind(vl[vi], pl[pi], env);
    }
  }
}

/** 宏展开时的符号替换 */
function macroSubst(expr, bindings) {
  if (!expr) return NIL;
  if (expr.k === 'str' && expr.sym) {
    return bindings.has(expr.s) ? bindings.get(expr.s) : expr;
  }
  if (expr.k === 'list') {
    const out = [];
    if (expr.list.length && expr.list[0].k === 'str' && expr.list[0].sym) {
      const h = expr.list[0].s;
      if (h === 'unquote' || h === 'unquote-splicing' || h === 'quasiquote' || h === 'quote') {
        out.push(expr.list[0]);
        for (let i = 1; i < expr.list.length; i++) out.push(macroSubst(expr.list[i], bindings));
        return vList(out);
      }
    }
    for (const el of expr.list) out.push(macroSubst(el, bindings));
    return vList(out);
  }
  return expr;
}

/** 深拷贝（用于保护未求值的模式） */
function cloneVal(v) {
  if (!v) return NIL;
  switch (v.k) {
    case 'nil': return NIL;
    case 'num': return vNum(v.n);
    case 'str': return vStr(v.s, v.sym);
    case 'list': return vList(v.list.map(cloneVal));
    case 'vector': return vVector(v.vec.map(cloneVal));
    case 'map': {
      const m = new Map();
      for (const [key, val] of v.map) m.set(key, cloneVal(val));
      return vMap(m);
    }
    case 'struct': return vStruct(v.stype, cloneFields(v.fields));
    default: return v;
  }
}
function cloneFields(fields) {
  const m = new Map();
  for (const [key, val] of fields) m.set(key, cloneVal(val));
  return m;
}

// ============================ 函数调用 ============================

function funcCall(fnVal, args, env) {
  const f = fnVal.fn;
  if (f.native) return f.native(args, env);

  // TCO：直接自递归循环
  let curArgs = args.slice();
  while (true) {
    const local = new Env(f.closure || env);
    const npos = f.params.length;
    for (let i = 0; i < npos; i++)
      local.setLocal(f.params[i], i < curArgs.length ? curArgs[i] : NIL);

    let ai = npos;
    if (f.kwParams.length) {
      const kwArgs = new Map();
      while (ai < curArgs.length) {
        const arg = curArgs[ai];
        if (arg.k === 'str' && arg.sym && arg.s.length && arg.s[0] === ':' && ai + 1 < curArgs.length) {
          kwArgs.set(arg.s.substring(1), curArgs[ai + 1]);
          ai += 2;
        } else break;
      }
      for (const [name, def] of f.kwParams) {
        if (kwArgs.has(name)) local.setLocal(name, kwArgs.get(name));
        else local.setLocal(name, def ? evalExpr(def, local) : NIL);
      }
    } else ai = curArgs.length;

    if (f.rest) {
      const restArgs = ai < curArgs.length ? curArgs.slice(ai) : [];
      local.setLocal(f.rest, vList(restArgs));
    }

    // 执行 body（带 TCO 检查）
    let r = NIL;
    for (let bi = 0; bi < f.body.length; bi++) {
      if (bi === f.body.length - 1 && !f.isMacro) {
        const sc = isSelfCall(f.body[bi], f.name);
        if (sc) {
          const newArgs = [];
          for (let j = 1; j < sc.list.length; j++) newArgs.push(evalExpr(sc.list[j], local));
          curArgs = newArgs;
          continue;
        }
        // if 分支内的尾递归
        if (f.body[bi].k === 'list' && f.body[bi].list.length && f.body[bi].list[0].k === 'str' && f.body[bi].list[0].s === 'if') {
          const cond = evalExpr(f.body[bi].list[1], local);
          if (truthy(cond)) {
            if (f.body[bi].list.length > 2) {
              const sc2 = isSelfCall(f.body[bi].list[2], f.name);
              if (sc2) {
                const newArgs = [];
                for (let j = 1; j < sc2.list.length; j++) newArgs.push(evalExpr(sc2.list[j], local));
                curArgs = newArgs;
                break;
              }
              return evalExpr(f.body[bi].list[2], local);
            }
            return NIL;
          } else {
            if (f.body[bi].list.length > 3) {
              const sc3 = isSelfCall(f.body[bi].list[3], f.name);
              if (sc3) {
                const newArgs = [];
                for (let j = 1; j < sc3.list.length; j++) newArgs.push(evalExpr(sc3.list[j], local));
                curArgs = newArgs;
                break;
              }
              return evalExpr(f.body[bi].list[3], local);
            }
            return NIL;
          }
        }
      }
      r = evalExpr(f.body[bi], local);
    }
    return r;
  }
}

// ============================ 求值器 ============================

function evalExpr(expr, env) {
  if (!expr || expr.k === 'nil') return NIL;
  if (expr.k === 'num') return expr;
  if (expr.k === 'str') {
    if (expr.sym) return env.has(expr.s) ? env.get(expr.s) : expr;
    return expr;
  }
  if (expr.k !== 'list' || expr.list.length === 0) return expr;

  const items = expr.list;
  const head = (items[0].k === 'str') ? items[0].s : '';

  // --- 特殊形式 ---
  if (head === 'let') {
    const name = items[1].s;
    // 箭头语法: (let name (list a b) => (body))
    if (items.length >= 5 && items[3].k === 'str' && items[3].sym && items[3].s === '=>') {
      const f = makeFunc({ name });
      if (items[2].k === 'list') {
        const plist = items[2].list;
        const start = (plist.length && plist[0].k === 'str' && plist[0].sym && plist[0].s === 'list') ? 1 : 0;
        for (let i = start; i < plist.length; i++) f.params.push(plist[i].s);
      }
      const bodyExpr = items[4];
      if (bodyExpr.k === 'list') {
        const allLists = bodyExpr.list.every(el => el.k === 'list');
        f.body = allLists && bodyExpr.list.length ? bodyExpr.list.slice() : [bodyExpr];
      } else f.body = [bodyExpr];
      extractDoc(f, env);
      f.closure = env;
      const v = vFn(f);
      env.setLocal(name, v);
      return v;
    }
    const val = items.length > 2 ? evalExpr(items[2], env) : NIL;
    env.setLocal(name, val);
    return val;
  }

  if (head === 'define') {
    if (items[1].k === 'list') {
      const sig = items[1].list;
      if (!sig.length) throw new ALBError('SyntaxError', 'define: empty signature');
      const name = sig[0].s;
      const f = makeFunc({ name });
      for (let i = 1; i < sig.length; i++) f.params.push(sig[i].s);
      for (let i = 2; i < items.length; i++) f.body.push(items[i]);
      extractDoc(f, env);
      f.closure = env;
      const v = vFn(f);
      env.setLocal(name, v);
      return v;
    } else {
      const name = items[1].s;
      const val = items.length > 2 ? evalExpr(items[2], env) : NIL;
      env.setLocal(name, val);
      return val;
    }
  }

  if (head === 'let*') {
    const local = new Env(env);
    const bindings = items[1].list;
    for (const b of bindings) {
      if (b.k !== 'list' || b.list.length < 2)
        throw new ALBError('SyntaxError', 'let*: expected (name value) pair');
      local.setLocal(b.list[0].s, evalExpr(b.list[1], local));
    }
    let r = NIL;
    for (let i = 2; i < items.length; i++) r = evalExpr(items[i], local);
    return r;
  }

  if (head === 'letrec') {
    const local = new Env(env);
    const bindings = items[1].list;
    for (const b of bindings) {
      if (b.k !== 'list' || b.list.length < 2)
        throw new ALBError('SyntaxError', 'letrec: expected (name value) pair');
      local.setLocal(b.list[0].s, NIL);
    }
    for (const b of bindings) local.setLocal(b.list[0].s, evalExpr(b.list[1], local));
    let r = NIL;
    for (let i = 2; i < items.length; i++) r = evalExpr(items[i], local);
    return r;
  }

  if (head === 'cond') {
    for (let i = 1; i < items.length; i++) {
      const clause = items[i];
      if (clause.k !== 'list' || !clause.list.length)
        throw new ALBError('SyntaxError', 'cond: expected (test expr) clause');
      const test = clause.list[0];
      if (test.k === 'str' && test.sym && test.s === 'else') {
        let r = NIL;
        for (let j = 1; j < clause.list.length; j++) r = evalExpr(clause.list[j], env);
        return r;
      }
      if (truthy(evalExpr(test, env))) {
        let r = NIL;
        for (let j = 1; j < clause.list.length; j++) r = evalExpr(clause.list[j], env);
        return r;
      }
    }
    return NIL;
  }

  if (head === 'set') {
    const name = items[1].s;
    const val = evalExpr(items[2], env);
    env.set(name, val);
    return val;
  }

  if (head === '+=' || head === '-=' || head === '*=' || head === '/=') {
    const name = items[1].s;
    const cur = env.get(name);
    const rhs = evalExpr(items[2], env);
    let result;
    if (head === '+=' && (cur.k === 'str' || rhs.k === 'str')) {
      const v = vStr(valStr(cur) + valStr(rhs));
      env.set(name, v);
      return v;
    }
    if (head === '+=') result = cur.n + rhs.n;
    else if (head === '-=') result = cur.n - rhs.n;
    else if (head === '*=') result = cur.n * rhs.n;
    else { if (rhs.n === 0) throw new ALBError('ArithmeticError', 'Division by zero'); result = cur.n / rhs.n; }
    const v = vNum(result);
    env.set(name, v);
    return v;
  }

  if (head === 'func') {
    const f = makeFunc({});
    let pi = 1;
    // 命名函数: (func name a b (body))
    if (pi < items.length && items[pi].k === 'str' && items[pi].sym
      && pi + 1 < items.length && items[pi + 1].k === 'str' && items[pi + 1].sym
      && items[pi + 1].s.length && items[pi + 1].s[0] !== ':') {
      f.name = items[pi].s;
      pi++;
      while (pi < items.length && items[pi].k === 'str' && items[pi].sym) f.params.push(items[pi++].s);
      if (pi < items.length) {
        if (pi + 1 >= items.length && items[pi].k === 'list') {
          const allLists = items[pi].list.every(el => el.k === 'list');
          f.body = allLists && items[pi].list.length ? items[pi].list.slice() : [items[pi]];
        } else f.body = items.slice(pi);
      }
      extractDoc(f, env);
      f.closure = env;
      return vFn(f);
    }
    // 能力标签 :pure :io :sys :ffi
    while (pi < items.length && items[pi].k === 'str' && items[pi].s.length && items[pi].s[0] === ':') {
      f.caps.push(items[pi].s.substring(1));
      pi++;
    }
    // 参数列表
    if (pi < items.length && items[pi].k === 'list') {
      const plist = items[pi].list;
      let start = 0;
      if (plist.length && plist[0].k === 'str' && plist[0].sym && plist[0].s === 'list') start = 1;
      let seenKw = false;
      for (let i = start; i < plist.length; i++) {
        const ps = plist[i].s;
        if (ps === '&rest' && i + 1 < plist.length) { f.rest = plist[++i].s; break; }
        if (ps.length && ps[0] === ':' && !seenKw) seenKw = true;
        if (seenKw && ps.length && ps[0] === ':') {
          f.kwParams.push([ps.substring(1), i + 1 < plist.length ? plist[++i] : NIL]);
        } else f.params.push(ps);
      }
      pi++;
    }
    if (pi < items.length) f.body = items.slice(pi);
    extractDoc(f, env);
    f.closure = env;
    return vFn(f);
  }

  if (head === 'const') {
    const name = items[1].s;
    const val = items.length > 2 ? evalExpr(items[2], env) : NIL;
    env.setConst(name, val);
    return val;
  }

  if (head === 'if') {
    const cond = evalExpr(items[1], env);
    return truthy(cond) ? (items.length > 2 ? evalExpr(items[2], env) : NIL)
      : (items.length > 3 ? evalExpr(items[3], env) : NIL);
  }

  if (head === 'when') {
    if (truthy(evalExpr(items[1], env))) {
      let r = NIL;
      for (let i = 2; i < items.length; i++) r = evalExpr(items[i], env);
      return r;
    }
    return NIL;
  }

  if (head === 'while') {
    let r = NIL;
    try {
      while (truthy(evalExpr(items[1], env)))
        try { for (let i = 2; i < items.length; i++) r = evalExpr(items[i], env); }
        catch (e) { if (e instanceof BreakSignal) break; throw e; }
    } catch (e) { if (!(e instanceof BreakSignal)) throw e; }
    return r;
  }

  if (head === 'for-i') {
    if (items.length < 2 || items[1].k !== 'list' || items[1].list.length < 4)
      throw new ALBError('SyntaxError', 'for-i: expected (var init cond step)');
    const spec = items[1].list;
    const varName = spec[0].s;
    const local = new Env(env);
    local.setLocal(varName, evalExpr(spec[1], env));
    let r = NIL;
    try {
      while (truthy(evalExpr(spec[2], local))) {
        try {
          for (let i = 2; i < items.length; i++) r = evalExpr(items[i], local);
          evalExpr(spec[3], local);
        } catch (e) { if (e instanceof BreakSignal) break; throw e; }
      }
    } catch (e) { if (!(e instanceof BreakSignal)) throw e; }
    return r;
  }

  if (head === 'do') {
    let r = NIL;
    for (let i = 1; i < items.length; i++) r = evalExpr(items[i], env);
    return r;
  }

  if (head === 'def') return evalExpr(vList([vSym('let'), items[1], items[2]]), env);

  if (head === 'try') {
    const tryBody = items[1];
    const catchClause = items.length > 2 ? items[2] : null;
    const finallyClause = items.length > 3 ? items[3] : null;
    let r = NIL;
    try { r = evalExpr(tryBody, env); }
    catch (e) {
      if (catchClause && catchClause.k === 'list' && catchClause.list.length >= 3
        && catchClause.list[0].k === 'str' && catchClause.list[0].s === 'catch') {
        const local = new Env(env);
        const errVal = e instanceof ALBError ? e.toVal() : vMap({ type: vStr('RuntimeError'), message: vStr(e.message) });
        local.setLocal(catchClause.list[1].s, errVal);
        for (let i = 2; i < catchClause.list.length; i++) r = evalExpr(catchClause.list[i], local);
      } else throw e;
    }
    if (finallyClause) {
      if (finallyClause.k === 'list' && finallyClause.list.length
        && finallyClause.list[0].k === 'str' && finallyClause.list[0].s === 'finally') {
        for (let i = 1; i < finallyClause.list.length; i++) evalExpr(finallyClause.list[i], env);
      } else evalExpr(finallyClause, env);
    }
    return r;
  }

  if (head === 'match') {
    const val = evalExpr(items[1], env);
    for (let i = 2; i + 1 < items.length; i += 2) {
      const pat = cloneVal(items[i]);
      const local = new Env(env);
      if (patMatch(val, pat, local)) {
        patBind(val, pat, local);
        return evalExpr(items[i + 1], local);
      }
    }
    throw new ALBError('MatchError', 'No matching pattern for: ' + valStr(val));
  }

  if (head === 'use') {
    throw new ALBError('ModuleError', 'use not available in web interpreter (use ALB.use())');
  }

  if (head === 'quote') return items.length > 1 ? items[1] : NIL;

  if (head === 'quasiquote') {
    if (items.length < 2) return NIL;
    const expand = (tmpl) => {
      if (!tmpl || tmpl.k !== 'list') return tmpl;
      if (!tmpl.list.length) return tmpl;
      if (tmpl.list[0].k === 'str' && tmpl.list[0].s === 'unquote') {
        if (tmpl.list.length < 2) return NIL;
        const inner = tmpl.list[1];
        // 符号先在 env 中查找（宏参数替换），否则保持原样（依赖双重求值）
        if (inner.k === 'str' && inner.sym) return env.has(inner.s) ? env.get(inner.s) : inner;
        // 数字直接返回
        if (inner.k === 'num') return inner;
        // 其他表达式保持原样（与 C++ 一致，依赖调用方双重求值）
        return inner;
      }
      const result = [];
      for (let i = 0; i < tmpl.list.length; i++) {
        const elem = tmpl.list[i];
        if (elem.k === 'list' && elem.list.length && elem.list[0].k === 'str' && elem.list[0].s === 'unquote-splicing') {
          if (elem.list.length < 2) continue;
          const inner = elem.list[1];
          let spliced = inner;
          if (inner.k === 'str' && inner.sym && env.has(inner.s)) spliced = env.get(inner.s);
          if (spliced.k === 'list') result.push(...spliced.list);
          else if (spliced.k === 'vector') result.push(...spliced.vec);
        } else result.push(expand(elem));
      }
      return vList(result);
    };
    return expand(items[1]);
  }

  if (head === 'list') {
    const r = [];
    for (let i = 1; i < items.length; i++) r.push(evalExpr(items[i], env));
    return vList(r);
  }

  if (head === 'defmacro') {
    const name = items[1].s;
    const f = makeFunc({ name, isMacro: true });
    if (items[2].k === 'list') {
      const plist = items[2].list;
      const start = (plist.length && plist[0].k === 'str' && plist[0].sym && plist[0].s === 'list') ? 1 : 0;
      for (let i = start; i < plist.length; i++) f.params.push(plist[i].s);
    }
    if (items.length > 3) {
      const bodyExprs = items.slice(3);
      f.macroBody = bodyExprs.length === 1 ? bodyExprs[0] : vList([vSym('do'), ...bodyExprs]);
    } else f.macroBody = NIL;
    env.macros.set(name, vFn(f));
    return NIL;
  }

  if (head === 'export') {
    for (let i = 1; i < items.length; i++) {
      if (items[i].k === 'str') env.exports.add(items[i].s);
    }
    return NIL;
  }

  if (head === 'struct') {
    const name = items[1].s;
    const fieldNames = [];
    if (items[2].k === 'list') {
      const flist = items[2].list;
      // 跳过开头的 list 关键字
      const fstart = (flist.length && flist[0].k === 'str' && flist[0].sym && flist[0].s === 'list') ? 1 : 0;
      for (let fi = fstart; fi < flist.length; fi++) if (flist[fi].k === 'str') fieldNames.push(flist[fi].s);
    }
    const ctor = (args) => {
      const fields = new Map();
      for (let i = 0; i < fieldNames.length; i++)
        fields.set(fieldNames[i], i < args.length ? args[i] : NIL);
      return vStruct(name, fields);
    };
    const ctorFn = makeFunc({ name, native: ctor, isNative: true, isStructCtor: true, structFields: fieldNames });
    env.setLocal(name, vFn(ctorFn));
    // 类型谓词
    const pred = (args) => vNum(args.length && args[0].k === 'struct' && args[0].stype === name ? 1 : 0);
    env.setLocal(name + '?', vFn(makeFunc({ name: name + '?', native: pred, isNative: true })));
    // 字段访问器
    for (const fname of fieldNames) {
      const acc = (args) => {
        if (!args.length || args[0].k !== 'struct' || args[0].stype !== name)
          throw new ALBError('TypeError', name + '-' + fname + ': expected ' + name + ' struct');
        return args[0].fields.has(fname) ? args[0].fields.get(fname) : NIL;
      };
      env.setLocal(name + '-' + fname, vFn(makeFunc({ name: name + '-' + fname, native: acc, isNative: true })));
    }
    return NIL;
  }

  // --- 宏展开 ---
  if (items[0].k === 'str' && items[0].sym) {
    const macroFn = env.getMacro(head);
    if (macroFn && macroFn.k === 'fn' && macroFn.fn.isMacro) {
      const mf = macroFn.fn;
      const bindings = new Map();
      const unevalArgs = items.slice(1);
      for (let i = 0; i < mf.params.length; i++)
        bindings.set(mf.params[i], i < unevalArgs.length ? unevalArgs[i] : NIL);
      const expanded = macroSubst(mf.macroBody, bindings);
      const result = evalExpr(expanded, env);
      if (result.k === 'list' && result.list.length) return evalExpr(result, env);
      return result;
    }
  }

  // --- 函数调用 ---
  const fnVal = evalExpr(items[0], env);
  if (!fnVal || fnVal.k !== 'fn')
    throw new ALBError('TypeError', 'Not callable: ' + (fnVal ? valStr(fnVal) : 'nil'));
  const args = [];
  for (let i = 1; i < items.length; i++) args.push(evalExpr(items[i], env));
  return funcCall(fnVal, args, env);
}

// ============================ 内建函数 ============================

function registerBuiltins(env) {
  const reg = (name, fn) => env.setConst(name, vFn(makeFunc({ name, native: fn, isNative: true })));

  // I/O
  reg('print', (a) => { console.log(a.map(valStr).join(' ')); return NIL; });
  reg('prints', (a) => { process.stdout ? process.stdout.write(a.map(valStr).join(' ')) : console.log(a.map(valStr).join(' ')); return NIL; });
  reg('input', (a) => { throw new ALBError('NotSupportedError', 'input not available in web'); });
  reg('press', (a) => NIL);

  // Type & len
  reg('type', (a) => {
    if (!a.length) return vStr('nil');
    const v = a[0];
    if (v.k === 'struct') return vStr(v.stype);
    return vStr(v.k === 'str' && v.sym ? 'sym' : v.k);
  });
  reg('len', (a) => {
    if (!a.length) return vNum(0);
    const v = a[0];
    if (v.k === 'str') return vNum(v.s.length);
    if (v.k === 'list') return vNum(v.list.length);
    if (v.k === 'map') return vNum(v.map.size);
    if (v.k === 'vector') return vNum(v.vec.length);
    if (v.k === 'struct') return vNum(v.fields.size);
    return vNum(0);
  });

  // Arithmetic
  reg('+', (a) => {
    if (a.length >= 2 && (a[0].k === 'str' || a[1].k === 'str')) return vStr(valStr(a[0]) + valStr(a[1]));
    let r = 0; for (const v of a) r += v.n || 0; return vNum(r);
  });
  reg('-', (a) => {
    if (a.length === 1) return vNum(-a[0].n);
    let r = a[0].n; for (let i = 1; i < a.length; i++) r -= a[i].n; return vNum(r);
  });
  reg('*', (a) => { let r = 1; for (const v of a) r *= v.n || 1; return vNum(r); });
  reg('/', (a) => {
    if (a.length < 2 || a[1].n === 0) throw new ALBError('ArithmeticError', 'Division error');
    return vNum(a[0].n / a[1].n);
  });
  reg('%', (a) => {
    if (a.length < 2 || a[1].n === 0) throw new ALBError('ArithmeticError', 'Modulo error');
    return vNum(a[0].n % a[1].n);
  });
  reg('^', (a) => a.length < 2 ? vNum(0) : vNum(Math.pow(a[0].n, a[1].n)));

  // Comparison
  reg('==', (a) => vNum(valStr(a[0]) === valStr(a[1]) ? 1 : 0));
  reg('!=', (a) => vNum(valStr(a[0]) !== valStr(a[1]) ? 1 : 0));
  reg('<', (a) => vNum(a[0].n < a[1].n ? 1 : 0));
  reg('>', (a) => vNum(a[0].n > a[1].n ? 1 : 0));
  reg('<=', (a) => vNum(a[0].n <= a[1].n ? 1 : 0));
  reg('>=', (a) => vNum(a[0].n >= a[1].n ? 1 : 0));

  // Logic
  reg('and', (a) => { for (const v of a) if (!truthy(v)) return vNum(0); return vNum(1); });
  reg('or', (a) => { for (const v of a) if (truthy(v)) return vNum(1); return vNum(0); });
  reg('not', (a) => vNum(!truthy(a[0]) ? 1 : 0));

  // Math
  reg('sqrt', (a) => vNum(Math.sqrt(a[0].n)));
  reg('abs', (a) => vNum(Math.abs(a[0].n)));
  reg('floor', (a) => vNum(Math.floor(a[0].n)));
  reg('ceil', (a) => vNum(Math.ceil(a[0].n)));
  reg('round', (a) => vNum(Math.round(a[0].n)));
  reg('sin', (a) => vNum(Math.sin(a[0].n)));
  reg('cos', (a) => vNum(Math.cos(a[0].n)));
  reg('tan', (a) => vNum(Math.tan(a[0].n)));
  reg('asin', (a) => vNum(Math.asin(a[0].n)));
  reg('acos', (a) => vNum(Math.acos(a[0].n)));
  reg('atan', (a) => vNum(Math.atan(a[0].n)));
  reg('atan2', (a) => vNum(Math.atan2(a[0].n, a[1].n)));
  reg('exp', (a) => vNum(Math.exp(a[0].n)));
  reg('log', (a) => vNum(Math.log(a[0].n)));
  reg('log2', (a) => vNum(Math.log2(a[0].n)));
  reg('log10', (a) => vNum(Math.log10(a[0].n)));
  reg('min', (a) => vNum(Math.min(...a.map(v => v.n))));
  reg('max', (a) => vNum(Math.max(...a.map(v => v.n))));
  reg('clamp', (a) => vNum(Math.max(a[1].n, Math.min(a[2].n, a[0].n))));
  reg('random', (a) => vNum(Math.random()));
  reg('random-int', (a) => {
    const min = a.length > 1 ? a[0].n : 0;
    const max = a.length > 1 ? a[1].n : a[0].n;
    return vNum(Math.floor(Math.random() * (max - min)) + min);
  });

  // Bit ops
  reg('bit-and', (a) => vNum(a[0].n & a[1].n));
  reg('bit-or', (a) => vNum(a[0].n | a[1].n));
  reg('bit-xor', (a) => vNum(a[0].n ^ a[1].n));
  reg('bit-not', (a) => vNum(~a[0].n));
  reg('bit-lshift', (a) => vNum(a[0].n << a[1].n));
  reg('bit-rshift', (a) => vNum(a[0].n >> a[1].n));

  // List ops
  reg('car', (a) => a[0].list.length ? a[0].list[0] : NIL);
  reg('cdr', (a) => vList(a[0].list.slice(1)));
  reg('cons', (a) => { const l = a[1].list.slice(); l.unshift(a[0]); return vList(l); });
  reg('nth', (a) => { const i = a[1].n; return i >= 0 && i < a[0].list.length ? a[0].list[i] : NIL; });
  reg('push', (a) => { const l = a[0].list.slice(); l.push(a[1]); return vList(l); });
  reg('range', (a) => {
    const start = a.length > 1 ? a[0].n : 0;
    const end = a.length > 1 ? a[1].n : a[0].n;
    const step = a.length > 2 ? a[2].n : 1;
    const r = [];
    for (let i = start; step > 0 ? i < end : i > end; i += step) r.push(vNum(i));
    return vList(r);
  });

  // String ops
  reg('str', (a) => vStr(a.map(valStr).join('')));
  reg('num', (a) => { try { return vNum(parseFloat(valStr(a[0]))); } catch { return vNum(0); } });
  reg('substr', (a) => vStr(a[0].s.substring(a[1].n, a.length > 2 ? a[1].n + a[2].n : undefined)));
  reg('str-split', (a) => {
    if (a.length < 2) return vList([]);
    const s = valStr(a[0]);
    const sep = valStr(a[1]);
    if (!sep) return vList([vStr(s)]);
    return vList(s.split(sep).map(x => vStr(x)));
  });
  reg('str-join', (a) => {
    if (!a.length || a[0].k !== 'list') return vStr('');
    const sep = a.length > 1 ? valStr(a[1]) : '';
    return vStr(a[0].list.map(valStr).join(sep));
  });
  reg('str-lower', (a) => vStr(valStr(a[0]).toLowerCase()));
  reg('str-upper', (a) => vStr(valStr(a[0]).toUpperCase()));
  reg('str-trim', (a) => vStr(valStr(a[0]).trim()));
  reg('str-find', (a) => vNum(valStr(a[0]).indexOf(valStr(a[1]))));
  reg('str-replace', (a) => vStr(valStr(a[0]).split(valStr(a[1])).join(valStr(a[2]))));
  reg('str-starts?', (a) => vNum(valStr(a[0]).startsWith(valStr(a[1])) ? 1 : 0));
  reg('str-ends?', (a) => vNum(valStr(a[0]).endsWith(valStr(a[1])) ? 1 : 0));
  reg('str-reverse', (a) => vStr(valStr(a[0]).split('').reverse().join('')));
  reg('str-repeat', (a) => vStr(valStr(a[0]).repeat(a[1].n)));

  // Functional
  reg('map', (a, e) => {
    if (a[1].k !== 'list') return vList([]);
    return vList(a[1].list.map(v => funcCall(a[0], [v], e)));
  });
  reg('filter', (a, e) => {
    if (a[1].k !== 'list') return vList([]);
    return vList(a[1].list.filter(v => truthy(funcCall(a[0], [v], e))));
  });
  reg('fold', (a, e) => {
    let acc = a[2];
    if (a[1].k === 'list') for (const v of a[1].list) acc = funcCall(a[0], [acc, v], e);
    return acc;
  });
  reg('apply', (a, e) => {
    if (a[1].k === 'list') return funcCall(a[0], a[1].list, e);
    return NIL;
  });
  reg('for', (a, e) => {
    if (a.length < 2 || a[0].k !== 'list' || a[1].k !== 'fn') return NIL;
    for (const v of a[0].list) funcCall(a[1], [v], e);
    return NIL;
  });
  reg('each', (a, e) => {
    if (a.length < 2 || a[0].k !== 'list' || a[1].k !== 'fn') return NIL;
    for (const v of a[0].list) funcCall(a[1], [v], e);
    return NIL;
  });
  reg('flatten', (a) => {
    if (!a.length || a[0].k !== 'list') return vList([]);
    const flatten = (lst) => {
      const r = [];
      for (const v of lst) { if (v.k === 'list') r.push(...flatten(v.list)); else r.push(v); }
      return r;
    };
    return vList(flatten(a[0].list));
  });
  reg('sort', (a, e) => {
    if (!a.length || a[0].k !== 'list') return vList([]);
    const arr = a[0].list.slice();
    if (a.length > 1 && a[1].k === 'fn') {
      arr.sort((x, y) => { const r = funcCall(a[1], [x, y], e); return r.n || 0; });
    } else {
      arr.sort((x, y) => valStr(x) < valStr(y) ? -1 : valStr(x) > valStr(y) ? 1 : 0);
    }
    return vList(arr);
  });
  reg('uniq', (a) => {
    if (!a.length || a[0].k !== 'list') return vList([]);
    const seen = new Set();
    const r = [];
    for (const v of a[0].list) { const s = valStr(v); if (!seen.has(s)) { seen.add(s); r.push(v); } }
    return vList(r);
  });
  reg('reverse', (a) => {
    if (!a.length) return NIL;
    if (a[0].k === 'list') return vList(a[0].list.slice().reverse());
    if (a[0].k === 'str') return vStr(a[0].s.split('').reverse().join(''));
    return NIL;
  });
  reg('take', (a) => {
    if (!a.length || a[0].k !== 'list') return vList([]);
    return vList(a[0].list.slice(0, a[1].n));
  });
  reg('drop', (a) => {
    if (!a.length || a[0].k !== 'list') return vList([]);
    return vList(a[0].list.slice(a[1].n));
  });
  reg('zip', (a) => {
    if (a.length < 2 || a[0].k !== 'list' || a[1].k !== 'list') return vList([]);
    const r = [];
    const len = Math.min(a[0].list.length, a[1].list.length);
    for (let i = 0; i < len; i++) r.push(vList([a[0].list[i], a[1].list[i]]));
    return vList(r);
  });
  reg('unzip', (a) => {
    if (!a.length || a[0].k !== 'list') return vList([vList([]), vList([])]);
    const xs = [], ys = [];
    for (const pair of a[0].list) {
      if (pair.k === 'list' && pair.list.length >= 2) { xs.push(pair.list[0]); ys.push(pair.list[1]); }
    }
    return vList([vList(xs), vList(ys)]);
  });

  // Map ops
  reg('dict', (a) => {
    const m = new Map();
    for (let i = 0; i + 1 < a.length; i += 2) m.set(valStr(a[i]), a[i + 1]);
    return vMap(m);
  });
  reg('map-get', (a) => {
    if (a.length < 2 || a[0].k !== 'map') return NIL;
    return a[0].map.has(valStr(a[1])) ? a[0].map.get(valStr(a[1])) : NIL;
  });
  reg('map-set', (a) => {
    if (a.length < 3 || a[0].k !== 'map') return NIL;
    const m = new Map(a[0].map);
    m.set(valStr(a[1]), a[2]);
    return vMap(m);
  });
  reg('map-del', (a) => {
    if (a.length < 2 || a[0].k !== 'map') return NIL;
    const m = new Map(a[0].map);
    m.delete(valStr(a[1]));
    return vMap(m);
  });
  reg('map-has?', (a) => {
    if (a.length < 2 || a[0].k !== 'map') return vNum(0);
    return vNum(a[0].map.has(valStr(a[1])) ? 1 : 0);
  });
  reg('map-keys', (a) => {
    if (!a.length || a[0].k !== 'map') return vList([]);
    return vList([...a[0].map.keys()].map(k => vStr(k)));
  });
  reg('map-values', (a) => {
    if (!a.length || a[0].k !== 'map') return vList([]);
    return vList([...a[0].map.values()]);
  });
  reg('map-merge', (a) => {
    if (a.length < 2 || a[0].k !== 'map' || a[1].k !== 'map') return NIL;
    const m = new Map(a[0].map);
    for (const [k, v] of a[1].map) m.set(k, v);
    return vMap(m);
  });

  // Struct ops
  reg('struct-get', (a) => {
    if (a.length < 2 || a[0].k !== 'struct') return NIL;
    return a[0].fields.has(valStr(a[1])) ? a[0].fields.get(valStr(a[1])) : NIL;
  });
  reg('struct-set!', (a) => {
    if (a.length < 3 || a[0].k !== 'struct') return NIL;
    a[0].fields.set(valStr(a[1]), a[2]);
    return a[0];
  });

  // Vector ops
  reg('vector', (a) => vVector(a));
  reg('vector-push!', (a) => {
    if (!a.length || a[0].k !== 'vector') return NIL;
    a[0].vec.push(a[1]);
    return a[0];
  });
  reg('vector-pop!', (a) => {
    if (!a.length || a[0].k !== 'vector' || !a[0].vec.length) return NIL;
    return a[0].vec.pop();
  });
  reg('vector-ref', (a) => {
    if (!a.length || a[0].k !== 'vector') return NIL;
    const i = a[1].n;
    return i >= 0 && i < a[0].vec.length ? a[0].vec[i] : NIL;
  });
  reg('vector-set!', (a) => {
    if (a.length < 3 || a[0].k !== 'vector') return NIL;
    a[0].vec[a[1].n] = a[2];
    return a[0];
  });
  reg('vector-size', (a) => {
    if (!a.length || a[0].k !== 'vector') return vNum(0);
    return vNum(a[0].vec.length);
  });
  reg('vector->list', (a) => {
    if (!a.length || a[0].k !== 'vector') return vList([]);
    return vList(a[0].vec);
  });
  reg('list->vector', (a) => {
    if (!a.length || a[0].k !== 'list') return vVector([]);
    return vVector(a[0].list);
  });

  // Error handling
  reg('error', (a) => {
    throw new ALBError('Error', a.length ? valStr(a[0]) : '');
  });
  reg('assert', (a) => {
    if (!truthy(a[0])) throw new ALBError('AssertionError', a.length > 1 ? valStr(a[1]) : 'Assertion failed');
    return NIL;
  });
  reg('throw', (a) => {
    if (a.length && a[0].k === 'map') {
      const m = a[0].map;
      throw new ALBError(
        m.has('type') ? valStr(m.get('type')) : 'Error',
        m.has('message') ? valStr(m.get('message')) : '',
        m.has('data') ? m.get('data') : NIL
      );
    }
    throw new ALBError('Error', a.length ? valStr(a[0]) : '');
  });

  // Utility
  reg('all', (a, e) => {
    if (a.length < 2 || a[0].k !== 'list' || a[1].k !== 'fn') return vNum(0);
    for (const v of a[0].list) if (!truthy(funcCall(a[1], [v], e))) return vNum(0);
    return vNum(1);
  });
  reg('any', (a, e) => {
    if (a.length < 2 || a[0].k !== 'list' || a[1].k !== 'fn') return vNum(0);
    for (const v of a[0].list) if (truthy(funcCall(a[1], [v], e))) return vNum(1);
    return vNum(0);
  });
  reg('compose', (a, e) => {
    if (a.length < 2 || a[0].k !== 'fn' || a[1].k !== 'fn') return NIL;
    const f = a[0].fn, g = a[1].fn;
    const composed = (args) => funcCall(a[1], [funcCall(a[0], args, e)], e);
    return vFn(makeFunc({ name: 'compose', native: composed, isNative: true }));
  });
  reg('partial', (a, e) => {
    if (!a.length || a[0].k !== 'fn') return NIL;
    const partial = (args) => funcCall(a[0], [...a.slice(1), ...args], e);
    return vFn(makeFunc({ name: 'partial', native: partial, isNative: true }));
  });
  reg('pipe', (a, e) => {
    if (a.length < 2 || a[0].k !== 'fn' || a[1].k !== 'fn') return NIL;
    const piped = (args) => funcCall(a[1], [funcCall(a[0], args, e)], e);
    return vFn(makeFunc({ name: 'pipe', native: piped, isNative: true }));
  });

  // Regex
  reg('re-test?', (a) => {
    const re = new RegExp(valStr(a[1]));
    return vNum(re.test(valStr(a[0])) ? 1 : 0);
  });
  reg('re-find', (a) => {
    const re = new RegExp(valStr(a[1]), 'g');
    const matches = valStr(a[0]).match(re);
    return matches ? vList(matches.map(m => vStr(m))) : vList([]);
  });
  reg('re-match', (a) => {
    const re = new RegExp(valStr(a[1]));
    const m = valStr(a[0]).match(re);
    return m ? vList(m.map(x => vStr(x || ''))) : NIL;
  });
  reg('re-replace', (a) => {
    const re = new RegExp(valStr(a[1]), 'g');
    return vStr(valStr(a[0]).replace(re, valStr(a[2])));
  });
  reg('re-split', (a) => {
    const re = new RegExp(valStr(a[1]));
    return vList(valStr(a[0]).split(re).map(s => vStr(s)));
  });

  // Char
  reg('char-code', (a) => vNum(valStr(a[0]).charCodeAt(0)));
  reg('code-char', (a) => vStr(String.fromCharCode(a[0].n)));

  // JSON
  reg('json-parse', (a) => {
    try {
      const obj = JSON.parse(valStr(a[0]));
      return jsToAlb(obj);
    } catch { return NIL; }
  });
  reg('json-serialize', (a) => vStr(JSON.stringify(albToJs(a[0]))));

  // Time
  reg('time-now', (a) => vStr(new Date().toISOString()));
  reg('time-now-ms', (a) => vNum(Date.now()));
  reg('time-diff', (a) => vNum(a[1].n - a[0].n));
  reg('time-format', (a) => {
    const d = new Date(a[0].n);
    const fmt = valStr(a[1]);
    return vStr(fmt.replace(/YYYY/g, d.getFullYear()).replace(/MM/g, String(d.getMonth() + 1).padStart(2, '0')).replace(/DD/g, String(d.getDate()).padStart(2, '0')).replace(/HH/g, String(d.getHours()).padStart(2, '0')).replace(/mm/g, String(d.getMinutes()).padStart(2, '0')).replace(/ss/g, String(d.getSeconds()).padStart(2, '0')));
  });
  reg('time-local', (a) => vStr(new Date(a[0].n).toLocaleString()));
  reg('time-parse', (a) => vNum(new Date(valStr(a[0])).getTime()));
  reg('time-sleep', (a) => NIL);
  reg('sleep', (a) => NIL);

  // Misc
  reg('exit', (a) => { throw new ALBError('ExitError', 'exit called'); });
  reg('doc', (a) => {
    if (!a.length || a[0].k !== 'fn') return vStr('');
    return vStr(a[0].fn.doc || '');
  });
  reg('break', () => { throw new BreakSignal(); });
}

// JS <-> ALB 转换
function jsToAlb(obj) {
  if (obj === null || obj === undefined) return NIL;
  if (typeof obj === 'number') return vNum(obj);
  if (typeof obj === 'string') return vStr(obj);
  if (typeof obj === 'boolean') return vNum(obj ? 1 : 0);
  if (Array.isArray(obj)) return vList(obj.map(jsToAlb));
  if (typeof obj === 'object') {
    const m = new Map();
    for (const [k, v] of Object.entries(obj)) m.set(k, jsToAlb(v));
    return vMap(m);
  }
  return NIL;
}

function albToJs(v) {
  if (!v || v.k === 'nil') return null;
  if (v.k === 'num') return v.n;
  if (v.k === 'str') return v.s;
  if (v.k === 'list') return v.list.map(albToJs);
  if (v.k === 'map') {
    const obj = {};
    for (const [k, val] of v.map) obj[k] = albToJs(val);
    return obj;
  }
  if (v.k === 'vector') return v.vec.map(albToJs);
  if (v.k === 'struct') {
    const obj = { __type: v.stype };
    for (const [k, val] of v.fields) obj[k] = albToJs(val);
    return obj;
  }
  if (v.k === 'fn') {
    // 函数值 → 可调用的 JS 函数（支持宿主/线程调度器回调 ALB 闭包, 如 thread_spawn）
    const jsFn = function () {
      const albArgs = Array.prototype.slice.call(arguments).map(jsToAlb);
      return albToJs(funcCall(v, albArgs, null));
    };
    jsFn.__albFn = v;   // 保留原始 ALB 函数值引用
    return jsFn;
  }
  return null;
}

// ============================ ALB 解释器类 ============================

class ALBInterpreter {
  constructor() {
    this.env = new Env();
    this.output = [];          // 捕获 print 输出
    this.modules = new Map();  // 已注册的模块代码 { name: src }
    registerBuiltins(this.env);
    this._installPrintCapture();
  }

  /** 替换 print/prints 使其写入 output 数组 */
  _installPrintCapture() {
    const self = this;
    const origPrint = this.env.get('print');
    const origPrints = this.env.get('prints');
    this.env.setLocal('print', vFn(makeFunc({
      name: 'print', isNative: true,
      native: (a) => { self.output.push(a.map(valStr).join(' ')); return NIL; },
    })));
    this.env.setLocal('prints', vFn(makeFunc({
      name: 'prints', isNative: true,
      native: (a) => {
        const s = a.map(valStr).join(' ');
        if (self.output.length) self.output[self.output.length - 1] += s;
        else self.output.push(s);
        return NIL;
      },
    })));
  }

  // --- 注册 API ---

  /** 设置变量（可被 ALB 代码修改） */
  setVar(name, value) {
    this.env.setLocal(name, this._toAlb(value));
    return this;
  }

  /** 设置常量（ALB 代码不可修改） */
  setConst(name, value) {
    const val = this._toAlb(value);
    if (this.env.has(name)) this.env.unsetConst(name);
    this.env.setLocal(name, val);
    this.env.consts.add(name);
    return this;
  }

  /** 注册原生函数 */
  setFunc(name, fn) {
    if (typeof fn !== 'function')
      throw new TypeError('setFunc expects a function');
    const native = (args) => {
      // 将 ALB 值转换为 JS 值后传入用户函数
      const jsArgs = args.map(albToJs);
      const result = fn(...jsArgs);
      return this._toAlb(result);
    };
    this.env.setLocal(name, vFn(makeFunc({ name, native, isNative: true })));
    return this;
  }

  /** 获取 ALB 环境中的变量 */
  getVar(name) {
    try { return albToJs(this.env.get(name)); }
    catch { return undefined; }
  }

  /** 检查变量是否已定义 */
  has(name) { return this.env.has(name); }

  /** 删除变量 */
  deleteVar(name) {
    this.env.vars.delete(name);
    this.env.consts.delete(name);
    return this;
  }

  // --- 模块系统 ---

  /** 注册模块源码（ALB 代码字符串） */
  registerModule(name, src) {
    this.modules.set(name, src);
    return this;
  }

  /** 加载模块（执行模块代码，将导出绑定注入当前环境） */
  loadModule(name, opts = {}) {
    const src = this.modules.get(name);
    if (!src) throw new ALBError('ModuleError', 'Module not registered: ' + name);
    const modEnv = new Env(this.env);
    const exprs = new Parser(src).parseAll();
    for (const expr of exprs) evalExpr(expr, modEnv);
    // 导出
    const prefix = opts.as ? opts.as + '.' : '';
    const only = opts.only || [];
    for (const [key, val] of modEnv.vars) {
      if (modEnv.exports.size && !modEnv.exports.has(key)) continue;
      if (only.length && !only.includes(key)) continue;
      this.env.setLocal(prefix + key, val);
    }
    return this;
  }

  /** 支持 (use "name") 特殊形式：注册模块后调用 */
  use(name, opts = {}) {
    return this.loadModule(name, opts);
  }

  // --- 执行 API ---

  /** 解析 ALB 源码为表达式列表 */
  parse(src) {
    return new Parser(src).parseAll();
  }

  /** 执行单个表达式，返回 JS 值 */
  eval(src) {
    this.output = [];
    const exprs = new Parser(src).parseAll();
    let result = NIL;
    for (const expr of exprs) result = evalExpr(expr, this.env);
    return albToJs(result);
  }

  /** 执行 ALB 代码，返回 { result, output } */
  run(src) {
    this.output = [];
    const exprs = new Parser(src).parseAll();
    let result = NIL;
    for (const expr of exprs) result = evalExpr(expr, this.env);
    return { result: albToJs(result), output: this.output.slice() };
  }

  /** 执行表达式列表 */
  runExprs(exprs) {
    this.output = [];
    let result = NIL;
    for (const expr of exprs) result = evalExpr(expr, this.env);
    return { result: albToJs(result), output: this.output.slice() };
  }

  // --- 数据构造 API ---

  /** 构造 ALB list */
  list(...args) {
    return vList(args.map(a => this._toAlb(a)));
  }

  /** 构造 ALB map */
  map(obj) {
    if (obj instanceof Map) return vMap(obj);
    const m = new Map();
    for (const [k, v] of Object.entries(obj || {})) m.set(String(k), this._toAlb(v));
    return vMap(m);
  }

  /** 构造 ALB vector */
  vector(...args) {
    return vVector(args.map(a => this._toAlb(a)));
  }

  /** 构造 ALB nil */
  nil() { return NIL; }

  // --- 内部工具 ---

  /** 将 JS 值转换为 ALB 值 */
  _toAlb(v) {
    if (isAlbVal(v)) return v;
    if (v === null || v === undefined) return NIL;
    if (typeof v === 'number') return vNum(v);
    if (typeof v === 'string') return vStr(v);
    if (typeof v === 'boolean') return vNum(v ? 1 : 0);
    if (typeof v === 'function') {
      const native = (args) => this._toAlb(v(...args.map(albToJs)));
      return vFn(makeFunc({ name: v.name || 'js-fn', native, isNative: true }));
    }
    if (Array.isArray(v)) return vList(v.map(x => this._toAlb(x)));
    if (typeof v === 'object') {
      const m = new Map();
      for (const [k, val] of Object.entries(v)) m.set(String(k), this._toAlb(val));
      return vMap(m);
    }
    return NIL;
  }
}

// ============================ 导出 ============================

/** 创建独立的 ALB 解释器实例 */
var createALB = function() {
  return new ALBInterpreter();
};

/** 默认全局实例 */
var ALB = createALB();

// 导出所有值工具函数（供高级用法使用）
var internal = {
  NIL, vNum, vStr, vSym, vList, vMap, vVector, vStruct, vFn,
  valStr, truthy, ALBError, Env, Parser,
  evalExpr, funcCall, makeFunc, cloneVal,
  patMatch, patBind, macroSubst,
  jsToAlb, albToJs,
  registerBuiltins,
};

// UMD 导出: 浏览器 <script> 经典标签直接挂载全局（不能用 ESM export 语句, 否则解析报错）
if (typeof globalThis !== 'undefined') {
  globalThis.ALB = ALB;
  globalThis.createALB = createALB;
  globalThis.ALBInterpreter = ALBInterpreter;
  globalThis.ALBInternal = internal;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ALB;
  module.exports.default = ALB;
  module.exports.createALB = createALB;
  module.exports.ALBInterpreter = ALBInterpreter;
  module.exports.internal = internal;
}
