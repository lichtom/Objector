/**
 * APP CLI 控制台运行时
 * 用法: node app-cli-runtime.js <config-json-path> [pid-file-path]
 * 在终端/命令行窗口中运行积木脚本
 */
var fs = require('fs');
// 不使用 readline（readline 会接管 stdout 导致输出被缓冲）

var _configPath = process.argv[2];
if (!_configPath) {
  console.error('[CLI] 缺少配置路径参数');
  process.exit(1);
}

// 写入 PID 文件供主进程跟踪
var _pidFile = process.argv[3] || '';
if (_pidFile) {
  try { fs.writeFileSync(_pidFile, String(process.pid), 'utf-8'); } catch(e) {}
}

// 读取配置
var config;
try {
  config = JSON.parse(fs.readFileSync(_configPath, 'utf-8'));
} catch (e) {
  console.error('[CLI] 读取配置失败:', e.message);
  process.exit(1);
}

// ========== 全局状态 ==========
var _vars = {};       // 变量存储
var _lists = {};      // 列表存储（变量名 -> 数组）
var _timers = [];
var _stopFlag = false; // stop_all 标志

// ========== 控制台 I/O ==========
// 所有输出统一用 console.log（在 TTY 下同步写入，可靠刷出）
// 输入用 process.stdin 原始行模式（不用 readline，避免接管 stdout）

// 行输入缓冲
var _inputBuf = '';
var _inputResolve = null;
var _inputReady = false;

process.stdin.setEncoding('utf8');
process.stdin.resume();
process.stdin.on('data', function(chunk) {
  _inputBuf += chunk;
  var idx = _inputBuf.indexOf('\n');
  if (idx >= 0) {
    var line = _inputBuf.substring(0, idx).replace(/\r$/, '');
    _inputBuf = _inputBuf.substring(idx + 1);
    if (_inputResolve) {
      var fn = _inputResolve;
      _inputResolve = null;
      fn(line);
    } else {
      _inputReady = true;
      _inputLine = line;
    }
  }
});

// 读取一行输入
function _readLine(prompt) {
  process.stdout.write(String(prompt));  // 不换行，提示和用户输入在同一行
  return new Promise(function(resolve) {
    if (_inputReady) {
      _inputReady = false;
      resolve(_inputLine);
    } else {
      _inputResolve = resolve;
    }
  });
}

function log(msg, type) {
  var prefix = '';
  if (type === 'warn') prefix = '⚠ ';
  else if (type === 'error') prefix = '❌ ';
  else if (type === 'info') prefix = 'ℹ ';
  console.log(prefix + msg);
}

// 等待用户按任意键
function waitForKeyPress() {
  return new Promise(function(resolve) {
    console.log('');
    console.log('-------------------------------------------');
    console.log('\x1b[33m  程序已结束，按任意键关闭窗口...\x1b[0m');
    if (process.stdin.isTTY) {
      try { process.stdin.setRawMode(true); } catch(e) {}
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.once('data', function() {
        try { process.stdin.setRawMode(false); } catch(e) {}
        process.stdin.pause();
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function cliAlert(msg) {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║  ' + String(msg).substring(0, 36).padEnd(36) + '  ║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');
}

function cliConfirm(msg) {
  return _readLine(msg + ' (y/n): ').then(function(answer) {
    return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
  });
}

function cliPrompt(msg) {
  return _readLine(msg + ': ');
}

function cliInput(prompt) {
  return _readLine(prompt || '> ');
}

// 获取列表（按变量名引用）
function _getList(name) {
  if (!_lists[name]) _lists[name] = [];
  return _lists[name];
}

// ========== 积木执行引擎 ==========
async function executeBlock(block, blocks, scope) {
  if (!block) return undefined;

  // 解析参数：优先使用 paramConnections 中连接的 reporter 积木的值
  var p = block.params || {};
  if (block.paramConnections) {
    var resolved = Object.assign({}, p);
    for (var paramName in block.paramConnections) {
      var connId = block.paramConnections[paramName];
      var reporter = blocks[connId];
      if (reporter) {
        var result = await executeBlock(reporter, blocks, scope);
        if (result !== undefined) resolved[paramName] = result;
      }
    }
    p = resolved;
  }

  // 额外参数（动态参数槽，如函数定义/调用的参数）
  var extraP = block._extraParams || [];
  extraP.forEach(function(ep) {
    if (!(ep.name in p)) p[ep.name] = ep.default !== undefined ? ep.default : '';
  });
  // 额外参数的 paramConnections
  if (block._extraParamConnections) {
    for (var epn in block._extraParamConnections) {
      var eid = block._extraParamConnections[epn];
      var er = blocks[eid];
      if (er) {
        var ev = await executeBlock(er, blocks, scope);
        if (ev !== undefined) p[epn] = ev;
      }
    }
  }

  var type = block.type;

  switch (type) {
    // ===== 事件入口（no-op，由 executeChain 跟随 flowOut） =====
    case 'app_on_window_start': case 'app_on_window_close': case 'app_on_window_resize':
    case 'app_on_button_click': case 'app_on_input_change':
    case 'app_on_key_pressed': case 'app_on_timer': break;

    // ===== 变量 =====
    case 'var_set': _vars[p.name] = p.val; break;
    case 'var_get': return _vars[p.name] !== undefined ? _vars[p.name] : 0;
    case 'var_change': {
      var cur = Number(_vars[p.name]) || 0;
      _vars[p.name] = cur + Number(p.val);
      break;
    }
    case 'var_show': console.log(p.name + ' = ' + _vars[p.name]); break;
    case 'var_hide': break;

    // ===== 运算符：算术 =====
    case 'op_add': return Number(p.a || 0) + Number(p.b || 0);
    case 'op_sub': return Number(p.a || 0) - Number(p.b || 0);
    case 'op_mul': return Number(p.a || 0) * Number(p.b || 0);
    case 'op_div': return Number(p.b || 0) !== 0 ? Number(p.a || 0) / Number(p.b) : 0;
    case 'op_mod': return Number(p.a || 0) % Number(p.b || 1);
    case 'op_pow': return Math.pow(Number(p.a || 0), Number(p.b || 0));
    case 'op_random': {
      var lo = Number(p.a || 1), hi = Number(p.b || 10);
      return Math.floor(Math.random() * (hi - lo + 1)) + lo;
    }
    case 'op_random_float': return Math.random();

    // ===== 运算符：比较 =====
    case 'op_lt': return Number(p.a) < Number(p.b);
    case 'op_gt': return Number(p.a) > Number(p.b);
    case 'op_lte': return Number(p.a) <= Number(p.b);
    case 'op_gte': return Number(p.a) >= Number(p.b);
    case 'op_eq': return String(p.a) === String(p.b);
    case 'op_neq': return String(p.a) !== String(p.b);

    // ===== 运算符：逻辑 =====
    case 'op_and': return !!(p.a && p.b);
    case 'op_or': return !!(p.a || p.b);
    case 'op_not': return !p.a;

    // ===== 运算符：字符串 =====
    case 'op_join': return String(p.a || '') + String(p.b || '');
    case 'op_strlen': return String(p.s || '').length;
    case 'op_substr': return String(p.s || '').substring(Number(p.start || 1) - 1, Number(p.end || 999));
    case 'op_str_index': return String(p.s || '').indexOf(String(p.sub || '')) + 1;
    case 'op_str_contains': return String(p.s || '').includes(String(p.sub || ''));
    case 'op_str_upper': return String(p.s || '').toUpperCase();
    case 'op_str_lower': return String(p.s || '').toLowerCase();
    case 'op_str_trim': return String(p.s || '').trim();
    case 'op_str_repeat': return String(p.s || '').repeat(Number(p.n || 1));
    case 'op_str_replace': return String(p.s || '').split(String(p.from || '')).join(String(p.to || ''));
    case 'op_char_at': return (String(p.s || '')[Number(p.n || 1) - 1]) || '';
    case 'op_to_number': return Number(p.s) || 0;
    case 'op_to_string': return String(p.n !== undefined ? p.n : '');

    // ===== 运算符：数学函数 =====
    case 'op_math': {
      var n = Number(p.n || 0), fn = p.fn || 'abs';
      switch (fn) {
        case 'abs': return Math.abs(n);
        case 'floor': return Math.floor(n);
        case 'ceil': return Math.ceil(n);
        case 'round': return Math.round(n);
        case 'sqrt': return Math.sqrt(n);
        case 'sin': return Math.sin(n);
        case 'cos': return Math.cos(n);
        case 'tan': return Math.tan(n);
        case 'asin': return Math.asin(n);
        case 'acos': return Math.acos(n);
        case 'atan': return Math.atan(n);
        case 'log': return Math.log(n);
        case 'log2': return Math.log2(n);
        case 'exp': return Math.exp(n);
        case 'sign': return Math.sign(n);
        default: return n;
      }
    }
    case 'op_min': return Math.min(Number(p.a || 0), Number(p.b || 0));
    case 'op_max': return Math.max(Number(p.a || 0), Number(p.b || 0));
    case 'op_clamp': return Math.min(Math.max(Number(p.n), Number(p.min || 0)), Number(p.max || 100));
    case 'op_lerp': return Number(p.a || 0) + (Number(p.b || 0) - Number(p.a || 0)) * Number(p.t || 0.5);
    case 'op_pi': return Math.PI;
    case 'op_e': return Math.E;
    case 'op_newline': return '\n';

    // ===== 控制流 =====
    case 'wait': await new Promise(function(r) { setTimeout(r, Number(p.sec || 1) * 1000); }); break;

    case 'repeat': {
      var times = Number(p.times) || 0;
      var bodyId = block.subBlocks && block.subBlocks.body;
      if (bodyId && blocks[bodyId]) {
        for (var ri = 0; ri < times; ri++) {
          scope.__loopIndex = ri;
          await executeChain(blocks[bodyId], blocks, scope);
          if (_stopFlag) break;
        }
      }
      break;
    }

    case 'forever': {
      var bodyId = block.subBlocks && block.subBlocks.body;
      if (bodyId && blocks[bodyId]) {
        while (!_stopFlag) {
          await executeChain(blocks[bodyId], blocks, scope);
          await new Promise(function(r) { setTimeout(r, 16); });
        }
      }
      break;
    }

    case 'if_then': {
      if (p.cond) {
        var bodyId = block.subBlocks && block.subBlocks.body;
        if (bodyId && blocks[bodyId]) await executeChain(blocks[bodyId], blocks, scope);
      }
      break;
    }

    case 'if_else': {
      var sub = p.cond ? 'then' : 'else';
      var bodyId = block.subBlocks && block.subBlocks[sub];
      if (bodyId && blocks[bodyId]) await executeChain(blocks[bodyId], blocks, scope);
      break;
    }

    case 'repeat_until': {
      var maxIter = 100000;
      while (maxIter-- > 0 && !_stopFlag) {
        // 重新评估条件
        var condResult = false;
        if (block.paramConnections && block.paramConnections.cond) {
          var condBlock = blocks[block.paramConnections.cond];
          if (condBlock) condResult = await executeBlock(condBlock, blocks, scope);
        } else {
          condResult = !!p.cond;
        }
        if (condResult) break;
        var bodyId = block.subBlocks && block.subBlocks.body;
        if (bodyId && blocks[bodyId]) {
          await executeChain(blocks[bodyId], blocks, scope);
        } else {
          break;
        }
      }
      break;
    }

    case 'stop_all': {
      _stopFlag = true;
      _timers.forEach(function(t) { clearInterval(t); });
      break;
    }

    // ===== 列表 =====
    case 'list_create': {
      var items = (block._extraParams || []).map(function(ep) {
        return p[ep.name] !== undefined ? p[ep.name] : '';
      });
      return items;
    }
    case 'list_push': {
      var list = _getList(p.list);
      list.push(p.val);
      break;
    }
    case 'list_delete': {
      var list = _getList(p.list);
      var idx = Number(p.idx || 1) - 1;
      if (idx >= 0 && idx < list.length) list.splice(idx, 1);
      break;
    }
    case 'list_insert': {
      var list = _getList(p.list);
      var idx = Number(p.idx || 1) - 1;
      list.splice(idx, 0, p.val);
      break;
    }
    case 'list_set': {
      var list = _getList(p.list);
      var idx = Number(p.idx || 1) - 1;
      if (idx >= 0 && idx < list.length) list[idx] = p.val;
      break;
    }
    case 'list_get': {
      var list = _getList(p.list);
      var idx = Number(p.idx || 1) - 1;
      return (idx >= 0 && idx < list.length) ? list[idx] : '';
    }
    case 'list_length': {
      var list = _getList(p.list);
      return list.length;
    }
    case 'list_contains': {
      var list = _getList(p.list);
      return list.indexOf(p.val) !== -1;
    }
    case 'list_clear': {
      _lists[p.list] = [];
      break;
    }
    case 'list_foreach': {
      var list = _getList(p.list);
      var varName = p.var || 'item';
      var bodyId = block.subBlocks && block.subBlocks.body;
      if (bodyId && blocks[bodyId]) {
        for (var fi = 0; fi < list.length; fi++) {
          _vars[varName] = list[fi];
          scope.__loopIndex = fi;
          await executeChain(blocks[bodyId], blocks, scope);
          if (_stopFlag) break;
        }
      }
      break;
    }
    case 'list_index_of': {
      var list = _getList(p.list);
      var idx = list.indexOf(p.val);
      return idx === -1 ? 0 : idx + 1;
    }
    case 'list_join': {
      var list = _getList(p.list);
      return list.join(String(p.sep || ','));
    }
    case 'list_sort': {
      var list = _getList(p.list);
      if (p.order === '降序') list.sort(function(a, b) { return Number(b) - Number(a); });
      else list.sort(function(a, b) { return Number(a) - Number(b); });
      break;
    }
    case 'list_reverse': {
      var list = _getList(p.list);
      list.reverse();
      break;
    }

    // ===== 函数 =====
    case 'func_define': break; // 定义块不执行

    case 'func_call': {
      var fnDef = Object.values(blocks).find(function(b) {
        return b.type === 'func_define' && b.params && b.params.name === p.name;
      });
      if (fnDef && fnDef.flowOut && blocks[fnDef.flowOut]) {
        var fnScope = {};
        // 传递额外参数
        extraP.forEach(function(ep) {
          fnScope['param_' + ep.name] = p[ep.name] !== undefined ? p[ep.name] : '';
          _vars[ep.name] = fnScope['param_' + ep.name];
        });
        try {
          await executeChain(blocks[fnDef.flowOut], blocks, fnScope);
        } catch (retErr) {
          if (retErr && retErr.__funcReturn) {
            // 函数返回值，忽略（func_call 不返回值）
          } else {
            throw retErr;
          }
        }
      }
      break;
    }

    case 'func_call_reporter': {
      var fnDef = Object.values(blocks).find(function(b) {
        return b.type === 'func_define' && b.params && b.params.name === p.name;
      });
      if (fnDef && fnDef.flowOut && blocks[fnDef.flowOut]) {
        var fnScope = { __returnValue: undefined };
        extraP.forEach(function(ep) {
          fnScope['param_' + ep.name] = p[ep.name] !== undefined ? p[ep.name] : '';
          _vars[ep.name] = fnScope['param_' + ep.name];
        });
        try {
          await executeChain(blocks[fnDef.flowOut], blocks, fnScope);
        } catch (retErr) {
          if (retErr && retErr.__funcReturn) {
            return retErr.val;
          } else {
            throw retErr;
          }
        }
        return fnScope.__returnValue;
      }
      return '';
    }

    case 'func_return': {
      throw { __funcReturn: true, val: p.val };
    }

    case 'func_param_get': {
      return scope['param_' + p.name] !== undefined ? scope['param_' + p.name] : (_vars[p.name] || '');
    }

    case 'func_set_define': {
      // 动态设置函数定义 - 暂不支持
      log('动态函数定义暂不支持', 'warn');
      break;
    }

    // ===== 控制台输出 =====
    case 'app_console_log': console.log(String(p.text || '')); break;
    case 'app_console_warn': console.log('\x1b[33m' + String(p.text || '') + '\x1b[0m'); break;
    case 'app_console_error': console.log('\x1b[31m' + String(p.text || '') + '\x1b[0m'); break;
    case 'app_console_clear': console.clear(); break;

    // ===== 对话框（CLI 版） =====
    case 'app_alert': cliAlert(String(p.msg || '')); break;
    case 'app_confirm': return await cliConfirm(String(p.msg || ''));
    case 'app_prompt': return await cliPrompt(String(p.msg || ''));
    case 'app_open_file_dialog': {
      var path = await cliPrompt('请输入文件路径');
      return path;
    }
    case 'app_save_file_dialog': {
      var path = await cliPrompt('请输入保存路径 (默认: ' + (p.name || '文件.txt') + ')');
      return path || p.name || '文件.txt';
    }

    // ===== CLI 控制台专用 =====
    case 'app_cli_input': return await cliInput(String(p.prompt || '> '));
    case 'app_cli_print': console.log(String(p.text || '')); break;
    case 'app_cli_printline': console.log(String(p.text || '')); break;
    case 'app_cli_clear': console.clear(); break;

    // ===== 数据操作 =====
    case 'app_save_storage': {
      if (!_storage) _storage = {};
      _storage[p.key] = p.val;
      break;
    }
    case 'app_load_storage': return (_storage && _storage[p.key]) || '';
    case 'app_read_file': {
      try { return fs.readFileSync(String(p.path || ''), 'utf-8'); }
      catch (e) { log('读取文件失败: ' + e.message, 'error'); return ''; }
    }
    case 'app_write_file': {
      try { fs.writeFileSync(String(p.path || ''), String(p.text || ''), 'utf-8'); }
      catch (e) { log('写入文件失败: ' + e.message, 'error'); }
      break;
    }
    case 'app_http_get': {
      log('HTTP GET 在 CLI 模式下不支持', 'warn');
      return '';
    }
    case 'app_http_post': {
      log('HTTP POST 在 CLI 模式下不支持', 'warn');
      return '';
    }

    // ===== 组件属性（CLI 模式不支持） =====
    case 'app_set_prop': log('CLI 模式不支持设置组件属性: ' + p.component + '.' + p.prop, 'warn'); break;
    case 'app_get_prop': return '';
    case 'app_get_current_component': case 'app_get_current_comp_name': case 'app_get_current_comp_type':
    case 'app_get_current_comp_text': case 'app_get_current_comp_value':
    case 'app_get_current_comp_x': case 'app_get_current_comp_y':
    case 'app_get_current_comp_width': case 'app_get_current_comp_height':
    case 'app_get_current_comp_visible': return '';
    case 'app_show_component': case 'app_hide_component': break;
    case 'app_list_add_item': {
      var list = _getList(p.name);
      list.push(p.item);
      break;
    }
    case 'app_list_clear': { _lists[p.name] = []; break; }

    // ===== 窗口操作（CLI 模式不支持） =====
    case 'app_open_window': log('CLI 模式不支持打开窗口', 'warn'); break;
    case 'app_close_window': case 'app_close_current_window': log('CLI 模式不支持关闭窗口', 'warn'); break;
    case 'app_switch_window': log('CLI 模式不支持切换窗口', 'warn'); break;
    case 'app_set_window_title': log('CLI 模式: 窗口标题 -> ' + p.title, 'info'); break;
    case 'app_set_window_size': break;
    case 'app_get_window_width': return 800;
    case 'app_get_window_height': return 600;

    // ===== HTML 嵌入 / 画布（CLI 模式不支持） =====
    case 'app_set_html': log('CLI 模式不支持 HTML 嵌入', 'warn'); break;
    case 'app_get_html': return '';
    case 'app_canvas_line': case 'app_canvas_rect': case 'app_canvas_circle':
    case 'app_canvas_text': case 'app_canvas_clear':
    case 'app_canvas_set_style': case 'app_canvas_fill':
      log('CLI 模式不支持画布操作', 'warn'); break;
    case 'app_canvas_get_width': return 200;
    case 'app_canvas_get_height': return 150;

    // ===== 局部域 =====
    case 'scope_local': {
      var bodyId = block.subBlocks && block.subBlocks.body;
      if (bodyId && blocks[bodyId]) {
        var localScope = Object.assign({}, scope);
        await executeChain(blocks[bodyId], blocks, localScope);
      }
      break;
    }

    // ===== 其他 =====
    case 'clone_self': case 'delete_clone': break;
    case 'control_label_run': {
      var bodyId = block.subBlocks && block.subBlocks.body;
      if (bodyId && blocks[bodyId]) await executeChain(blocks[bodyId], blocks, scope);
      break;
    }
    case 'control_turbo': {
      var bodyId = block.subBlocks && block.subBlocks.body;
      if (bodyId && blocks[bodyId]) await executeChain(blocks[bodyId], blocks, scope);
      break;
    }
    case 'control_goto_label': {
      // 找到标签积木并跳转
      var label = p.label;
      var target = Object.values(blocks).find(function(b) {
        return b.type === 'control_label_run' && b.params && b.params.label === label;
      });
      if (target && target.subBlocks && target.subBlocks.body && blocks[target.subBlocks.body]) {
        await executeChain(blocks[target.subBlocks.body], blocks, scope);
      }
      break;
    }

    default:
      // 未知类型，静默跳过
      break;
  }
}

// 执行积木链（从 start 开始，跟随 flowOut）
async function executeChain(start, blocks, scope) {
  var cur = start;
  var safety = 0;
  while (cur && safety < 500000) {
    safety++;
    if (_stopFlag) break;
    try {
      await executeBlock(cur, blocks, scope);
    } catch (e) {
      if (e && e.__funcReturn) throw e; // 函数返回，向上传递
      log('执行错误 [' + (cur.type || '?') + ']: ' + (e.message || e), 'error');
    }
    cur = cur.flowOut ? blocks[cur.flowOut] : null;
  }
}

// ========== 主入口 ==========
var _storage = {};

async function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║    ObjectScratch APP - CLI 控制台模式    ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log('║  窗口: ' + (config.title || config.name || 'CLI').padEnd(33) + '║');
  console.log('║  按 Ctrl+C 退出                         ║');
  console.log('╚══════════════════════════════════════════╝\n');

  var blocks = config.blocksData || {};
  var blockCount = Object.keys(blocks).length;
  log('加载了 ' + blockCount + ' 个积木', 'info');

  // 找所有 app_on_window_start 积木并执行
  var starts = Object.values(blocks).filter(function(b) { return b.type === 'app_on_window_start'; });
  if (starts.length === 0) {
    log('无启动事件积木，程序结束', 'warn');
    return;
  }

  log('启动事件: ' + starts.length + ' 个', 'info');
  for (var i = 0; i < starts.length; i++) {
    var scope = {};
    try {
      // 传入事件积木本身，executeChain 会执行它(no-op)然后跟随 flowOut
      await executeChain(starts[i], blocks, scope);
    } catch (e) {
      if (e && e.__funcReturn) continue;
      log('执行错误: ' + (e.message || e), 'error');
    }
  }

  // 处理定时器积木
  var timers = Object.values(blocks).filter(function(b) { return b.type === 'app_on_timer'; });
  timers.forEach(function(tb) {
    var sec = Number(tb.params && tb.params.sec || 1);
    var timerId = setInterval(function() {
      var scope = {};
      executeChain(tb, blocks, scope).catch(function(e) {
        log('定时器错误: ' + (e.message || e), 'error');
      });
    }, sec * 1000);
    _timers.push(timerId);
    log('定时器已启动: 每 ' + sec + ' 秒执行', 'info');
  });

  // 如果有定时器，保持进程运行
  if (timers.length > 0) {
    log('程序运行中... (Ctrl+C 退出)', 'info');
    // 有定时器时不等待按键，由 Ctrl+C 退出
  } else {
    // 无定时器：等待按键后退出（仅 TTY 模式）
    if (process.stdin.isTTY) {
      await waitForKeyPress();
    }
  }
}

// 优雅退出
process.on('SIGINT', function() {
  _timers.forEach(function(t) { clearInterval(t); });
  console.log('');
  console.log('[CLI] 程序已停止');
  if (_pidFile) { try { fs.unlinkSync(_pidFile); } catch(e) {} }
  if (process.stdin.isTTY) {
    try { process.stdin.setRawMode(true); } catch(e) {}
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    console.log('\x1b[33m  按任意键关闭窗口...\x1b[0m');
    process.stdin.once('data', function() { process.exit(0); });
  } else {
    process.exit(0);
  }
});

process.on('SIGTERM', function() {
  _timers.forEach(function(t) { clearInterval(t); });
  if (_pidFile) { try { fs.unlinkSync(_pidFile); } catch(e) {} }
  process.exit(0);
});

process.on('exit', function() {
  if (_pidFile) { try { fs.unlinkSync(_pidFile); } catch(e) {} }
});

main().catch(function(e) {
  console.error('[CLI] 致命错误:', e);
  process.exit(1);
});
