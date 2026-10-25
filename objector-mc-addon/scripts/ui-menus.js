/**
 * Objector MC - 游戏内菜单系统
 * 使用 ActionFormData / ModalFormData 实现可视化积木编程 UI
 */
import { world, system } from '@minecraft/server';
import { ActionFormData, ModalFormData, MessageFormData } from '@minecraft/server-ui';
import { getCategories, getBlocksByCategory, executeBlock, BlockRegistry } from './block-commands.js';
import { ProgramManager } from './program-manager.js';

// ========== 主菜单 ==========

export async function showMainMenu(player) {
  const form = new ActionFormData()
    .title('§b§l⚡ Objector 编程台')
    .body('§7选择你要做的事情：')
    .button('§a🎯 执行积木\n§7选择积木立即执行', 'textures/ui/icon_recipe_construction')
    .button('§e📋 我的程序\n§7运行已保存的程序', 'textures/ui/icon_book_writable')
    .button('§d🔨 编写程序\n§7编排多个积木并保存', 'textures/ui/icon_recipe_nature')
    .button('§9📖 帮助\n§7查看使用指南', 'textures/ui/icon_recipe_item')
    .button('§c❌ 关闭');

  const result = await form.show(player);
  if (result.canceled) return;

  switch (result.selection) {
    case 0: await showCategoryMenu(player, 'execute'); break;
    case 1: await showProgramRunMenu(player); break;
    case 2: await showCategoryMenu(player, 'program'); break;
    case 3: await showHelpMenu(player); break;
  }
}

// ========== 分类菜单 ==========

export async function showCategoryMenu(player, mode) {
  const categories = getCategories();
  const form = new ActionFormData()
    .title(mode === 'execute' ? '§a§l🎯 选择积木分类' : '§d§l🔨 选择积木分类')
    .body('§7选择一个分类查看可用积木：');

  categories.forEach(cat => {
    form.button(`${cat.name}\n§7${cat.desc}`);
  });
  form.button('§c← 返回主菜单');

  const result = await form.show(player);
  if (result.canceled) return;

  if (result.selection >= categories.length) {
    await showMainMenu(player);
    return;
  }

  const cat = categories[result.selection];
  await showBlockListMenu(player, cat.id, mode);
}

// ========== 积木列表菜单 ==========

async function showBlockListMenu(player, categoryId, mode) {
  const blocks = getBlocksByCategory(categoryId);
  const form = new ActionFormData()
    .title(`§l${blocks[0] ? getCategories().find(c => c.id === categoryId)?.name : '积木列表'}`)
    .body('§7选择一个积木：');

  blocks.forEach(block => {
    form.button(`§f${block.name}\n§7${block.params.length} 个参数`);
  });
  form.button('§e← 返回分类');

  const result = await form.show(player);
  if (result.canceled) return;

  if (result.selection >= blocks.length) {
    await showCategoryMenu(player, mode);
    return;
  }

  const block = blocks[result.selection];

  if (mode === 'execute') {
    // 执行模式：填写参数后立即执行
    await showBlockParams(player, block);
  } else {
    // 编程模式：添加到当前程序
    await showBlockParamsForProgram(player, block);
  }
}

// ========== 积木参数表单（执行模式） ==========

export async function showBlockParams(player, block) {
  const form = new ModalFormData()
    .title(`§l⚙ ${block.name}`);

  // 根据参数定义添加表单控件
  block.params.forEach(param => {
    switch (param.type) {
      case 'dropdown': {
        const labels = param.options.map(o => param.names?.[o] || o);
        form.dropdown(`§f${param.label}`, labels, 0);
        break;
      }
      case 'text':
        form.textField(`§f${param.label}`, param.default || '', param.default || '');
        break;
      case 'slider':
        form.slider(`§f${param.label}`, param.min, param.max, 1, param.default || param.min);
        break;
      case 'toggle':
        form.toggle(`§f${param.label}`, param.default || false);
        break;
    }
  });

  const result = await form.show(player);
  if (result.canceled) return;

  // 解析参数值
  const params = {};
  block.params.forEach((param, i) => {
    const val = result.formValues[i];
    if (param.type === 'dropdown') {
      params[param.key] = param.options[val]; // 索引转实际值
    } else if (param.type === 'slider') {
      params[param.key] = Math.round(val);
    } else {
      params[param.key] = val;
    }
  });

  // 执行积木
  const result2 = executeBlock(block.id, params, player);
  player.sendMessage(result2.message);

  // 执行完毕后显示"再来一次"或"返回"选项
  await _showAfterExecute(player, block, params, result2);
}

// 执行后选项
async function _showAfterExecute(player, block, params, prevResult) {
  const form = new ActionFormData()
    .title('§a✓ 执行完成')
    .body(prevResult.message)
    .button('§a🔄 再执行一次\n§7使用相同参数再次执行')
    .button('§e⚙ 修改参数\n§7调整参数后重新执行')
    .button('§b📋 同类其他积木\n§7查看同分类的其他积木')
    .button('§9🏠 返回主菜单')
    .button('§c❌ 关闭');

  const result = await form.show(player);
  if (result.canceled) return;

  switch (result.selection) {
    case 0: // 再执行一次
      const r = executeBlock(block.id, params, player);
      player.sendMessage(r.message);
      await _showAfterExecute(player, block, params, r);
      break;
    case 1: // 修改参数
      await showBlockParams(player, block);
      break;
    case 2: // 同类其他
      await showBlockListMenu(player, block.category, 'execute');
      break;
    case 3: // 返回主菜单
      await showMainMenu(player);
      break;
  }
}

// ========== 积木参数表单（编程模式 - 添加到程序） ==========

async function showBlockParamsForProgram(player, block) {
  const form = new ModalFormData()
    .title(`§l📝 添加到程序: ${block.name}`);

  block.params.forEach(param => {
    switch (param.type) {
      case 'dropdown': {
        const labels = param.options.map(o => param.names?.[o] || o);
        form.dropdown(`§f${param.label}`, labels, 0);
        break;
      }
      case 'text':
        form.textField(`§f${param.label}`, param.default || '', param.default || '');
        break;
      case 'slider':
        form.slider(`§f${param.label}`, param.min, param.max, 1, param.default || param.min);
        break;
      case 'toggle':
        form.toggle(`§f${param.label}`, param.default || false);
        break;
    }
  });

  const result = await form.show(player);
  if (result.canceled) return;

  // 解析参数
  const params = {};
  block.params.forEach((param, i) => {
    const val = result.formValues[i];
    if (param.type === 'dropdown') {
      params[param.key] = param.options[val];
    } else if (param.type === 'slider') {
      params[param.key] = Math.round(val);
    } else {
      params[param.key] = val;
    }
  });

  // 添加到当前编辑的程序
  const program = ProgramManager.getCurrentProgram(player);
  program.steps.push({
    blockId: block.id,
    blockName: block.name,
    params: params,
  });

  player.sendMessage(`§a✓ 已添加: ${block.name} (共 ${program.steps.length} 步)`);

  // 显示程序编辑菜单
  await showProgramEditor(player);
}

// ========== 程序编辑器 ==========

async function showProgramEditor(player) {
  const program = ProgramManager.getCurrentProgram(player);

  const form = new ActionFormData()
    .title(`§d§l🔨 编辑程序: ${program.name}`)
    .body(`§7当前共 ${program.steps.length} 步：\n${program.steps.map((s, i) => `  §e${i + 1}. §f${s.blockName}`).join('\n')}`);

  form.button('§a➕ 添加积木\n§7从分类中选择积木添加');
  form.button('§e▶ 试运行\n§7按顺序执行所有步骤');
  if (program.steps.length > 0) {
    form.button('§c🗑 删除最后一步\n§7移除最后添加的积木');
    form.button('§c🗑 清空程序\n§7删除所有步骤');
  }
  form.button('§b💾 保存程序\n§7保存后可随时运行');
  form.button('§9📝 重命名\n§7修改程序名称');
  form.button('§c❌ 放弃编辑');

  const result = await form.show(player);
  if (result.canceled) return;

  switch (result.selection) {
    case 0: // 添加积木
      await showCategoryMenu(player, 'program');
      break;
    case 1: // 试运行
      const runResult = ProgramManager.runProgram(player, program.name);
      player.sendMessage(runResult.success ? `§a✓ 试运行成功！(${runResult.steps} 步)` : `§c✗ ${runResult.error}`);
      await showProgramEditor(player);
      break;
    case 2: // 删除最后一步
      if (program.steps.length > 0) {
        const removed = program.steps.pop();
        player.sendMessage(`§c已删除: ${removed.blockName}`);
      }
      await showProgramEditor(player);
      break;
    case 3: // 清空
      program.steps = [];
      player.sendMessage('§c已清空所有步骤');
      await showProgramEditor(player);
      break;
    case 4: // 保存
      await _saveProgram(player);
      break;
    case 5: // 重命名
      await _renameProgram(player);
      break;
    case 6: // 放弃
      ProgramManager.clearCurrentProgram(player);
      player.sendMessage('§e已放弃编辑');
      await showMainMenu(player);
      break;
  }
}

async function _saveProgram(player) {
  const form = new ModalFormData()
    .title('§b💾 保存程序')
    .textField('程序名称', '输入一个名称...', ProgramManager.getCurrentProgram(player).name);

  const result = await form.show(player);
  if (result.canceled) {
    await showProgramEditor(player);
    return;
  }

  const name = result.formValues[0].trim();
  if (!name) {
    player.sendMessage('§c名称不能为空');
    await showProgramEditor(player);
    return;
  }

  const program = ProgramManager.getCurrentProgram(player);
  program.name = name;
  ProgramManager.saveProgram(player, program);
  player.sendMessage(`§a✓ 程序 "${name}" 已保存！使用 §e/obj run ${name} §a运行`);
  await showMainMenu(player);
}

async function _renameProgram(player) {
  const form = new ModalFormData()
    .title('§9📝 重命名')
    .textField('新名称', '输入新名称...', ProgramManager.getCurrentProgram(player).name);

  const result = await form.show(player);
  if (result.canceled) {
    await showProgramEditor(player);
    return;
  }

  const name = result.formValues[0].trim();
  if (name) {
    ProgramManager.getCurrentProgram(player).name = name;
    player.sendMessage(`§a✓ 已重命名为: ${name}`);
  }
  await showProgramEditor(player);
}

// ========== 程序运行菜单 ==========

async function showProgramRunMenu(player) {
  const programs = ProgramManager.listPrograms(player);

  const form = new ActionFormData()
    .title('§e§l📋 我的程序')
    .body(programs.length === 0 ? '§7还没有保存的程序。\n使用"编写程序"功能创建！' : `§7共 ${programs.length} 个程序：`);

  programs.forEach(p => {
    form.button(`§e▶ ${p.name}\n§7${p.steps} 步`);
  });

  form.button('§a➕ 新建程序\n§7开始编写新程序');
  form.button('§c← 返回主菜单');

  const result = await form.show(player);
  if (result.canceled) return;

  if (result.selection >= programs.length) {
    if (result.selection === programs.length) {
      // 新建程序
      ProgramManager.startNewProgram(player, '新程序');
      await showProgramEditor(player);
    } else {
      await showMainMenu(player);
    }
    return;
  }

  const selected = programs[result.selection];

  // 显示程序详情
  await _showProgramDetail(player, selected);
}

async function _showProgramDetail(player, program) {
  const form = new ActionFormData()
    .title(`§e§l📋 ${program.name}`)
    .body(`§7共 ${program.steps} 步：\n${program.steps.map((s, i) => `  §e${i + 1}. §f${s.blockName}`).join('\n') || '§7(空程序)'}`);

  form.button('§a▶ 运行\n§7立即执行此程序');
  form.button('§e✏ 编辑\n§7修改程序内容');
  form.button('§c🗑 删除\n§7永久删除此程序');
  form.button('§9← 返回列表');

  const result = await form.show(player);
  if (result.canceled) return;

  switch (result.selection) {
    case 0: {
      const r = ProgramManager.runProgram(player, program.name);
      player.sendMessage(r.success ? `§a✓ ${program.name} 执行成功！(${r.steps} 步)` : `§c✗ ${r.error}`);
      await _showProgramDetail(player, program);
      break;
    }
    case 1: {
      // 复制到当前编辑
      const copy = JSON.parse(JSON.stringify(program));
      ProgramManager.setCurrentProgram(player, copy);
      await showProgramEditor(player);
      break;
    }
    case 2: {
      const confirm = new MessageFormData()
        .title('§c⚠ 确认删除')
        .body(`确定要删除程序 "${program.name}" 吗？\n此操作不可撤销！`)
        .button1('§c确认删除')
        .button2('§a取消');
      const cResult = await confirm.show(player);
      if (!cResult.canceled && cResult.selection === 0) {
        ProgramManager.deleteProgram(player, program.name);
        player.sendMessage(`§c已删除: ${program.name}`);
      }
      await showProgramRunMenu(player);
      break;
    }
    case 3:
      await showProgramRunMenu(player);
      break;
  }
}

// ========== 帮助菜单 ==========

export async function showHelpMenu(player) {
  const form = new ActionFormData()
    .title('§9§l📖 Objector 帮助')
    .body('§7Objector 编程模组让你在游戏内使用可视化积木操控 Minecraft 世界！\n\n§e基本命令：§f\n• §e/obj §f- 打开编程菜单\n• §e/obj list §f- 列出所有程序\n• §e/obj run <名称> §f- 运行程序\n• §e/obj delete <名称> §f- 删除程序\n\n§e使用方式：§f\n1. 输入 /obj 打开菜单\n2. 选择积木分类\n3. 选择积木并填写参数\n4. 点击执行！\n\n§d编写程序：§f\n把多个积木组合成序列，保存后随时运行。')
    .button('§b📦 方块积木', 'textures/ui/icon_recipe_construction')
    .button('§d🐾 生物积木', 'textures/ui/icon_recipe_nature')
    .button('§e👤 玩家积木', 'textures/ui/icon_recipe_item')
    .button('§9🌍 世界积木', 'textures/ui/icon_recipe_item')
    .button('§6🏗️ 建筑积木', 'textures/ui/icon_recipe_construction')
    .button('§c✨ 特效积木', 'textures/ui/icon_recipe_item')
    .button('§5🔧 逻辑积木', 'textures/ui/icon_recipe_item')
    .button('§a🏠 返回主菜单');

  const result = await form.show(player);
  if (result.canceled) return;

  if (result.selection < 7) {
    const categories = getCategories();
    const cat = categories[result.selection];
    const blocks = getBlocksByCategory(cat.id);

    const detailForm = new ActionFormData()
      .title(`${cat.name} §7- 积木列表`)
      .body(blocks.map(b => `• §f${b.name} §7(${b.params.length} 参数)`).join('\n'));
    detailForm.button('§a← 返回帮助');

    await detailForm.show(player);
    await showHelpMenu(player);
  } else {
    await showMainMenu(player);
  }
}

// ========== 导出 ==========

export { showBlockListMenu, showProgramEditor };

