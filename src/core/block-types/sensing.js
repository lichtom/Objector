/** 侦测类积木（类似 Scratch） */
(function () {
  const C = '#5CB1D6';
  BlockRegistry.registerCategory('sensing', '侦测', C);

  // === 碰撞侦测 ===
  BlockRegistry.register({
    type: 'sensing_touching_edge', category: 'sensing', color: C,
    label: '碰到边缘?', labelKey: 'blocks.sensing.sensing_touching_edge', shape: 'boolean',
    code: { python: "touching_edge()", javascript: "touching_edge()", alb: "touching_edge()" },
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  BlockRegistry.register({

    type: 'sensing_touching_sprite', category: 'sensing', color: C,
    label: '碰到 {sprite}?', labelKey: 'blocks.sensing.sensing_touching_sprite', shape: 'boolean',
    code: { python: "touching_sprite({sprite})", javascript: "touching_sprite({sprite})", alb: "touching_sprite({sprite})" },
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'sprite', type: 'string', default: '精灵2' }],
  });
  BlockRegistry.separator('sensing');


  // === 鼠标侦测 ===
  BlockRegistry.register({
    type: 'sensing_mouse_x', category: 'sensing', color: C,
    label: '鼠标的 x', labelKey: 'blocks.sensing.sensing_mouse_x', shape: 'reporter',
    code: { python: "mouse_x()", javascript: "mouse_x()", alb: "mouse_x()" },
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  BlockRegistry.register({
    type: 'sensing_mouse_y', category: 'sensing', color: C,
    label: '鼠标的 y', labelKey: 'blocks.sensing.sensing_mouse_y', shape: 'reporter',
    code: { python: "mouse_y()", javascript: "mouse_y()", alb: "mouse_y()" },
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  BlockRegistry.register({

    type: 'sensing_mouse_down', category: 'sensing', color: C,
    label: '鼠标按下?', labelKey: 'blocks.sensing.sensing_mouse_down', shape: 'boolean',
    code: { python: "mouse_down()", javascript: "mouse_down()", alb: "mouse_down()" },
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.separator('sensing');


  // === 键盘侦测 ===
  BlockRegistry.register({

    type: 'sensing_key_pressed', category: 'sensing', color: C,
    label: '按下 {key} 键?', labelKey: 'blocks.sensing.sensing_key_pressed', shape: 'boolean',
    code: { python: "key_pressed({key})", javascript: "key_pressed({key})", alb: "key_pressed({key})" },
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'key', type: 'dropdown', default: 'space', options: ['space', 'up', 'down', 'left', 'right', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'enter', 'shift', 'control', 'alt', 'escape', 'tab', 'backspace'] }],
  });
  BlockRegistry.separator('sensing');


  // === 距离侦测 ===
  BlockRegistry.register({

    type: 'sensing_distance_to', category: 'sensing', color: C,
    label: '到 {sprite} 的距离', labelKey: 'blocks.sensing.sensing_distance_to', shape: 'reporter',
    code: { python: "distance_to({sprite})", javascript: "distance_to({sprite})", alb: "distance_to({sprite})" },
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'sprite', type: 'string', default: '精灵2' }],
  });
  BlockRegistry.separator('sensing');


  // === 计时器 ===
  BlockRegistry.register({
    type: 'sensing_timer', category: 'sensing', color: C,
    label: '计时器', labelKey: 'blocks.sensing.sensing_timer', shape: 'reporter',
    code: { python: "timer_now()", javascript: "timer_now()", alb: "timer_now()" },
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  BlockRegistry.register({

    type: 'sensing_reset_timer', category: 'sensing', color: C,
    label: '计时器归零', labelKey: 'blocks.sensing.sensing_reset_timer', shape: 'stack',
    code: { python: "run_block(\"sensing_reset_timer\")", javascript: "run_block(\"sensing_reset_timer\")", alb: "run_block(\"sensing_reset_timer\")" },
    ports: { flowIn: true, flowOut: true }, params: [],
  });
  BlockRegistry.separator('sensing');


  // === 精灵属性侦测 ===
  BlockRegistry.register({
    type: 'sensing_sprite_x', category: 'sensing', color: C,
    label: '{sprite} 的 x 坐标', labelKey: 'blocks.sensing.sensing_sprite_x', shape: 'reporter',
    code: { python: "sprite_x({sprite})", javascript: "sprite_x({sprite})", alb: "sprite_x({sprite})" },
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }],
  });

  BlockRegistry.register({
    type: 'sensing_sprite_y', category: 'sensing', color: C,
    label: '{sprite} 的 y 坐标', labelKey: 'blocks.sensing.sensing_sprite_y', shape: 'reporter',
    code: { python: "sprite_y({sprite})", javascript: "sprite_y({sprite})", alb: "sprite_y({sprite})" },
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }],
  });

  BlockRegistry.register({
    type: 'sensing_sprite_direction', category: 'sensing', color: C,
    label: '{sprite} 的方向', labelKey: 'blocks.sensing.sensing_sprite_direction', shape: 'reporter',
    code: { python: "sprite_direction({sprite})", javascript: "sprite_direction({sprite})", alb: "sprite_direction({sprite})" },
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }],
  });

  BlockRegistry.register({

    type: 'sensing_sprite_size', category: 'sensing', color: C,
    label: '{sprite} 的大小', labelKey: 'blocks.sensing.sensing_sprite_size', shape: 'reporter',
    code: { python: "sprite_size({sprite})", javascript: "sprite_size({sprite})", alb: "sprite_size({sprite})" },
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }],
  });
  BlockRegistry.separator('sensing');


  // === 询问回答（IO 已有 io_input，这里补充回答 reporter）===
  BlockRegistry.register({

    type: 'sensing_answer', category: 'sensing', color: C,
    label: '回答', labelKey: 'blocks.sensing.sensing_answer', shape: 'reporter',
    code: { python: "answer()", javascript: "answer()", alb: "answer()" },
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.separator('sensing');


  // === 当前时间 ===
  BlockRegistry.register({

    type: 'sensing_current', category: 'sensing', color: C,
    label: '当前 {unit}', labelKey: 'blocks.sensing.sensing_current', shape: 'reporter',
    code: { python: "current_time({unit})", javascript: "current_time({unit})", alb: "current_time({unit})" },
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'unit', type: 'string', default: '秒' }],
  });
  BlockRegistry.separator('sensing');


  // === 用户名 ===
  BlockRegistry.register({

    type: 'sensing_username', category: 'sensing', color: C,
    label: '用户名', labelKey: 'blocks.sensing.sensing_username', shape: 'reporter',
    code: { python: "username()", javascript: "username()", alb: "username()" },
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.separator('sensing');


  // === 舞台尺寸 ===
  BlockRegistry.register({
    type: 'sensing_stage_width', category: 'sensing', color: C,
    label: '舞台宽度', labelKey: 'blocks.sensing.sensing_stage_width', shape: 'reporter',
    code: { python: "stage_width()", javascript: "stage_width()", alb: "stage_width()" },
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.register({

    type: 'sensing_stage_height', category: 'sensing', color: C,
    label: '舞台高度', labelKey: 'blocks.sensing.sensing_stage_height', shape: 'reporter',
    code: { python: "stage_height()", javascript: "stage_height()", alb: "stage_height()" },
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.separator('sensing');


  // === 精灵数量 ===
  BlockRegistry.register({

    type: 'sensing_sprite_count', category: 'sensing', color: C,
    label: '精灵数量', labelKey: 'blocks.sensing.sensing_sprite_count', shape: 'reporter',
    code: { python: "sprite_count()", javascript: "sprite_count()", alb: "sprite_count()" },
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.separator('sensing');


  // === 时间戳 ===
  BlockRegistry.register({

    type: 'sensing_timestamp', category: 'sensing', color: C,
    label: '当前时间戳 (毫秒)', labelKey: 'blocks.sensing.sensing_timestamp', shape: 'reporter',
    code: { python: "timestamp()", javascript: "timestamp()", alb: "timestamp()" },
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.separator('sensing');


  // === 格式化时间 ===
  BlockRegistry.register({
    type: 'sensing_format_time', category: 'sensing', color: C,
    label: '格式化时间 {fmt}', labelKey: 'blocks.sensing.sensing_format_time', shape: 'reporter',
    code: { python: "format_time({fmt})", javascript: "format_time({fmt})", alb: "format_time({fmt})" },
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'fmt', type: 'string', default: 'yyyy-MM-dd HH:mm:ss' }],
  });
})();
