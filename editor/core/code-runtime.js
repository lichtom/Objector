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
 *   CodeRuntime.start(lang, getCode, opts)  // lang: 'javascript' | 'python' | 'alb'
 *   CodeRuntime.stop()
 *   CodeRuntime.isRunning()
 *   opts: { onOutput(text), onFrame(), interval? }
 */
const CodeRuntime = (function () {
  let _running = false;
  let _timer = null;
  let _busy = false;
  let _lang = 'javascript';
  let _getCode = null;
  let _opts = null;
  let _vars = {};        // 跨帧持久变量
  let _startTime = 0;
  let _jsFn = null;      // JS 编译缓存
  let _jsSrc = null;
  let _alb = null;       // ALB 解释器实例（每次 start 新建, 隔离环境）

  const DEFAULT_INTERVAL = { javascript: 33, alb: 33, python: 100 };

  // ============================================================
  // 协作式多线程调度器
  // JS 引擎只有一个主线程, 因此线程语义是"事件循环时间片":
  //   thread_spawn 登记的函数会按自己的周期在事件循环上轮流执行,
  //   与主帧循环/其它线程彼此交错但不抢占, 共享 get_var/set_var 即安全.
  // 三种语言均可用; 宿主侧通过解释器自带的 setFunc 注入, 也可随时被宿主重新配置.
  // ============================================================
  let _threads = new Map();     // id -> { fn, iv, next, dead }
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
      try { t.fn(); } catch (e) {
        _emit('❌ 线程 ' + id + ' 出错终止: ' + (e && e.message ? e.message : String(e)));
        t.dead = true;
      }
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
        _threads.set(id, { fn, iv, next: Date.now() + iv, dead: false });
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

  function _runFrameJS(code) {
    if (_jsSrc !== code || !_jsFn) {
      const f = _flatAPI();
      const sprite = _jsSpriteObject(f);
      const stage = _jsStageObject(f);
      // 常用平铺函数（与积木语义一致）+ snake_case API 全量透传
      const names = Object.keys(f).concat(['sprite', 'stage', 'globalVars', 'log']);
      const values = Object.keys(f).map(k => f[k]).concat([sprite, stage, _vars, f.log]);
      _jsFn = { fn: new Function(...names, code), key: code };
      _jsRunArgs = values;
      _jsSrc = code;
    }
    _jsFn.fn(..._jsRunArgs);
  }
  let _jsRunArgs = null;

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
      return true;
    }
    return true; // javascript 原生执行, 无需注入
  }

  // ============================================================
  // 帧循环
  // ============================================================

  async function _tick() {
    if (!_running || _busy) return;
    _busy = true;
    try {
      const code = _getCode ? String(_getCode() || '') : '';
      if (code.trim()) {
        if (_lang === 'javascript') _runFrameJS(code);
        else if (_lang === 'alb') _runFrameALB(code);
        else if (_lang === 'python') await _runFramePython(code);
      }
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

  function start(lang, getCode, opts) {
    stop();
    _lang = (lang === 'python' || lang === 'alb') ? lang : 'javascript';
    _getCode = getCode;
    _opts = opts || {};
    _vars = {};        // 每次运行重置跨帧变量
    _startTime = Date.now() / 1000;
    _jsFn = null; _jsSrc = null; _jsRunArgs = null; _alb = null;
    if (!_injectForLanguage(_lang)) return false;
    _running = true;
    const interval = (_opts.interval != null) ? _opts.interval : (DEFAULT_INTERVAL[_lang] || 33);
    _tick(); // 立即执行第一帧
    _timer = setInterval(_tick, interval);
    console.log('[CodeRuntime] 启动, 语言:', _lang, '间隔:', interval + 'ms');
    return true;
  }

  function stop() {
    _running = false;
    if (_timer) { clearInterval(_timer); _timer = null; }
    _killAllThreads();
    _alb = null; _jsFn = null; _jsSrc = null; _jsRunArgs = null;
  }

  function isRunning() { return _running; }

  /** 当前跨帧变量快照（供调试/监视） */
  function getVars() { return { ..._vars }; }

  return { start, stop, isRunning, getVars };
})();

if (typeof window !== 'undefined') window.CodeRuntime = CodeRuntime;
