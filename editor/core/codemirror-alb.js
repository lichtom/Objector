/**
 * codemirror-alb.js — ALB 语言的 CodeMirror 5 语法高亮模式 (text/x-alb)
 *
 * 高光算法：基于字符流的有限状态分词器（与 interpreter/alb.js 词法一一对应）
 *   1. 注释:   ';' 到行尾（对应 alb.js Parser.ws() 的跳行逻辑）
 *   2. 字符串: '"' ... '"' 支持 \" \\ \n 转义且可跨行; 反引号 `...` 插值串整段视为字符串
 *   3. 列表:   '(' 进入子表达式并把下一词条标记为"头位置", ')' 恢复外层头位置(栈式跟踪)
 *   4. 头位置词条:  特殊形式(if/when/let/def...) → keyword;
 *                    解释器内建(reg() 注册) → builtin;  运行时注入的游戏 API → variable-3
 *   5. def/define/defmacro/const/set 之后的第一个词条 → def（定义名高亮）
 *   6. 数字: 整数/小数/科学计数;  :name 关键字实参 → meta;  true/false/nil → atom
 *
 * 关键词与内建名清单直接提取自 interpreter/alb.js 源码
 * （特殊形式: evalExpr 中的 head === '...' ; 内建: reg('...')）,
 * 游戏 API 清单提取自 editor/core/code-runtime.js 的 _flatAPI()。
 */
(function () {
  'use strict';
  if (typeof CodeMirror === 'undefined') return;

  // ---- 特殊形式（alb.js: if (head === '...')）----
  var SPECIAL_FORMS = {
    'if': 1, 'when': 1, 'while': 1, 'for-i': 1, 'cond': 1, 'match': 1, 'do': 1,
    'let': 1, 'let*': 1, 'letrec': 1, 'const': 1, 'def': 1, 'define': 1, 'defmacro': 1,
    'func': 1, 'set': 1, 'struct': 1, 'list': 1, 'try': 1, 'quote': 1,
    'quasiquote': 1, 'export': 1, 'use': 1,
  };
  // 其后第一个词条是"被定义的名字"
  var DEF_HEADS = { 'def': 1, 'define': 1, 'defmacro': 1, 'const': 1, 'set': 1 };

  // ---- 内建函数/运算符（alb.js: reg('...')）----
  var BUILTINS = {
    '+': 1, '-': 1, '*': 1, '/': 1, '%': 1, '^': 1,
    '==': 1, '!=': 1, '<': 1, '>': 1, '<=': 1, '>=': 1,
    'and': 1, 'or': 1, 'not': 1,
    'abs': 1, 'acos': 1, 'asin': 1, 'atan': 1, 'atan2': 1, 'ceil': 1, 'clamp': 1,
    'cos': 1, 'exp': 1, 'floor': 1, 'log': 1, 'log2': 1, 'log10': 1, 'max': 1,
    'min': 1, 'random': 1, 'random-int': 1, 'round': 1, 'sin': 1, 'sqrt': 1, 'tan': 1,
    'all': 1, 'any': 1, 'apply': 1, 'assert': 1, 'car': 1, 'cdr': 1, 'cons': 1,
    'dict': 1, 'doc': 1, 'drop': 1, 'each': 1, 'error': 1, 'exit': 1, 'filter': 1,
    'flatten': 1, 'fold': 1, 'for': 1, 'input': 1, 'len': 1, 'map': 1, 'nth': 1,
    'partial': 1, 'pipe': 1, 'press': 1, 'print': 1, 'prints': 1, 'push': 1,
    'range': 1, 'reverse': 1, 'sort': 1, 'take': 1, 'throw': 1, 'type': 1,
    'uniq': 1, 'unzip': 1, 'vector': 1, 'zip': 1,
    'bit-and': 1, 'bit-or': 1, 'bit-xor': 1, 'bit-not': 1, 'bit-lshift': 1, 'bit-rshift': 1,
    'char-code': 1, 'code-char': 1, 'compose': 1,
    'json-parse': 1, 'json-serialize': 1,
    'map-get': 1, 'map-set': 1, 'map-has?': 1, 'map-keys': 1, 'map-values': 1,
    'map-merge': 1, 'map-del': 1,
    're-find': 1, 're-match': 1, 're-replace': 1, 're-split': 1, 're-test?': 1,
    'str': 1, 'str-find': 1, 'str-join': 1, 'str-split': 1, 'str-trim': 1,
    'str-lower': 1, 'str-upper': 1, 'str-repeat': 1, 'str-replace': 1,
    'str-reverse': 1, 'str-starts?': 1, 'str-ends?': 1, 'substr': 1,
    'struct-get': 1, 'struct-set!': 1,
    'list->vector': 1, 'vector->list': 1, 'vector-ref': 1, 'vector-set!': 1,
    'vector-push!': 1, 'vector-pop!': 1, 'vector-size': 1,
    'sleep': 1, 'time-now': 1, 'time-now-ms': 1, 'time-diff': 1, 'time-format': 1,
    'time-parse': 1, 'time-local': 1, 'time-sleep': 1,
  };

  // ---- Objector 游戏 API（code-runtime.js _flatAPI() 运行时注入）----
  var GAME_API = {
    'move': 1, 'turn_right': 1, 'turn_left': 1, 'goto_xy': 1, 'set_x': 1, 'set_y': 1,
    'change_x': 1, 'change_y': 1, 'get_x': 1, 'get_y': 1, 'get_direction': 1,
    'get_size': 1, 'set_size': 1, 'change_size': 1, 'point_in_direction': 1,
    'point_towards_xy': 1, 'bounce_edge': 1,
    'say': 1, 'say_for': 1, 'think': 1, 'clear_say': 1, 'show': 1, 'hide': 1,
    'set_costume': 1, 'next_costume': 1, 'set_sprite': 1, 'sprite_name': 1,
    'sprite_count': 1, 'sprite_x': 1, 'sprite_y': 1,
    'key_pressed': 1, 'mouse_x': 1, 'mouse_y': 1, 'mouse_down': 1,
    'touching_edge': 1, 'touching_sprite': 1, 'distance_to': 1, 'random_int': 1,
    'get_var': 1, 'set_var': 1, 'change_var': 1, 'has_var': 1, 'var_names': 1,
    'play_sound': 1, 'stop_sounds': 1, 'set_volume': 1, 'timer_now': 1,
    'stage_width': 1, 'stage_height': 1, 'log': 1,
    'thread_spawn': 1, 'thread_kill': 1, 'thread_list': 1, 'thread_id': 1,
  };

  var CONSTANTS = { 'true': 1, 'false': 1, 'nil': 1, 'null': 1, 'none': 1 };

  CodeMirror.defineMode('text/x-alb', function () {
    return {
      startState: function () {
        return { str: null, esc: false, head: false, stack: [], defNext: false };
      },

      token: function (stream, st) {
        // ---- 1. 未闭合字符串的续行 ----
        if (st.str) return _readString(stream, st);

        if (stream.eatSpace()) return null;

        var ch = stream.peek();

        // ---- 2. 行注释: ; 到行尾 ----
        if (ch === ';') { stream.skipToEnd(); return 'comment'; }

        // ---- 3. 字符串 ----
        if (ch === '"' || ch === '`') {
          stream.next();
          st.str = ch;
          st.esc = false;
          return _readString(stream, st);
        }

        // ---- 4. 括号（头位置栈式跟踪）----
        if (ch === '(') {
          stream.next();
          st.stack.push(st.head);
          st.head = true;
          return 'bracket';
        }
        if (ch === ')') {
          stream.next();
          st.head = st.stack.pop() || false;
          st.defNext = false;
          return 'bracket';
        }

        // ---- 5. 关键字实参 :name ----
        if (ch === ':' && stream.match(/^:[^\s()\x22`;]+/)) return 'meta';

        // ---- 6. 词条（数字/运算符/函数名/变量名）----
        var word = stream.match(/[^\s()\x22`;]+/);
        if (!word) { stream.next(); return null; }
        var w = word[0];
        var cls;

        if (/^[-+]?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(w)) {
          cls = 'number';                 // 整数字面量(含负号/小数/科学计数)
        } else if (st.defNext) {          // def/const/set 之后的定义名
          cls = 'def';
        } else if (st.head) {             // 列表头位置
          if (SPECIAL_FORMS[w]) cls = 'keyword';
          else if (GAME_API[w]) cls = 'variable-3';
          else if (BUILTINS[w]) cls = 'builtin';
          else cls = 'variable';          // 用户自定义函数
        } else {
          if (CONSTANTS[w]) cls = 'atom';
          else if (GAME_API[w]) cls = 'variable-3';
          else if (BUILTINS[w]) cls = 'builtin';   // 作为值传递的内建
          else cls = 'variable';
        }

        // 更新头位置/待定义状态
        if (st.head) {
          st.head = false;
          st.defNext = !!DEF_HEADS[w];
        } else if (st.defNext) {
          st.defNext = false;              // 定义名已消费, 只高亮一个
        }
        return cls;
      },
    };

    // 读取字符串剩余部分; 遇到结束引号则退出字符串状态
    function _readString(stream, st) {
      var q = st.str;
      while (!stream.eol()) {
        var c = stream.next();
        if (st.esc) { st.esc = false; continue; }
        if (q === '"' && c === '\\') { st.esc = true; continue; }
        if (c === q) { st.str = null; return 'string'; }
      }
      if (q === '`') st.str = null;       // 反引号串不跨行, 行尾强制结束
      return 'string';
    }
  });

  CodeMirror.defineMIME('text/x-alb', 'text/x-alb');
})();
