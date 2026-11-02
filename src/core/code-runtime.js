/**
 * CodeRuntime - 代码编程模式运行时
 *
 * 让 Python / JavaScript / ALB 代码可以直接操作 Objector 舞台与角色：
 *   - 每帧执行一次用户代码（与高级模式 JS 脚本语义一致）
 *   - 通过 globalVars / get_var / set_var 在帧之间保持状态
 *   - Python / ALB 由 interpreter/ 目录下的纯 JS 解释器执行（Skulpt / alb.js）
 *   - JavaScript 直接使用引擎执行（new Function）
 *
 * 对外接口:
 *   CodeRuntime.start(lang, getCodeOrSources, opts)  // lang: 'javascript' | 'python' | 'alb'
 *     getCodeOrSources: (() => code) 单代码源, 或 [{name, idx, getCode}] 按角色代码源列表（多角色逐帧执行）
 *   CodeRuntime.stop()
 *   CodeRuntime.isRunning()
 *   opts: { onOutput(text), onFrame(), interval? }
 */
const CodeRuntime = (function () {
  let _running = false;
  let _timer = null;
  let _busy = false;
  let _lang = 'javascript';
  let _codeSources = [];  // [{name, idx?, getCode}] 每帧依次执行, 执行前绑定对应角色
  let _opts = null;
  let _vars = {};        // 跨帧持久变量
  let _startTime = 0;
  let _jsCache = new Map();  // 代码源 -> { fn, args }（JS 编译缓存）
  let _alb = null;       // ALB 解释器实例（每次 start 新建, 隔离环境）
  let _curBoundIdx = -1; // 当前执行上下文绑定的角色索引（线程 spawn 时继承）

  const DEFAULT_INTERVAL = { javascript: 33, alb: 33, python: 100 };

  // ============================================================
  // 协作式多线程调度器
  // JS 引擎只有一个主线程, 因此线程语义是"事件循环时间片":
  //   thread_spawn 登记的函数会按自己的周期在事件循环上轮流执行,
  //   与主帧循环/其它线程彼此交错但不抢占, 共享 get_var/set_var 即安全.
  // 三种语言均可用; 宿主侧通过解释器自带的 setFunc 注入, 也可随时被宿主重新配置.
  // ============================================================
  let _threads = new Map();     // id -> { fn, iv, next, dead, spriteIdx }
  let _threadSeq = 0;
  let _curThread = 0;           // 正在执行的线程 id, 主线程为 0
  let _threadTimer = null;
  const THREAD_TICK = 20;       // 调度器扫描周期(ms)
  const THREAD_MIN_IV = 16;     // 单线程最小周期(ms)

  function _threadTick() {
    if (!_running) { _stopThreadTimer(); return; }
    const now = Date.now();
    let alive = false;
    _threads.forEach((t, id) => {
      if (t.dead) { _threads.delete(id); return; }
      alive = true;
      if (now < t.next) return;
      t.next = now + t.iv;
      _curThread = id;
      // 线程绑定创建时的角色上下文（协作式调度下切换活动角色是安全的）
      const prevBound = _curBoundIdx;
      if (t.spriteIdx >= 0) { try { const f = _flatAPI(); f.set_sprite(t.spriteIdx); _curBoundIdx = t.spriteIdx; } catch (e) { /* ignore */ } }
      try { t.fn(); } catch (e) {
        _emit('❌ 线程 ' + id + ' 出错终止: ' + (e && e.message ? e.message : String(e)));
        t.dead = true;
      }
      _curBoundIdx = prevBound;
      _curThread = 0;
      // 线程修改过舞台后也及时刷新面板
      if (_opts && typeof _opts.onFrame === 'function') { try { _opts.onFrame(); } catch (e) { /* ignore */ } }
    });
    if (!alive) _stopThreadTimer();
  }

  function _startThreadTimer() {
    if (!_threadTimer && _running) _threadTimer = setInterval(_threadTick, THREAD_TICK);
  }

  function _stopThreadTimer() {
    if (_threadTimer) { clearInterval(_threadTimer); _threadTimer = null; }
  }

  function _killAllThreads() {
    _threads.forEach(t => { t.dead = true; });
    _threads.clear();
    _stopThreadTimer();
    _curThread = 0;
  }

  function _SM() { return (typeof StageManager !== 'undefined') ? StageManager : null; }
  function _SI() { return (typeof SensingInput !== 'undefined') ? SensingInput : null; }
  function _SND() { return (typeof SoundManager !== 'undefined') ? SoundManager : null; }
  function _EX() { return (typeof Executor !== 'undefined') ? Executor : null; }

  // ============================================================
  // 积木桥接（代码模式 run_block / 列表助手）
  // ============================================================

  /** 取积木的全局变量中的列表（不存在则创建一个空列表, 与积木行为一致） */
  function _blkList(name) {
    const EX = _EX();
    if (!EX || !EX.getVarValue) return [];
    let v = EX.getVarValue(String(name));
    if (Array.isArray(v)) return v;
    if (v === undefined || v === null) { EX.setVarValue(String(name), []); return EX.getVarValue(String(name)); }
    return [v];
  }

  /** run_block 的异步结果缓存: 'type|参数' → 上一次完成执行的返回值 */
  const _blkValues = new Map();
  function _blkKey(type, params) {
    try { return type + '|' + JSON.stringify(params); } catch (e) { return type + '|' + String(Math.random()); }
  }

  function _emit(text) {
    if (_opts && typeof _opts.onOutput === 'function') _opts.onOutput(String(text));
  }

  // ============================================================
  // 共享游戏 API（snake_case, 注入 Python / ALB; JS 另有对象式 API）
  // 所有角色操作默认作用于当前活动角色（set_sprite 可切换）
  // ============================================================
  function _flatAPI() {
    const SM = _SM();
    const idx = () => SM ? SM.getActiveSpriteIdx() : 0;
    const raw = () => SM ? SM.getActiveSprite() : null;
    const num = (v, def) => { const n = Number(v); return Number.isFinite(n) ? n : (def || 0); };

    return {
      // --- 角色切换 ---
      set_sprite: (name_or_idx) => {
        if (!SM) return -1;
        if (typeof name_or_idx === 'number' || /^\d+$/.test(String(name_or_idx))) {
          SM.setActiveSprite(num(name_or_idx, 0));
        } else {
          const i = SM.getSpriteIndexByName(String(name_or_idx));
          if (i >= 0) SM.setActiveSprite(i);
        }
        return idx();
      },
      sprite_name: () => { const s = raw(); return s ? s.name : ''; },
      sprite_count: () => SM ? SM.getSpriteCount() : 0,

      // --- 运动 ---
      get_x: () => { const s = raw(); return s ? s.x : 0; },
      get_y: () => { const s = raw(); return s ? s.y : 0; },
      get_direction: () => { const s = raw(); return s ? s.direction : 90; },
      get_size: () => { const s = raw(); return s ? s.size : 100; },
      set_x: (v) => { const s = raw(); if (s) s.x = num(v); },
      set_y: (v) => { const s = raw(); if (s) s.y = num(v); },
      change_x: (v) => { const s = raw(); if (s) s.x += num(v); },
      change_y: (v) => { const s = raw(); if (s) s.y += num(v); },
      goto_xy: (x, y) => { if (SM) SM.setSpritePos(idx(), num(x), num(y)); },
      move: (steps) => { if (SM) SM.moveSprite(idx(), num(steps)); },
      turn_right: (deg) => { if (SM) SM.rotateSprite(idx(), num(deg)); },
      turn_left: (deg) => { if (SM) SM.rotateSprite(idx(), -num(deg)); },
      point_in_direction: (deg) => { if (SM) SM.setSpriteDir(idx(), num(deg)); },
      bounce_edge: () => { if (SM) SM.bounceSprite(idx()); },
      point_towards_xy: (x, y) => { if (SM) SM.pointTowards(idx(), num(x), num(y)); },

      // --- 外观 ---
      show: () => { if (SM) SM.setSpriteVisible(idx(), true); },
      hide: () => { if (SM) SM.setSpriteVisible(idx(), false); },
      set_size: (v) => { if (SM) SM.setSpriteSize(idx(), num(v, 100)); },
      change_size: (d) => { if (SM) SM.changeSpriteSize(idx(), num(d)); },
      say: (text) => { if (SM) SM.setSpriteSay(idx(), String(text)); },
      clear_say: () => { if (SM) SM.setSpriteSay(idx(), ''); },
      say_for: (text, sec) => {
        if (!SM) return;
        SM.setSpriteSay(idx(), String(text));
        const at = idx();
        setTimeout(() => { const s = SM.getSprite(at); if (s && s.sayText) SM.setSpriteSay(at, ''); }, num(sec, 1) * 1000);
      },
      think: (text) => { if (SM) SM.setSpriteSay(idx(), '\u{1F4AD} ' + String(text)); },
      set_costume: (name) => { if (SM) Promise.resolve(SM.setSpriteCostumeByName(idx(), String(name))).catch(() => {}); },
      next_costume: () => {
        if (typeof CostumeManager === 'undefined' || !SM) return;
        const names = CostumeManager.getAllNames();
        if (!names.length) return;
        const s = raw();
        const cur = names.indexOf(s && s.costumeName || '');
        Promise.resolve(SM.setSpriteCostume(idx(), names[(cur + 1) % names.length])).catch(() => {});
      },

      // --- 侦测 ---
      stage_width: () => SM ? SM.STAGE_W : 480,
      stage_height: () => SM ? SM.STAGE_H : 360,
      mouse_x: () => _SI() ? _SI().getMouseX() : 0,
      mouse_y: () => _SI() ? _SI().getMouseY() : 0,
      mouse_down: () => _SI() ? _SI().isMouseDown() : false,
      key_pressed: (key) => _SI() ? _SI().isKeyPressed(String(key)) : false,
      touching_edge: () => SM ? SM.isTouchingEdge(idx()) : false,
      touching_sprite: (name) => {
        if (!SM) return false;
        const other = SM.getSpriteIndexByName(String(name));
        return other >= 0 ? SM.isTouchingSprite(idx(), other) : false;
      },
      distance_to: (name) => {
        if (!SM) return 0;
        const other = SM.getSpriteIndexByName(String(name));
        return other >= 0 ? SM.distanceToSprite(idx(), other) : 0;
      },
      sprite_x: (name) => { const s = SM ? SM.getSpriteByName(String(name)) : null; return s ? s.x : 0; },
      sprite_y: (name) => { const s = SM ? SM.getSpriteByName(String(name)) : null; return s ? s.y : 0; },
      timer_now: () => Date.now() / 1000 - _startTime,

      // --- 声音 ---
      play_sound: (name) => { const SND = _SND(); if (SND) SND.play(String(name)); },
      stop_sounds: () => { const SND = _SND(); if (SND) SND.stopAll(); },
      set_volume: (v) => { const SND = _SND(); if (SND) SND.setVolume(num(v, 100)); },

      // --- 运算 ---
      random_int: (a, b) => { const lo = Math.min(num(a), num(b)), hi = Math.max(num(a), num(b)); return Math.floor(Math.random() * (hi - lo + 1)) + lo; },

      // --- 跨帧变量 ---
      get_var: (name, def) => { const k = String(name); return k in _vars ? _vars[k] : num(def, 0); },
      set_var: (name, v) => { _vars[String(name)] = v; },
      change_var: (name, d) => { const k = String(name); _vars[k] = num(_vars[k], 0) + num(d); return _vars[k]; },
      has_var: (name) => String(name) in _vars,
      var_names: () => Object.keys(_vars),

      // --- 输出 ---
      log: (...args) => _emit(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')),

      // --- 多线程（协作式, 接收函数值: ALB 传 (func () ...) / Python 传 def 函数 / JS 传 function）---
      thread_spawn: (fn, interval) => {
        if (typeof fn !== 'function') throw new Error('thread_spawn 需要一个函数参数, 用法: thread_spawn(工作函数) 或 thread_spawn(工作函数, 周期ms)');
        if (!_running) throw new Error('thread_spawn 只能在运行中调用');
        const id = ++_threadSeq;
        const iv = Math.max(THREAD_MIN_IV, num(interval, 0) || 33);
        // 绑定当前执行上下文的角色, 线程内所有 API 调用作用于该角色
        const SM = _SM();
        const boundIdx = _curBoundIdx >= 0 ? _curBoundIdx : (SM ? SM.getActiveSpriteIdx() : -1);
        _threads.set(id, { fn, iv, next: Date.now() + iv, dead: false, spriteIdx: boundIdx });
        _startThreadTimer();
        return id;
      },
      thread_kill: (id) => {
        const t = _threads.get(num(id, -1));
        if (!t) return 0;
        t.dead = true;
        _threads.delete(num(id, -1));
        return 1;
      },
      thread_list: () => Array.from(_threads.keys()).filter(id => !_threads.get(id).dead),
      thread_id: () => _curThread,  // 工作函数内调用得到自己的线程 id, 否则为 0(主线程)

      // --- 积木桥接 API（run_block / math_* / str_* / blk_* / 侦测补充） ---
      ..._blockAPI(),
    };
  }

  // ============================================================
  // 积木桥接 API（三语言同名）: 让任何积木都能在代码里直接跑
  // 由 _flatAPI() 末尾并入, start() 时随其它 API 一起注入 JS/Python/ALB
  // ============================================================
  function _blockAPI() {
    const SM = _SM();
    const num = (v, def) => { const n = Number(v); return Number.isFinite(n) ? n : (def || 0); };
    const pad = (n) => String(n).padStart(2, '0');
    return {
      /** 执行任意积木: run_block("积木类型", "参数名", 值, "参数名", 值, ...)
       *  副作用立即发生; 同步积木直接返回值, 异步积木（滑行的回报积木等）
       *  本帧返回上一帧的完成结果（首帧为 undefined）, 便于在每帧重跑的代码模式下取值 */
      run_block: function (type, ...kv) {
        const EX = _EX();
        if (!EX || !EX.execBlockType) throw new Error('积木执行器不可用');
        const params = {};
        for (let i = 0; i + 1 < kv.length; i += 2) params[String(kv[i])] = kv[i + 1];
        const key = _blkKey(String(type), params);
        const prev = _blkValues.get(key);
        let r;
        try { r = EX.execBlockType(String(type), params); }
        catch (e) { throw new Error('积木 ' + type + ' 执行失败: ' + (e && e.message ? e.message : String(e))); }
        if (r && typeof r.then === 'function') {
          r.then(v => { _blkValues.set(key, v); },
                 e => { _blkValues.set(key, undefined); _emit('❌ 积木 ' + type + ' 出错: ' + (e && e.message ? e.message : String(e))); });
          return prev;
        }
        _blkValues.set(key, r);
        return r;
      },

      // --- 数学（避免与各语言内置函数冲突, 统一 math_ 前缀） ---
      math_abs: (v) => Math.abs(num(v)),
      math_floor: (v) => Math.floor(num(v)),
      math_ceil: (v) => Math.ceil(num(v)),
      math_round: (v, digits) => { const m = Math.pow(10, num(digits, 0)); return Math.round(num(v) * m) / m; },
      math_sqrt: (v) => Math.sqrt(num(v)),
      math_sign: (v) => Math.sign(num(v)),
      math_sin: (v) => Math.sin(num(v)),
      math_cos: (v) => Math.cos(num(v)),
      math_tan: (v) => Math.tan(num(v)),
      math_asin: (v) => Math.asin(num(v)),
      math_acos: (v) => Math.acos(num(v)),
      math_atan: (v) => Math.atan(num(v)),
      math_atan2: (y, x) => Math.atan2(num(y), num(x)),
      math_exp: (v) => Math.exp(num(v)),
      math_log: (v) => Math.log(num(v)),
      math_log2: (v) => Math.log2(num(v)),
      math_log10: (v) => Math.log10(num(v)),
      math_min: (a, b) => Math.min(num(a), num(b)),
      math_max: (a, b) => Math.max(num(a), num(b)),
      math_clamp: (v, lo, hi) => Math.max(num(lo), Math.min(num(hi), num(v))),
      math_lerp: (a, b, t) => num(a) + (num(b) - num(a)) * num(t),
      math_pi: () => Math.PI,
      math_e: () => Math.E,

      // --- 文本 ---
      str_len: (s) => String(s === undefined || s === null ? '' : s).length,
      str_upper: (s) => String(s === undefined || s === null ? '' : s).toUpperCase(),
      str_lower: (s) => String(s === undefined || s === null ? '' : s).toLowerCase(),
      str_trim: (s) => String(s === undefined || s === null ? '' : s).trim(),
      str_repeat: (s, n) => String(s === undefined || s === null ? '' : s).repeat(Math.max(0, num(n))),
      str_replace: (s, from, to) => String(s || '').split(String(from)).join(String(to)),
      str_contains: (s, sub) => String(s || '').indexOf(String(sub)) >= 0,
      str_index_of: (s, sub) => { const i = String(s || '').indexOf(String(sub)); return i < 0 ? 0 : i + 1; },
      str_letter: (s, i) => String(s || '').charAt(Math.max(0, num(i) - 1)),
      str_sub: (s, start, end) => String(s || '').substring(num(start) - 1, num(end)),
      str_of: (v) => String(v === undefined || v === null ? '' : v),
      num_of: (v) => { const n = parseFloat(String(v)); return Number.isFinite(n) ? n : 0; },
      str_newline: () => '\n',

      // --- 积木列表（索引从 1 开始, 与积木一致） ---
      blk_var: (name) => { const EX = _EX(); return EX ? EX.getVarValue(String(name)) : undefined; },
      blk_set_var: (name, val) => { const EX = _EX(); if (EX) EX.setVarValue(String(name), val); },
      blk_list_len: (name) => _blkList(name).length,
      blk_list_get: (name, i) => { const a = _blkList(name), k = num(i) - 1; return k >= 0 && k < a.length ? a[k] : ''; },
      blk_list_push: (name, val) => { _blkList(name).push(val); },
      blk_list_insert: (name, i, val) => { _blkList(name).splice(Math.max(0, num(i) - 1), 0, val); },
      blk_list_set: (name, i, val) => { const a = _blkList(name), k = num(i) - 1; if (k >= 0 && k < a.length) a[k] = val; },
      blk_list_delete: (name, i) => { const a = _blkList(name), k = num(i) - 1; if (k >= 0 && k < a.length) a.splice(k, 1); },
      blk_list_clear: (name) => { _blkList(name).length = 0; },
      blk_list_has: (name, val) => _blkList(name).some(x => String(x) === String(val)),
      blk_list_index: (name, val) => { const i = _blkList(name).findIndex(x => String(x) === String(val)); return i < 0 ? 0 : i + 1; },
      blk_list_join: (name, sep) => _blkList(name).join(sep === undefined ? ',' : String(sep)),
      blk_list_reverse: (name) => { const a = _blkList(name); a.reverse(); },
      blk_list_sort: (name, desc) => {
        const a = _blkList(name);
        const down = /^(1|true|降|desc|降序|descending)$/i.test(String(desc === undefined ? '' : desc));
        a.sort((x, y) => { const nx = Number(x), ny = Number(y); const c = (Number.isFinite(nx) && Number.isFinite(ny)) ? nx - ny : String(x).localeCompare(String(y)); return down ? -c : c; });
      },

      // --- 侦测补充 ---
      /** 阻塞等待若干秒（主线程与线程内均可用; 主线程会占用当帧时间） */
      sleep: (sec) => {
        const ms = Math.max(0, num(sec) * 1000);
        if (ms > 20000) throw new Error('sleep 单次最长 20 秒');
        if (typeof Atomics !== 'undefined' && typeof SharedArrayBuffer !== 'undefined') {
          try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); return; } catch (e) { /* 部分环境不支持, 降级为轮询 */ }
        }
        const end = Date.now() + ms;
        while (Date.now() < end) { /* 协作式降级: 忙等 */ }
      },
      /** 若干秒后在后台执行一次代码片段（代码字符串, 不是函数对象） */
      schedule: (sec, codeStr) => {
        const ms = Math.max(0, num(sec) * 1000);
        const src = String(codeStr || '');
        if (_lang === 'javascript') {
          setTimeout(() => { try { new Function(src)(); } catch (e) { _emit('❌ schedule: ' + (e && e.message ? e.message : e)); } }, ms);
        } else if (_lang === 'alb' && _alb) {
          const A = _alb; setTimeout(() => { try { A.run(src); } catch (e) { _emit('❌ schedule: ' + (e && e.message ? e.message : e)); } }, ms);
        } else {
          setTimeout(() => {
            if (typeof PyRunner === 'undefined' || !PyRunner.isReady()) { _emit('❌ schedule: Python 解释器未加载'); return; }
            Promise.resolve(PyRunner.run(src)).then(r => {
              (r.output || []).forEach(_emit);
              if (r.error) _emit('❌ schedule: ' + r.error);
            }, e => _emit('❌ schedule: ' + (e && e.message ? e.message : e)));
          }, ms);
        }
        return 1;
      },
      /** 停止代码模式运行（与点红色停止按钮一致） */
      stop_all: () => { _stopSafe(); return 1; },

      sprite_direction: (name) => { const s = SM ? SM.getSpriteByName(String(name)) : null; return s ? s.direction : 90; },
      sprite_size: (name) => { const s = SM ? SM.getSpriteByName(String(name)) : null; return s ? s.size : 100; },
      answer: () => { const EX = _EX(); return EX && EX.getAnswer ? EX.getAnswer() : ''; },
      username: () => '用户',
      timestamp: () => Date.now(),
      current_time: (unit) => {
        const d = new Date(), u = String(unit || '秒');
        if (u === '年' || /^year$/i.test(u)) return d.getFullYear();
        if (u === '月' || /^month$/i.test(u)) return d.getMonth() + 1;
        if (u === '日' || /^day$/i.test(u)) return d.getDate();
        if (u === '星期' || /^weekday$/i.test(u)) return d.getDay();
        if (u === '时' || /^hour$/i.test(u)) return d.getHours();
        if (u === '分' || /^minute$/i.test(u)) return d.getMinutes();
        if (u === '秒' || /^second$/i.test(u)) return d.getSeconds();
        return d.getSeconds();
      },
      format_time: (fmt, ts) => {
        const d = ts === undefined || ts === null || ts === '' ? new Date() : new Date(num(ts));
        return String(fmt || 'yyyy-MM-dd HH:mm:ss')
          .replace('yyyy', d.getFullYear()).replace('MM', pad(d.getMonth() + 1)).replace('dd', pad(d.getDate()))
          .replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes())).replace('ss', pad(d.getSeconds()));
      },
    };
  }

  /** JS 版 sprite 代理对象（camelCase, 语法糖） */
  function _jsSpriteObject(f) {
    const SM = _SM();
    const raw = () => SM ? SM.getActiveSprite() : null;
    const p = {};
    Object.defineProperties(p, {
      x: { get: () => { const s = raw(); return s ? s.x : 0; }, set: (v) => { const s = raw(); if (s) s.x = Number(v) || 0; } },
      y: { get: () => { const s = raw(); return s ? s.y : 0; }, set: (v) => { const s = raw(); if (s) s.y = Number(v) || 0; } },
      direction: { get: () => { const s = raw(); return s ? s.direction : 90; }, set: (v) => { const s = raw(); if (s) s.direction = Number(v) || 0; } },
      size: { get: () => { const s = raw(); return s ? s.size : 100; }, set: (v) => { const s = raw(); if (s) s.size = Number(v) || 0; } },
      visible: { get: () => { const s = raw(); return s ? s.visible !== false : false; }, set: (v) => { if (SM) SM.setSpriteVisible(SM.getActiveSpriteIdx(), !!v); } },
      name: { get: () => { const s = raw(); return s ? s.name : ''; } },
    });
    p.say = f.say; p.sayFor = f.say_for; p.think = f.think; p.clearSay = f.clear_say;
    p.show = f.show; p.hide = f.hide;
    p.move = f.move; p.turnRight = f.turn_right; p.turnLeft = f.turn_left;
    p.goTo = (x, y) => f.goto_xy(x, y); p.bounce = f.bounce_edge;
    p.setSize = f.set_size; p.changeSize = f.change_size;
    p.pointInDirection = f.point_in_direction;
    p.setCostume = f.set_costume; p.nextCostume = f.next_costume;
    return p;
  }

  /** JS 版 stage 全局对象 */
  function _jsStageObject(f) {
    const SI = _SI();
    return {
      get width() { return f.stage_width(); },
      get height() { return f.stage_height(); },
      get mouseX() { return f.mouse_x(); },
      get mouseY() { return f.mouse_y(); },
      mouseDown: f.mouse_down,
      keyPressed: f.key_pressed,
      touchingEdge: f.touching_edge,
      touchingSprite: f.touching_sprite,
      distanceTo: f.distance_to,
      spriteX: f.sprite_x, spriteY: f.sprite_y,
      setSprite: f.set_sprite, spriteCount: f.sprite_count,
      playSound: f.play_sound, stopSounds: f.stop_sounds, setVolume: f.set_volume,
      randomInt: f.random_int,
      timer: f.timer_now,
      sprites: () => { const SM = _SM(); return SM ? SM.getSprites() : []; },
    };
  }

  // ============================================================
  // 各语言单帧执行
  // ============================================================

  /** 编译/取缓存的 JS 帧函数（每个代码源独立缓存） */
  function _compileJS(srcKey, code) {
    let ent = _jsCache.get(srcKey);
    if (!ent || ent.key !== code) {
      const f = _flatAPI();
      const sprite = _jsSpriteObject(f);
      const stage = _jsStageObject(f);
      // 常用平铺函数（与积木语义一致）+ snake_case API 全量透传 + 扩展命名空间对象
      const names = Object.keys(f).concat(['sprite', 'stage', 'globalVars', 'log']).concat(_extNSList.map(ns => ns.objName));
      const values = Object.keys(f).map(k => f[k]).concat([sprite, stage, _vars, f.log]).concat(_extNSList.map(ns => ns.fns));
      ent = { fn: new Function(...names, code), key: code, args: values };
      _jsCache.set(srcKey, ent);
    }
    return ent;
  }

  function _runFrameJS(entry) {
    const code = String(entry.getCode() || '');
    if (!code.trim()) return;
    const ent = _compileJS(entry, code);
    ent.fn(...ent.args);
  }

  function _runFrameALB(code) {
    if (!_alb) return;
    const r = _alb.run(code);
    (r.output || []).forEach(_emit);
    if (r.error) _emit('❌ ' + r.error);
  }

  function _runFramePython(code) {
    if (typeof PyRunner === 'undefined' || !PyRunner.isReady()) {
      _emit('❌ Python 解释器未加载 (interpreter/skulpt.min.js)');
      return Promise.resolve();
    }
    return PyRunner.run(code).then(r => {
      (r.output || []).forEach(_emit);
      if (r.error) _emit('❌ ' + r.error);
    });
  }

  // ============================================================
  // 解释器注入（start 时执行一次）
  // ============================================================

  /**
   * 扩展 code_exp: 已安装扩展积木的非必填属性
   *   { "python": "hello", "ALB": "hello", "JavaScript": "hello" }  —— 对应语言下的函数名
   * JS / Python: 按扩展名创建命名空间对象, 调用形如 h.hello()
   * ALB: 调用时函数名前加扩展名并用"_"分隔, 如 h_hello（直接 setFunc 注册）
   * 返回: JS/Python 为 [{objName, fns}], ALB 的函数已就地 setFunc 注入
   */
  function _buildExtAPIs(lang) {
    const result = [];
    if (typeof ExtensionManager === 'undefined' || !ExtensionManager.getCodeExpApis) return result;
    const SM = _SM();
    ExtensionManager.getCodeExpApis().forEach(ext => {
      const fns = {};
      Object.keys(ext.fns).forEach(fname => {
        const e = ext.fns[fname];
        const apiName = e.def && e.def.code_exp && e.def.code_exp[lang === 'javascript' ? 'JavaScript' : (lang === 'python' ? 'python' : 'ALB')];
        if (!apiName) return;
        if (lang === 'alb') {
          const wrapper = _makeExtWrapper(e, SM);
          // ALB: 扩展名称前缀 + "_" + 函数名
          try { _alb.setFunc(ext.objName + '_' + apiName, wrapper); } catch (err) { /* 跳过不支持的名字 */ }
          return;
        }
        fns[apiName] = _makeExtWrapper(e, SM);
      });
      if (lang !== 'alb' && Object.keys(fns).length) result.push({ objName: ext.objName, fns });
    });
    return result;
  }

  /** 把扩展函数包装为按 blockDef.params 顺序接收位置参数的可调用函数 */
  function _makeExtWrapper(e, SM) {
    const paramNames = ((e.def && e.def.params) || []).map(p => p.name);
    return function (...args) {
      const params = {};
      paramNames.forEach((n, i) => { params[n] = args[i]; });
      const scope = SM ? { sprite: SM.getActiveSprite(), spriteIdx: SM.getActiveSpriteIdx() } : {};
      const r = e.exec(params, scope);
      if (r && typeof r.then === 'function') return undefined; // 异步执行器不阻塞帧循环
      return r;
    };
  }

  function _injectForLanguage(lang) {
    const f = _flatAPI();
    if (lang === 'alb') {
      if (typeof createALB === 'function') {
        _alb = createALB();
      } else if (typeof ALB !== 'undefined') {
        _alb = ALB.createALB ? ALB.createALB() : ALB;
      } else {
        _alb = null;
        _emit('❌ ALB 解释器未加载 (interpreter/alb.js)');
        return false;
      }
      Object.keys(f).forEach(k => { try { _alb.setFunc(k, f[k]); } catch (e) { /* 跳过不支持的名字 */ } });
      _alb.setConst('STAGE_W', f.stage_width());
      _alb.setConst('STAGE_H', f.stage_height());
      _buildExtAPIs('alb');
      return true;
    }
    if (lang === 'python') {
      if (typeof PyRunner === 'undefined' || !PyRunner.isReady()) {
        _emit('❌ Python 解释器未加载 (interpreter/skulpt.min.js)');
        return false;
      }
      Object.keys(f).forEach(k => { try { PyRunner.setFunc(k, f[k]); } catch (e) { /* ignore */ } });
      PyRunner.setConst('STAGE_W', f.stage_width());
      PyRunner.setConst('STAGE_H', f.stage_height());
      _buildExtAPIs('python').forEach(ns => { try { PyRunner.setObjectGroup(ns.objName, ns.fns); } catch (e) { /* ignore */ } });
      return true;
    }
    if (lang === 'javascript') {
      // JS: 收集命名空间对象, 由 _compileJS 作为参数注入用户代码（h.hello()）
      _extNSList = _buildExtAPIs('javascript');
    }
    return true; // javascript 原生执行, 无需解释器注入
  }

  let _extNSList = []; // JS 扩展命名空间: [{objName, fns}]

  // ============================================================
  // 帧循环
  // ============================================================

  async function _tick() {
    if (!_running || _busy) return;
    _busy = true;
    try {
      const SM = _SM();
      const f = _flatAPI();
      // 多角色: 每帧依次执行每个角色的代码, 执行前把上下文绑定到对应角色
      for (const entry of _codeSources) {
        if (!_running) break;
        const code = String(entry.getCode() || '');
        if (!code.trim()) continue;
        if (SM && entry.idx != null && SM.getActiveSpriteIdx() !== entry.idx) {
          f.set_sprite(entry.idx);
        }
        _curBoundIdx = (entry.idx != null) ? entry.idx : (SM ? SM.getActiveSpriteIdx() : -1);
        if (_lang === 'javascript') _runFrameJS(entry);
        else if (_lang === 'alb') _runFrameALB(code);
        else if (_lang === 'python') await _runFramePython(code);
      }
      _curBoundIdx = -1;
    } catch (e) {
      _emit('❌ ' + (e && e.message ? e.message : String(e)));
      stop();
      // 通知调用方运行时因错误自行停止, 以便同步按钮状态
      if (_opts && typeof _opts.onStop === 'function') {
        try { _opts.onStop(); } catch (e2) { /* ignore */ }
      }
    } finally {
      _busy = false;
      if (_running && _opts && typeof _opts.onFrame === 'function') {
        try { _opts.onFrame(); } catch (e) { /* ignore */ }
      }
    }
  }

  function start(lang, getCodeOrSources, opts) {
    stop();
    _lang = (lang === 'python' || lang === 'alb') ? lang : 'javascript';
    // 兼容: 单个 getCode 函数 / {name, getCode} 对象 / 数组（按角色）
    let sources = getCodeOrSources;
    if (typeof sources === 'function') sources = [{ name: '', getCode: sources }];
    else if (sources && typeof sources.getCode === 'function') sources = [sources];
    _codeSources = (Array.isArray(sources) ? sources : []).filter(s => s && typeof s.getCode === 'function');
    _opts = opts || {};
    _vars = {};        // 每次运行重置跨帧变量
    _blkValues.clear();
    _startTime = Date.now() / 1000;
    _jsCache = new Map(); _alb = null; _curBoundIdx = -1; _extNSList = [];
    if (!_injectForLanguage(_lang)) return false;
    // 执行期间锁定角色上下文: setActiveSprite 不再同步积木数据, 避免逐帧切换角色覆盖编辑器积木
    if (_SM() && _SM().setExecuting) _SM().setExecuting(true);
    // JS: 启动时预编译每个角色的代码, 语法错误立即报出并拒绝启动
    if (_lang === 'javascript') {
      for (const entry of _codeSources) {
        const code = String(entry.getCode() || '');
        if (!code.trim()) continue;
        try { _compileJS(entry, code); }
        catch (e) {
          _emit('❌ 角色「' + (entry.name || '?') + '」代码错误: ' + (e && e.message ? e.message : String(e)));
          stop();
          return false;
        }
      }
    }
    _running = true;
    const interval = (_opts.interval != null) ? _opts.interval : (DEFAULT_INTERVAL[_lang] || 33);
    _tick(); // 立即执行第一帧
    _timer = setInterval(_tick, interval);
    console.log('[CodeRuntime] 启动, 语言:', _lang, '角色数:', _codeSources.length, '间隔:', interval + 'ms');
    return true;
  }

  function stop() {
    _running = false;
    if (_timer) { clearInterval(_timer); _timer = null; }
    _killAllThreads();
    if (_SM() && _SM().setExecuting) _SM().setExecuting(false);
    _alb = null; _jsCache = new Map(); _curBoundIdx = -1; _extNSList = [];
    _blkValues.clear();
  }

  function isRunning() { return _running; }

  /** 从代码里停止运行（等价于点红色停止按钮） */
  function _stopSafe() { try { stop(); } catch (e) { /* ignore */ } }

  /** 当前跨帧变量快照（供调试/监视） */
  function getVars() { return { ..._vars }; }

  return { start, stop, isRunning, getVars, getFlatAPI: _flatAPI };
})();

if (typeof window !== 'undefined') window.CodeRuntime = CodeRuntime;
