/**
 * 批量为积木模块文件添加 BlockRegistry.separator() 调用
 * 在每组注释分隔处（===== 或 === 或独立分组注释）前插入分割线
 */
const fs = require('fs');
const path = require('path');

// 配置：每个文件的分类名和分割线插入位置（通过注释关键词匹配）
const SRC_DIR = path.join(__dirname, 'src', 'core', 'block-types');
const ED_DIR = path.join(__dirname, 'editor', 'core', 'block-types');

function addSeparators(filePath, catId, markerPatterns) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // 对每个标记模式，在匹配行前插入 separator 调用
  // 从后往前处理，避免偏移
  const lines = content.split('\n');
  const insertIndices = [];
  
  for (const pattern of markerPatterns) {
    for (let i = 0; i < lines.length; i++) {
      if (typeof pattern === 'string') {
        // 精确匹配注释内容
        if (lines[i].trim() === pattern) {
          insertIndices.push(i);
          break;
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(lines[i])) {
          insertIndices.push(i);
          break;
        }
      }
    }
  }
  
  // 排序并从后往前插入
  insertIndices.sort((a, b) => b - a);
  
  for (const idx of insertIndices) {
    const indent = lines[idx].match(/^(\s*)/)[1];
    lines.splice(idx, 0, indent + `BlockRegistry.separator('${catId}');`);
    lines.splice(idx + 1, 0, '');
  }
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  console.log(`  ${path.basename(filePath)}: ${insertIndices.length} separators added`);
}

// ===== 各模块配置 =====

// control.js
function processControl(dir) {
  const f = path.join(dir, 'control.js');
  if (!fs.existsSync(f)) return;
  addSeparators(f, 'control', [
    /\/\/\s*===\s*元编程/,
    // 在 stop_all 前面
    (function() {
      const lines = fs.readFileSync(f, 'utf-8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("type: 'stop_all'")) return i;
      }
      return -1;
    })() >= 0 ? null : null,  // skip, use regex
    /\/\/\s*标签|control_label_run.*标签/,
  ]);
}

// 用更精确的方式处理每个文件
function processFile(filePath, catId, beforeTypePatterns) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const insertBefore = [];
  
  for (const pat of beforeTypePatterns) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(pat)) {
        // 找到这个 type 声明所在行的上方（跳过注释行）
        let insertAt = i;
        // 向上跳过紧邻的注释行和空行
        while (insertAt > 0 && (lines[insertAt - 1].trim().startsWith('//') || lines[insertAt - 1].trim() === '')) {
          insertAt--;
        }
        // 再跳过空行
        while (insertAt > 0 && lines[insertAt - 1].trim() === '') {
          insertAt--;
        }
        insertBefore.push(insertAt);
        break;
      }
    }
  }
  
  // 去重并排序（从后往前）
  const unique = [...new Set(insertBefore)].sort((a, b) => b - a);
  
  for (const idx of unique) {
    const indent = '  '; // 标准缩进
    lines.splice(idx, 0, indent + `BlockRegistry.separator('${catId}');`);
    lines.splice(idx + 1, 0, '');
  }
  
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  console.log(`  ${path.basename(filePath)}: ${unique.length} separators`);
}

console.log('=== Processing src ===');

// control.js: 循环 | 条件 | 流程控制 | 高级控制 | 元编程
processFile(path.join(SRC_DIR, 'control.js'), 'control', [
  "type: 'stop_all'",
  "type: 'control_label_run'",
  "// === 元编程",
]);

// variables.js: 基本操作 | 局部域
processFile(path.join(SRC_DIR, 'variables.js'), 'variables', [
  "// 局部域",
]);

// functions.js: 定义+调用 | 参数 | 动态定义
processFile(path.join(SRC_DIR, 'functions.js'), 'functions', [
  "type: 'func_param_get'",
  "// 动态函数定义",
]);

// lists.js: 创建 | 修改操作 | 查询 | 遍历+高级
processFile(path.join(SRC_DIR, 'lists.js'), 'lists', [
  "// 以下操作",
  "type: 'list_get'",
  "type: 'list_foreach'",
]);

// events.js: 事件入口 | 广播 | 定时器
processFile(path.join(SRC_DIR, 'events.js'), 'events', [
  "type: 'event_broadcast',",
  "type: 'event_timer'",
]);

// motion.js: 基础移动 | 位置控制 | 滑行 | 方向 | 反弹 | 速度 | 追踪 | 圆周 | 随机 | 历史 | 边界 | Reporter
processFile(path.join(SRC_DIR, 'motion.js'), 'motion', [
  "// ===== 位置控制",
  "// ===== 滑行",
  "// ===== 方向控制",
  "// ===== 反弹",
  "// ===== 超越 Scratch：速度系统",
  "// ===== 超越 Scratch：追踪系统",
  "// ===== 超越 Scratch：圆周运动",
  "// ===== 超越 Scratch：随机移动",
  "// ===== 超越 Scratch：位置历史",
  "// ===== 超越 Scratch：边界",
  "// ===== Reporter 积木",
]);

// looks.js: 显示/隐藏 | 说话 | 造型 | 大小/特效 | Reporter
processFile(path.join(SRC_DIR, 'looks.js'), 'looks', [
  "type: 'looks_say',",
  "type: 'looks_next_costume'",
  "type: 'looks_set_size'",
  "type: 'looks_get_size'",
]);

// sound.js: 播放 | 停止 | 音量 | 加载
processFile(path.join(SRC_DIR, 'sound.js'), 'sound', [
  "type: 'sound_stop',",
  "type: 'sound_set_volume'",
  "type: 'sound_load'",
]);

// sensing.js: 碰撞 | 鼠标 | 键盘 | 距离 | 计时器 | 精灵属性 | 回答 | 时间 | 用户名 | 舞台 | 精灵数量 | 时间戳 | 格式化
processFile(path.join(SRC_DIR, 'sensing.js'), 'sensing', [
  "// === 鼠标侦测",
  "// === 键盘侦测",
  "// === 距离侦测",
  "// === 计时器",
  "// === 精灵属性侦测",
  "// === 询问回答",
  "// === 当前时间",
  "// === 用户名",
  "// === 舞台尺寸",
  "// === 精灵数量",
  "// === 时间戳",
  "// === 格式化时间",
]);

// io.js: 控制台IO | 文件IO | 数据存储 | 弹窗
processFile(path.join(SRC_DIR, 'io.js'), 'io', [
  "io_read_file",
  "io_save_data",
  "io_clear_output",
]);

// oop.js: 类定义 | 属性 | 对象创建 | 方法调用 | 动态类 | self
processFile(path.join(SRC_DIR, 'oop.js'), 'oop', [
  "type: 'class_set_attr',",
  "type: 'class_create'",
  "type: 'class_call_method',",
  "// 新建类",
  "type: 'class_self'",
]);

// 3d.js: 创建 | 清除 | 属性 | 相机 | 场景 | 报告器
processFile(path.join(SRC_DIR, '3d.js'), '3d', [
  "// ===== 清除网格",
  "// ===== 网格属性",
  "// ===== 相机控制",
  "// ===== 场景效果",
  "// ===== 报告器",
]);

// scene.js: 事件 | 切换 | 保存 | 重载 | 创建 | 报告器
processFile(path.join(SRC_DIR, 'scene.js'), 'scene', [
  "// === 场景切换",
  "// === 场景保存",
  "// === 场景重载",
  "// === 场景创建",
  "// === 报告器",
]);

// minecraft.js: 事件 | 方块 | 实体 | 玩家 | 世界 | 建筑 | 逻辑 | Reporter
processFile(path.join(SRC_DIR, 'minecraft.js'), 'minecraft', [
  "// ===== 方块操作",
  "// ===== 实体操作",
  "// ===== 玩家操作",
  "// ===== 世界操作",
  "// ===== 建筑操作",
  "// ===== 逻辑操作",
  "// ===== Reporter 积木",
]);

console.log('\n=== Processing editor ===');

// editor 目录有相同结构，但可能少一些文件
const edFiles = ['control', 'variables', 'functions', 'lists', 'events', 
                 'motion', 'looks', 'sound', 'sensing', 'oop', '3d', 
                 'scene', 'minecraft'];

// 用同样的配置处理 editor
processFile(path.join(ED_DIR, 'control.js'), 'control', [
  "type: 'stop_all'",
  "type: 'control_label_run'",
  "// === 元编程",
]);
processFile(path.join(ED_DIR, 'variables.js'), 'variables', ["// 局部域"]);
processFile(path.join(ED_DIR, 'functions.js'), 'functions', [
  "type: 'func_param_get'", "// 动态函数定义",
]);
processFile(path.join(ED_DIR, 'lists.js'), 'lists', [
  "// 以下操作", "type: 'list_get'", "type: 'list_foreach'",
]);
processFile(path.join(ED_DIR, 'events.js'), 'events', [
  "type: 'event_broadcast',", "type: 'event_timer'",
]);
processFile(path.join(ED_DIR, 'motion.js'), 'motion', [
  "// ===== 位置控制", "// ===== 滑行", "// ===== 方向控制", "// ===== 反弹",
  "// ===== 超越 Scratch：速度系统", "// ===== 超越 Scratch：追踪系统",
  "// ===== 超越 Scratch：圆周运动", "// ===== 超越 Scratch：随机移动",
  "// ===== 超越 Scratch：位置历史", "// ===== 超越 Scratch：边界", "// ===== Reporter 积木",
]);
processFile(path.join(ED_DIR, 'looks.js'), 'looks', [
  "type: 'looks_say',", "type: 'looks_next_costume'", "type: 'looks_set_size'", "type: 'looks_get_size'",
]);
processFile(path.join(ED_DIR, 'sound.js'), 'sound', [
  "type: 'sound_stop',", "type: 'sound_set_volume'", "type: 'sound_load'",
]);
processFile(path.join(ED_DIR, 'sensing.js'), 'sensing', [
  "// === 鼠标侦测", "// === 键盘侦测", "// === 距离侦测", "// === 计时器",
  "// === 精灵属性侦测", "// === 询问回答", "// === 当前时间",
  "// === 用户名", "// === 舞台尺寸", "// === 精灵数量", "// === 时间戳", "// === 格式化时间",
]);
processFile(path.join(ED_DIR, 'oop.js'), 'oop', [
  "type: 'class_set_attr',", "type: 'class_create'",
  "type: 'class_call_method',", "// 新建类", "type: 'class_self'",
]);
processFile(path.join(ED_DIR, '3d.js'), '3d', [
  "// ===== 清除网格", "// ===== 网格属性", "// ===== 相机控制", "// ===== 场景效果", "// ===== 报告器",
]);
processFile(path.join(ED_DIR, 'scene.js'), 'scene', [
  "// === 场景切换", "// === 场景保存", "// === 场景重载", "// === 场景创建", "// === 报告器",
]);
processFile(path.join(ED_DIR, 'minecraft.js'), 'minecraft', [
  "// ===== 方块操作", "// ===== 实体操作", "// ===== 玩家操作",
  "// ===== 世界操作", "// ===== 建筑操作", "// ===== 逻辑操作", "// ===== Reporter 积木",
]);

console.log('\nDone!');
