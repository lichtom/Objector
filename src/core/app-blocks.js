/**
 * APP 开发专用积木定义
 * 替换游戏/动画类积木，提供 APP 开发专用模块
 */
(function () {

  // ========== 1. 窗口事件 ==========
  const CE = '#FFAB00';
  BlockRegistry.registerCategory('app-events', '窗口事件', CE);

  BlockRegistry.register({
    type: 'app_on_window_start', category: 'app-events', color: CE,
    label: '🪟 当窗口启动时', labelKey: 'blocks.appEvents.on_window_start', shape: 'hat',
    ports: { flowIn: false, flowOut: true }, params: [],
  });
  BlockRegistry.register({
    type: 'app_on_window_close', category: 'app-events', color: CE,
    label: '🪟 当窗口关闭时', labelKey: 'blocks.appEvents.on_window_close', shape: 'hat',
    ports: { flowIn: false, flowOut: true }, params: [],
  });
  BlockRegistry.register({
    type: 'app_on_window_resize', category: 'app-events', color: CE,
    label: '🪟 当窗口调整大小时', labelKey: 'blocks.appEvents.on_window_resize', shape: 'hat',
    ports: { flowIn: false, flowOut: true }, params: [],
  });
  BlockRegistry.register({
    type: 'app_on_button_click', category: 'app-events', color: CE,
    label: '🔘 当按钮 {name} 被点击时', labelKey: 'blocks.appEvents.on_button_click', shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '按钮' }],
  });
  BlockRegistry.register({
    type: 'app_on_input_change', category: 'app-events', color: CE,
    label: '📝 当输入框 {name} 内容改变时', labelKey: 'blocks.appEvents.on_input_change', shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '输入框' }],
  });
  BlockRegistry.register({
    type: 'app_on_key_pressed', category: 'app-events', color: CE,
    label: '⌨ 当按下 {key} 键时', labelKey: 'blocks.appEvents.on_key_pressed', shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [{ name: 'key', type: 'dropdown', default: 'enter', options: ['enter', 'escape', 'tab', 'space', 'up', 'down', 'left', 'right', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'shift', 'control', 'alt', 'backspace', 'delete'] }],
  });
  BlockRegistry.register({
    type: 'app_on_timer', category: 'app-events', color: CE,
    label: '⏱ 每隔 {sec} 秒', labelKey: 'blocks.appEvents.on_timer', shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [{ name: 'sec', type: 'number', default: 1 }],
  });

  // ========== 2. UI 组件操作（统一属性设置） ==========
  const CU = '#4C97FF';
  BlockRegistry.registerCategory('app-ui', '组件属性', CU);

  // 统一属性设置积木：设置 {组件} 的 {属性} {运算} {值}
  BlockRegistry.register({
    type: 'app_set_prop', category: 'app-ui', color: CU,
    label: '设置 {component} 的 {prop} {op} {value}',
    labelKey: 'blocks.appUI.set_prop', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'component', type: 'string', default: '组件' },
      { name: 'prop', type: 'string', default: 'text' },
      { name: 'op', type: 'dropdown', default: '=', options: ['=', '+=', '-=', '*=', '/='] },
      { name: 'value', type: 'string', default: '' },
    ],
  });

  // 统一属性获取积木：{组件} 的 {属性}
  BlockRegistry.register({
    type: 'app_get_prop', category: 'app-ui', color: CU,
    label: '{component} 的 {prop}',
    labelKey: 'blocks.appUI.get_prop', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [
      { name: 'component', type: 'string', default: '组件' },
      { name: 'prop', type: 'string', default: 'text' },
    ],
  });

  // 列表专用操作
  BlockRegistry.register({
    type: 'app_list_add_item', category: 'app-ui', color: CU,
    label: '向列表 {name} 添加 {item}', labelKey: 'blocks.appUI.list_add_item', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '列表' }, { name: 'item', type: 'string', default: '' }],
  });
  BlockRegistry.register({
    type: 'app_list_clear', category: 'app-ui', color: CU,
    label: '清空列表 {name}', labelKey: 'blocks.appUI.list_clear', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '列表' }],
  });

  // 显示/隐藏组件
  BlockRegistry.register({
    type: 'app_show_component', category: 'app-ui', color: CU,
    label: '显示组件 {name}', labelKey: 'blocks.appUI.show_component', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '组件' }],
  });
  BlockRegistry.register({
    type: 'app_hide_component', category: 'app-ui', color: CU,
    label: '隐藏组件 {name}', labelKey: 'blocks.appUI.hide_component', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '组件' }],
  });

  // ========== 3. 窗口操作 ==========
  const CW = '#9966FF';
  BlockRegistry.registerCategory('app-window', '窗口操作', CW);

  BlockRegistry.register({
    type: 'app_open_window', category: 'app-window', color: CW,
    label: '打开窗口 {name}', labelKey: 'blocks.appWindow.open_window', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '新窗口' }],
  });
  BlockRegistry.register({
    type: 'app_close_window', category: 'app-window', color: CW,
    label: '关闭窗口 {name}', labelKey: 'blocks.appWindow.close_window', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '当前窗口' }],
  });
  BlockRegistry.register({
    type: 'app_set_window_title', category: 'app-window', color: CW,
    label: '设置窗口标题为 {title}', labelKey: 'blocks.appWindow.set_window_title', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'title', type: 'string', default: '新标题' }],
  });
  BlockRegistry.register({
    type: 'app_set_window_size', category: 'app-window', color: CW,
    label: '设置窗口大小 宽:{w} 高:{h}', labelKey: 'blocks.appWindow.set_window_size', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'w', type: 'number', default: 800 }, { name: 'h', type: 'number', default: 600 }],
  });
  BlockRegistry.register({
    type: 'app_get_window_width', category: 'app-window', color: CW,
    label: '窗口宽度', labelKey: 'blocks.appWindow.get_window_width', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'app_get_window_height', category: 'app-window', color: CW,
    label: '窗口高度', labelKey: 'blocks.appWindow.get_window_height', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'app_switch_window', category: 'app-window', color: CW,
    label: '切换到窗口 {name}', labelKey: 'blocks.appWindow.switch_window', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '新窗口' }],
  });
  BlockRegistry.register({
    type: 'app_close_current_window', category: 'app-window', color: CW,
    label: '关闭当前窗口', labelKey: 'blocks.appWindow.close_current', shape: 'stack',
    ports: { flowIn: true, flowOut: true }, params: [],
  });

  // ========== 4. 对话框 ==========
  const CD = '#CF63CF';
  BlockRegistry.registerCategory('app-dialog', '对话框', CD);

  BlockRegistry.register({
    type: 'app_alert', category: 'app-dialog', color: CD,
    label: '弹出消息框 {msg}', labelKey: 'blocks.appDialog.alert', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'msg', type: 'string', default: '你好!' }],
  });
  BlockRegistry.register({
    type: 'app_confirm', category: 'app-dialog', color: CD,
    label: '弹出确认框 {msg}', labelKey: 'blocks.appDialog.confirm', shape: 'boolean',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'msg', type: 'string', default: '确定吗?' }],
  });
  BlockRegistry.register({
    type: 'app_prompt', category: 'app-dialog', color: CD,
    label: '弹出输入框 {msg}', labelKey: 'blocks.appDialog.prompt', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'msg', type: 'string', default: '请输入:' }],
  });
  BlockRegistry.register({
    type: 'app_open_file_dialog', category: 'app-dialog', color: CD,
    label: '弹出文件选择框', labelKey: 'blocks.appDialog.open_file_dialog', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'app_save_file_dialog', category: 'app-dialog', color: CD,
    label: '弹出文件保存框 默认名 {name}', labelKey: 'blocks.appDialog.save_file_dialog', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'name', type: 'string', default: '文件.txt' }],
  });

  // ========== 5. 数据操作 ==========
  const CT = '#59C059';
  BlockRegistry.registerCategory('app-data', '数据操作', CT);

  BlockRegistry.register({
    type: 'app_read_file', category: 'app-data', color: CT,
    label: '读取文件 {path}', labelKey: 'blocks.appData.read_file', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'path', type: 'string', default: 'data.txt' }],
  });
  BlockRegistry.register({
    type: 'app_write_file', category: 'app-data', color: CT,
    label: '写入文件 {path} 内容 {text}', labelKey: 'blocks.appData.write_file', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'path', type: 'string', default: 'data.txt' }, { name: 'text', type: 'string', default: '' }],
  });
  BlockRegistry.register({
    type: 'app_save_storage', category: 'app-data', color: CT,
    label: '保存数据 {key} = {val}', labelKey: 'blocks.appData.save_storage', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'key', type: 'string', default: '数据' }, { name: 'val', type: 'string', default: '' }],
  });
  BlockRegistry.register({
    type: 'app_load_storage', category: 'app-data', color: CT,
    label: '加载数据 {key}', labelKey: 'blocks.appData.load_storage', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'key', type: 'string', default: '数据' }],
  });
  BlockRegistry.register({
    type: 'app_http_get', category: 'app-data', color: CT,
    label: 'HTTP GET 请求 {url}', labelKey: 'blocks.appData.http_get', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'url', type: 'string', default: 'https://api.example.com' }],
  });
  BlockRegistry.register({
    type: 'app_http_post', category: 'app-data', color: CT,
    label: 'HTTP POST 请求 {url} 数据 {body}', labelKey: 'blocks.appData.http_post', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'url', type: 'string', default: 'https://api.example.com' }, { name: 'body', type: 'string', default: '{}' }],
  });

  // ========== 6. 控制台输出 ==========
  const CC = '#FF6680';
  BlockRegistry.registerCategory('app-console', '控制台', CC);

  BlockRegistry.register({
    type: 'app_console_log', category: 'app-console', color: CC,
    label: '输出 {text}', labelKey: 'blocks.appConsole.log', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'text', type: 'string', default: 'Hello!' }],
  });
  BlockRegistry.register({
    type: 'app_console_warn', category: 'app-console', color: CC,
    label: '警告 {text}', labelKey: 'blocks.appConsole.warn', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'text', type: 'string', default: '' }],
  });
  BlockRegistry.register({
    type: 'app_console_error', category: 'app-console', color: CC,
    label: '错误 {text}', labelKey: 'blocks.appConsole.error', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'text', type: 'string', default: '' }],
  });
  BlockRegistry.register({
    type: 'app_console_clear', category: 'app-console', color: CC,
    label: '清空控制台', labelKey: 'blocks.appConsole.clear', shape: 'stack',
    ports: { flowIn: true, flowOut: true }, params: [],
  });

  // ========== 7. CLI 控制台专用 ==========
  const CLI = '#2ECC71';
  BlockRegistry.registerCategory('app-cli', 'CLI 控制台', CLI);

  BlockRegistry.register({
    type: 'app_cli_print', category: 'app-cli', color: CLI,
    label: '打印 {text}', labelKey: 'blocks.appCli.print', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'text', type: 'string', default: 'Hello' }],
  });
  BlockRegistry.register({
    type: 'app_cli_printline', category: 'app-cli', color: CLI,
    label: '打印并换行 {text}', labelKey: 'blocks.appCli.printline', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'text', type: 'string', default: 'Hello' }],
  });
  BlockRegistry.register({
    type: 'app_cli_input', category: 'app-cli', color: CLI,
    label: '读取用户输入 {prompt}', labelKey: 'blocks.appCli.input', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'prompt', type: 'string', default: '> ' }],
  });
  BlockRegistry.register({
    type: 'app_cli_clear', category: 'app-cli', color: CLI,
    label: '清屏', labelKey: 'blocks.appCli.clear', shape: 'stack',
    ports: { flowIn: true, flowOut: true }, params: [],
  });

  // ========== 8. 获取当前组件 ==========
  const CG = '#E67E22';
  BlockRegistry.registerCategory('app-current-comp', '当前组件', CG);

  BlockRegistry.register({
    type: 'app_get_current_component', category: 'app-current-comp', color: CG,
    label: '获取当前组件', labelKey: 'blocks.appCurrentComp.get_current', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'app_get_current_comp_name', category: 'app-current-comp', color: CG,
    label: '当前组件的名称', labelKey: 'blocks.appCurrentComp.name', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'app_get_current_comp_type', category: 'app-current-comp', color: CG,
    label: '当前组件的类型', labelKey: 'blocks.appCurrentComp.type', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'app_get_current_comp_text', category: 'app-current-comp', color: CG,
    label: '当前组件的文本', labelKey: 'blocks.appCurrentComp.text', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'app_get_current_comp_value', category: 'app-current-comp', color: CG,
    label: '当前组件的值', labelKey: 'blocks.appCurrentComp.value', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'app_get_current_comp_x', category: 'app-current-comp', color: CG,
    label: '当前组件的 X', labelKey: 'blocks.appCurrentComp.x', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'app_get_current_comp_y', category: 'app-current-comp', color: CG,
    label: '当前组件的 Y', labelKey: 'blocks.appCurrentComp.y', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'app_get_current_comp_width', category: 'app-current-comp', color: CG,
    label: '当前组件的宽度', labelKey: 'blocks.appCurrentComp.width', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'app_get_current_comp_height', category: 'app-current-comp', color: CG,
    label: '当前组件的高度', labelKey: 'blocks.appCurrentComp.height', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'app_get_current_comp_visible', category: 'app-current-comp', color: CG,
    label: '当前组件是否可见', labelKey: 'blocks.appCurrentComp.visible', shape: 'boolean',
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  // ========== 9. HTML 嵌入 ==========
  const CH = '#E74C3C';
  BlockRegistry.registerCategory('app-html', 'HTML 嵌入', CH);

  BlockRegistry.register({
    type: 'app_set_html', category: 'app-html', color: CH,
    label: '设置 {component} 的 HTML 内容为 {html}', labelKey: 'blocks.appHtml.set_html', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'component', type: 'string', default: 'HTML' },
      { name: 'html', type: 'string', default: '<h1>Hello</h1>' },
    ],
  });
  BlockRegistry.register({
    type: 'app_get_html', category: 'app-html', color: CH,
    label: '{component} 的 HTML 内容', labelKey: 'blocks.appHtml.get_html', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'component', type: 'string', default: 'HTML' }],
  });

  // ========== 10. 画布 ==========
  const CV = '#1ABC9C';
  BlockRegistry.registerCategory('app-canvas', '画布', CV);

  BlockRegistry.separator('app-canvas');
  BlockRegistry.register({
    type: 'app_canvas_line', category: 'app-canvas', color: CV,
    label: '在 {component} 画线 从 ({x1},{y1}) 到 ({x2},{y2})', labelKey: 'blocks.appCanvas.line', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'component', type: 'string', default: '画布' },
      { name: 'x1', type: 'number', default: 0 }, { name: 'y1', type: 'number', default: 0 },
      { name: 'x2', type: 'number', default: 100 }, { name: 'y2', type: 'number', default: 100 },
    ],
  });
  BlockRegistry.register({
    type: 'app_canvas_rect', category: 'app-canvas', color: CV,
    label: '在 {component} 画矩形 ({x},{y}) 宽:{w} 高:{h}', labelKey: 'blocks.appCanvas.rect', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'component', type: 'string', default: '画布' },
      { name: 'x', type: 'number', default: 0 }, { name: 'y', type: 'number', default: 0 },
      { name: 'w', type: 'number', default: 100 }, { name: 'h', type: 'number', default: 50 },
    ],
  });
  BlockRegistry.register({
    type: 'app_canvas_circle', category: 'app-canvas', color: CV,
    label: '在 {component} 画圆 ({x},{y}) 半径:{r}', labelKey: 'blocks.appCanvas.circle', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'component', type: 'string', default: '画布' },
      { name: 'x', type: 'number', default: 100 }, { name: 'y', type: 'number', default: 100 },
      { name: 'r', type: 'number', default: 50 },
    ],
  });
  BlockRegistry.register({
    type: 'app_canvas_text', category: 'app-canvas', color: CV,
    label: '在 {component} 写文字 {text} 于 ({x},{y})', labelKey: 'blocks.appCanvas.text', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'component', type: 'string', default: '画布' },
      { name: 'text', type: 'string', default: 'Hello' },
      { name: 'x', type: 'number', default: 10 }, { name: 'y', type: 'number', default: 20 },
    ],
  });

  BlockRegistry.separator('app-canvas');
  BlockRegistry.register({
    type: 'app_canvas_clear', category: 'app-canvas', color: CV,
    label: '清除 {component} 画布', labelKey: 'blocks.appCanvas.clear', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'component', type: 'string', default: '画布' }],
  });
  BlockRegistry.register({
    type: 'app_canvas_set_style', category: 'app-canvas', color: CV,
    label: '设置 {component} 画笔颜色 {color} 粗细 {size}', labelKey: 'blocks.appCanvas.set_style', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'component', type: 'string', default: '画布' },
      { name: 'color', type: 'string', default: '#000000' },
      { name: 'size', type: 'number', default: 2 },
    ],
  });
  BlockRegistry.register({
    type: 'app_canvas_fill', category: 'app-canvas', color: CV,
    label: '设置 {component} 填充颜色 {color}', labelKey: 'blocks.appCanvas.fill', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'component', type: 'string', default: '画布' },
      { name: 'color', type: 'string', default: '#FF0000' },
    ],
  });

  BlockRegistry.separator('app-canvas');
  BlockRegistry.register({
    type: 'app_canvas_get_width', category: 'app-canvas', color: CV,
    label: '{component} 画布宽度', labelKey: 'blocks.appCanvas.get_width', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'component', type: 'string', default: '画布' }],
  });
  BlockRegistry.register({
    type: 'app_canvas_get_height', category: 'app-canvas', color: CV,
    label: '{component} 画布高度', labelKey: 'blocks.appCanvas.get_height', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'component', type: 'string', default: '画布' }],
  });

})();
