/**
 * CodeModeBlocks - 代码编程模式: 积木拖入代码框时转换为对应语言的代码
 *
 * 翻译来源（优先级从高到低）:
 *   1. 积木内联注册 def.code / def.codeFn —— register({ code: { python, javascript, alb } })
 *      模板占位: {参数名}=该语言字面量, {&参数名}=原样插入（自己写表达式）
 *   2. 扩展积木的 code_exp 属性（JS/Python: h.hello(), ALB: h_hello）
 *   3. 内置映射表 M（平铺 API 调用 / 代码骨架, 历史写法）
 *   4. 通用桥 run_block("积木类型", "参数名", 值, ...) —— 任何积木都能翻译并真实执行
 *   5. 事件帽 / C 型积木 / 带积木引用参数的积木 → 带说明的注释
 *
 * 内置积木 → CodeRuntime 平铺 API（三语言同名, ALB 为前缀式调用）
 */
const CodeModeBlocks = (function () {
  // 内置积木映射: call=平铺 API 调用, prop=属性赋值（仅 JS）, py=显式 Python, skel=代码骨架
  const M = {
    // --- 运动 ---
    move_steps:        { call: 'move',             args: ['steps'] },
    turn_right:        { call: 'turn_right',       args: ['deg'] },
    turn_left:         { call: 'turn_left',        args: ['deg'] },
    go_to_xy:          { call: 'goto_xy',          args: ['x', 'y'] },
    go_to_random:      { skel: ['goto_xy(random_int(-230, 230), random_int(-170, 170))'] },
    go_to_mouse:       { skel: ['goto_xy(mouse_x(), mouse_y())'] },
    go_to_sprite:      { call: 'goto_xy',          args: ['sprite_x("{{sprite}}")', 'sprite_y("{{sprite}}")'] },
    change_x:          { skel: ['change_x({{dx}})'] },
    set_x:             { call: 'set_x',            args: ['x'] },
    change_y:          { skel: ['change_y({{dy}})'] },
    set_y:             { call: 'set_y',            args: ['y'] },
    set_direction:     { call: 'point_in_direction', args: ['deg'] },
    change_direction:  { call: 'turn_right',       args: ['ddir'] },
    bounce_edge:       { call: 'bounce_edge' },
    point_towards_mouse:  { skel: ['point_towards_xy(mouse_x(), mouse_y())'] },
    point_towards_sprite: { call: 'point_towards_xy', args: ['sprite_x("{{sprite}}")', 'sprite_y("{{sprite}}")'] },
    get_x:             { call: 'get_x' },
    get_y:             { call: 'get_y' },
    get_direction:     { call: 'get_direction' },

    // --- 外观 ---
    looks_show:        { call: 'show' },
    looks_hide:        { call: 'hide' },
    looks_say:         { call: 'say_for',          args: ['text', 'sec'] },
    looks_say_nowait:  { call: 'say',              args: ['text'] },
    looks_think:       { call: 'think',            args: ['text'] },
    looks_next_costume:{ call: 'next_costume' },
    looks_set_costume: { call: 'set_costume',      args: ['name'] },
    looks_set_size:    { call: 'set_size',         args: ['size'] },
    looks_change_size: { call: 'change_size',      args: ['n'] },
    looks_get_size:    { call: 'get_size' },

    // --- 侦测 ---
    sensing_touching_edge:     { call: 'touching_edge' },
    sensing_touching_sprite:   { call: 'touching_sprite',  args: ['sprite'] },
    sensing_mouse_x:           { call: 'mouse_x' },
    sensing_mouse_y:           { call: 'mouse_y' },
    sensing_mouse_down:        { call: 'mouse_down' },
    sensing_key_pressed:       { call: 'key_pressed',      args: ['key'] },
    sensing_distance_to:       { call: 'distance_to',      args: ['sprite'] },
    sensing_timer:             { call: 'timer_now' },
    sensing_sprite_x:          { call: 'sprite_x',         args: ['sprite'] },
    sensing_sprite_y:          { call: 'sprite_y',         args: ['sprite'] },
    sensing_stage_width:       { call: 'stage_width' },
    sensing_stage_height:      { call: 'stage_height' },
    sensing_sprite_count:      { call: 'sprite_count' },
    is_at_edge:                { call: 'touching_edge' },

    // --- 声音 ---
    sound_play:        { call: 'play_sound',       args: ['name'] },
    sound_play_wait:   { call: 'play_sound',       args: ['name'] },
    sound_stop:        { call: 'stop_sounds' },
    sound_stop_name:   { call: 'stop_sounds' },
    sound_set_volume:  { call: 'set_volume',       args: ['vol'] },
    sound_change_volume: { skel: ['# TODO: 音量变化需先读当前音量', 'set_volume(50)'] },
    sound_get_volume:  { skel: ['get_var("__vol", 100)'] },

    // --- 变量 ---
    var_set:           { call: 'set_var',          args: ['name', 'val'] },
    var_change:        { call: 'change_var',       args: ['name', 'val'] },
    var_get:           { call: 'get_var',          args: ['name'] },

    // --- 运算 ---
    op_add:            { skel: ['({{a}} + {{b}})'] },
    op_sub:            { skel: ['({{a}} - {{b}})'] },
    op_mul:            { skel: ['({{a}} * {{b}})'] },
    op_div:            { skel: ['({{a}} / {{b}})'] },
    op_mod:            { py: ['({{a}} % {{b}})'], skel: ['({{a}} % {{b}})'] },
    op_pow:            { py: ['({{a}} ** {{b}})'], skel: ['({{a}} ** {{b}})'] },
    op_lt:             { skel: ['({{a}} < {{b}})'] },
    op_gt:             { skel: ['({{a}} > {{b}})'] },
    op_lte:            { skel: ['({{a}} <= {{b}})'] },
    op_gte:            { skel: ['({{a}} >= {{b}})'] },
    op_eq:             { skel: ['({{a}} == {{b}})'] },
    op_neq:            { skel: ['({{a}} != {{b}})'] },
    op_and:            { py: ['({{a}} and {{b}})'], skel: ['({{a}} && {{b}})'] },
    op_or:             { py: ['({{a}} or {{b}})'],  skel: ['({{a}} || {{b}})'] },
    op_not:            { py: ['not ({{a}})'],       skel: ['!({{a}})'] },
    op_random:         { call: 'random_int',       args: ['a', 'b'] },
    op_min:            { skel: ['# TODO: 最小值: min({{a}}, {{b}})'] },
    op_max:            { skel: ['# TODO: 最大值: max({{a}}, {{b}})'] },

    // --- 控制（无法一行对应的, 生成代码骨架） ---
    wait:              { skel: ['# TODO: 代码每帧执行一次, 等待请用帧计数或线程', 'set_var("__wait_until", timer_now() + {{sec}})'] },
    repeat:            { skel: ['for i in range({{times}}):', '    # TODO: 循环体'], js: ['for (let i = 0; i < {{times}}; i++) {', '    // TODO: 循环体', '}'], alb: ['(for-i i 0 {{times}} 1', '    ; TODO: 循环体', ')'] },
    forever:           { skel: ['# 代码本身每帧执行, 无需 forever; 如需后台循环用 thread_spawn'] },
    if_then:           { skel: ['if {{cond}}:', '    # TODO: 条件体'], js: ['if ({{cond}}) {', '    // TODO: 条件体', '}'], alb: ['(if {{cond}}', '    (do', '        ; TODO: 条件体', '    ))'] },
    if_else:           { skel: ['if {{cond}}:', '    # TODO: 成立时', 'else:', '    # TODO: 否则'], js: ['if ({{cond}}) {', '    // TODO: 成立时', '} else {', '    // TODO: 否则', '}'], alb: ['(if {{cond}}', '    (do', '        ; TODO: 成立时', '    )', '    (do', '        ; TODO: 否则', '    ))'] },
    repeat_until:      { skel: ['# TODO: 代码每帧执行, 建议反写条件后用 if 判断', 'if not ({{cond}}):', '    # TODO: 条件满足前重复的逻辑'] },
    stop_all:          { skel: ['# TODO: 停止全部脚本请点红色停止按钮'] },
    event_start:       { skel: ['# 当 🚩 启动时（代码每帧执行, 用 has_var 判断只跑一次）', 'if not has_var("started"):', '    set_var("started", 1)'], js: ['// 当 🚩 启动时（代码每帧执行, 用 globalVars 判断只跑一次）', 'if (!globalVars.started) {', '    globalVars.started = true;', '}'], alb: ['; 当 🚩 启动时（代码每帧执行, 用 get_var 判断只跑一次）', '(if (== (get_var "started" 0) 0)', '    (do (set_var "started" 1))', ')'] },
    event_key_pressed: { skel: ['if key_pressed("{{key}}"):', '    # TODO: 按键触发逻辑'], js: ['if (key_pressed("{{key}}")) {', '    // TODO: 按键触发逻辑', '}'], alb: ['(if (key_pressed "{{key}}")', '    (do', '        ; TODO: 按键触发逻辑', '    ))'] },
    event_broadcast:   { skel: ['# TODO: 广播消息 "{{msg}}"（积木运行时机制, 代码模式建议用共享变量通信）'] },
    event_receive:     { skel: ['# TODO: 接收广播 "{{msg}}"（用 get_var 判断共享变量）'] },
  };

  const ALIAS = {
    python: 'py', javascript: 'js', alb: 'alb',
    py: 'py', js: 'js', alb: 'alb',
  };

  function _isNum(v) {
    return typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v)));
  }

  /** 参数值 → 语言字面量（p 为参数定义, 用于区分数字/文本型空值） */
  function _lit(v, lang, p) {
    if (v === undefined || v === null) v = '';
    if (typeof v === 'boolean') {
      if (lang === 'python') return v ? 'True' : 'False';
      return v ? 'true' : 'false';
    }
    if (v === '' && p && (p.type === 'number' || p.type === 'color' || p.type === 'dropdown')) return '';
    if (_isNum(v)) return String(v);
    const s = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return '"' + s + '"';
  }

  /** ALB 字面量: 数字原样, 布尔原样, 字符串 "..." */
  function _albLit(v, lang, p) {
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (v === '' && p && (p.type === 'number' || p.type === 'color' || p.type === 'dropdown')) return '';
    if (_isNum(v)) return String(v);
    const s = String(v === undefined || v === null ? '' : v).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return '"' + s + '"';
  }

  /** 按语言取字面量 */
  function _litFor(v, lang, p) { return lang === 'alb' ? _albLit(v, lang, p) : _lit(v, lang, p); }

  /** 函数调用片段（raw=true 时 args 已是代码片段, 不再转字面量） */
  function _callStr(fname, args, lang, raw) {
    if (raw) return lang === 'alb' ? '(' + fname + ' ' + args.join(' ') + ')' : fname + '(' + args.join(', ') + ')';
    if (lang === 'alb') return '(' + fname + ' ' + args.map(a => _albLit(a, lang)).join(' ') + ')';
    return fname + '(' + args.map(a => _lit(a, lang)).join(', ') + ')';
  }

  /** 骨架行: 替换 {{param}} 占位符为字面量 */
  function _skelStr(line, params, lang, def) {
    return line.replace(/\{\{(\w+)\}\}/g, (_, name) => {
      const p = (def.params || []).find(q => q.name === name);
      const v = params[name] !== undefined ? params[name] : (p ? p.default : '');
      return _litFor(v, lang, p);
    });
  }

  function _comment(lang) { return lang === 'python' ? '#' : (lang === 'alb' ? ';' : '//'); }

  /** 积木内联代码翻译的语言键 */
  const CODE_KEYS = { python: ['python', 'py'], javascript: ['javascript', 'js'], alb: ['alb'] };

  /** 取积木定义上内联注册的代码翻译（def.code / def.codeFn） */
  function _defCode(def, lang) {
    if (!def) return null;
    if (typeof def.codeFn === 'function') {
      try {
        const r = def.codeFn(def, lang);
        if (r) return Array.isArray(r) ? r.map(String) : [String(r)];
      } catch (e) { /* 忽略, 继续用 code */ }
    }
    const c = def.code;
    if (!c || typeof c !== 'object') return null;
    const keys = CODE_KEYS[lang] || [lang];
    for (const k of keys) {
      if (c[k] !== undefined && c[k] !== null && c[k] !== '') return Array.isArray(c[k]) ? c[k].map(String) : [String(c[k])];
    }
    return null;
  }

  /** 内联模板行: {name} → 字面量, {&name} → 原样文本 */
  function _tplStr(line, params, lang, def) {
    let out = String(line).replace(/\{&(\w+)\}/g, (_, name) => {
      const p = (def.params || []).find(q => q.name === name);
      const v = params[name] !== undefined ? params[name] : (p ? p.default : '');
      return v === undefined || v === null ? '' : String(v);
    });
    out = out.replace(/\{(\w+)\}/g, (_, name) => {
      const p = (def.params || []).find(q => q.name === name);
      const v = params[name] !== undefined ? params[name] : (p ? p.default : '');
      let s = _litFor(v, lang, p);
      // 数字/布尔型参数为空时用中性默认值, 避免生成 ( + ) 这类残缺表达式
      if (s === '' && p && (p.type === 'number' || p.type === 'boolean')) s = '0';
      return s;
    });
    return out;
  }

  /** 通用桥: 任意积木 → run_block("type", "k", v, ...) （三语言均可真实执行） */
  function _autoBridge(def, params, lang) {
    if (!def) return null;
    const shape = def.shape || 'stack';
    if (shape === 'hat') return null;                                  // 事件入口
    if (shape === 'c-block' || shape === 'c-block-reporter') return null; // 子代码槽
    const args = [];
    for (const p of (def.params || [])) {
      if (p.type === 'block') return null;                             // 积木引用参数无法用值表达
      args.push({ name: p.name, v: params[p.name] !== undefined ? params[p.name] : p.default, p });
    }
    if (lang === 'alb') {
      const parts = ['(run_block', _albLit(def.type, lang)];
      args.forEach(a => { parts.push(_albLit(a.name, lang)); parts.push(_albLit(a.v, lang, a.p) || '""'); });
      return [parts.join(' ') + ')'];
    }
    const js = ['"' + def.type + '"'];
    args.forEach(a => { js.push('"' + a.name + '"'); js.push(_lit(a.v, lang, a.p) || 'null'); });
    return ['run_block(' + js.join(', ') + ')'];
  }

  /** 无法转换时的说明 */
  function _untranslatable(def, lang) {
    const name = def.label || def.type;
    const shape = def.shape || 'stack';
    if (shape === 'hat') return [_comment(lang) + ' ' + name + '：事件入口积木，代码模式逐帧执行代码本身，不需入口'];
    if (shape === 'c-block' || shape === 'c-block-reporter') return [_comment(lang) + ' ' + name + '：含子代码的积木，请用语言原生的循环/条件语句'];
    return [_comment(lang) + ' ' + name + '：该积木的参数含积木引用，请保留积木形式或用函数/线程表达'];
  }

  /** 处理扩展 code_exp 积木 */
  function _extCode(blockDef, params, lang) {
    const ce = blockDef.code_exp || {};
    const args = (blockDef.params || []).map(p => params[p.name] !== undefined ? params[p.name] : p.default);
    if (lang === 'alb') {
      if (!ce.ALB) return null;
      // ALB: 扩展名称前缀 + "_" + 函数名
      const fname = blockDef._extObjName + '_' + ce.ALB;
      return '(' + fname + (args.length ? ' ' + args.map(a => _albLit(a, lang)).join(' ') : '') + ')';
    }
    const fname = lang === 'python' ? ce.python : ce.JavaScript;
    const objName = blockDef._extObjName;
    if (!fname || !objName) return null;
    return objName + '.' + fname + '(' + args.map(a => _lit(a, lang)).join(', ') + ')';
  }

  /**
   * 积木 → 当前语言代码片段
   * @param {string} blockType 积木类型
   * @param {string} lang 'python' | 'javascript' | 'alb'
   * @returns {string[]|null} 代码行数组（多行=骨架）, 积木不存在时返回 null
   */
  function toCode(blockType, lang) {
    if (typeof BlockRegistry === 'undefined') return null;
    const def = BlockRegistry.getBlock(blockType);
    if (!def) return null;
    const params = {};
    (def.params || []).forEach(p => { params[p.name] = p.default; });

    // 1. 积木内联注册的多语言代码翻译
    const inline = _defCode(def, lang);
    if (inline) return inline.map(l => _tplStr(l, params, lang, def));

    // 2. 扩展积木: code_exp 属性（没有当前语言的 code_exp 时继续向下走通用桥）
    if (def.category && typeof ExtensionManager !== 'undefined' && ExtensionManager.getCodeExpApis) {
      const apis = ExtensionManager.getCodeExpApis();
      outer: for (const ext of apis) {
        const fkeys = Object.keys(ext.fns);
        for (const fk of fkeys) {
          const e = ext.fns[fk];
          if (e.def && e.def.type === blockType) {
            const d = Object.assign({}, def, { _extObjName: ext.objName, code_exp: e.def.code_exp });
            const code = _extCode(d, params, lang);
            if (code) return [code];
            break outer;
          }
        }
      }
    }

    // 3. 内置映射表
    const m = M[blockType];
    if (m) {
      // 语言显式写法 > 通用函数调用 > 骨架
      const langKey = ALIAS[lang];
      if (m[langKey]) return m[langKey].map(l => _skelStr(l, params, lang, def));
      if (m.call) {
        const args = (m.args || []).map(a => {
          // '{{sprite}}' 内嵌占位（作为字符串参数一部分）
          const p = (def.params || []).find(q => q.name === a.replace(/[{}"]/g, ''));
          if (a.indexOf('{{') >= 0) return params[a.replace(/[{}"]/g, '')] !== undefined ? params[a.replace(/[{}"]/g, '')] : (p ? p.default : '');
          return params[a] !== undefined ? params[a] : (p ? p.default : '');
        });
        return [_callStr(m.call, args, lang)];
      }
      if (m.skel) {
        let lines = m.skel;
        if (lang === 'javascript' && m.js) lines = m.js;
        else if (lang === 'alb' && m.alb) lines = m.alb;
        return lines.map(l => _skelStr(l, params, lang, def));
      }
      return [_comment(lang) + ' ' + (def.label || blockType)];
    }

    // 4. 通用桥: run_block（任何积木都能转, 开台时真实执行）
    const auto = _autoBridge(def, params, lang);
    if (auto) return auto;

    // 5. 说不好转的: 给出可用提示
    return _untranslatable(def, lang);
  }

  /** 当前语言下该积木是否能转成可运行代码（非注释） */
  function isTranslatable(blockType, lang) {
    const lines = toCode(blockType, lang);
    if (!lines || !lines.length) return false;
    return String(lines[0]).indexOf(_comment(lang)) !== 0;
  }

  /** 可代码化的积木总数统计（供文档/诊断使用） */
  function getCoverage() {
    if (typeof BlockRegistry === 'undefined') return { total: 0, ok: 0 };
    const all = BlockRegistry.getAllBlocks();
    const types = Object.keys(all);
    let ok = 0;
    types.forEach(t => { if (isTranslatable(t, 'python') && isTranslatable(t, 'javascript') && isTranslatable(t, 'alb')) ok++; });
    return { total: types.length, ok };
  }

  return { toCode, isTranslatable, getCoverage };
})();

if (typeof window !== 'undefined') window.CodeModeBlocks = CodeModeBlocks;
