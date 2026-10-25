/**
 * Objector MC Add-on - 主入口
 * Minecraft Bedrock 游戏内可视化积木编程模组
 * 玩家输入 /obj 打开编程菜单
 */
import { world, system, ItemStack } from '@minecraft/server';
import { ActionFormData, ModalFormData, MessageFormData } from '@minecraft/server-ui';
import { BlockRegistry, executeBlock, getCategories, getBlocksByCategory } from './block-commands.js';
import { showMainMenu, showCategoryMenu, showBlockParams, showProgramMenu, showHelpMenu } from './ui-menus.js';
import { ProgramManager } from './program-manager.js';

// ========== 命令注册 ==========

// /obj - 打开 Objector 编程主菜单
world.beforeEvents.chatSend.subscribe((event) => {
  const msg = event.message.trim().toLowerCase();
  if (msg === '/obj' || msg === '/objector') {
    event.cancel = true;
    const player = event.sender;
    // 延迟一帧执行 UI（避免在事件回调中操作 UI）
    system.run(() => {
      showMainMenu(player);
    });
  }
  // /obj help - 帮助菜单
  else if (msg === '/obj help' || msg === '/obj 帮助') {
    event.cancel = true;
    system.run(() => showHelpMenu(event.sender));
  }
  // /obj run <name> - 运行已保存的程序
  else if (msg.startsWith('/obj run ')) {
    event.cancel = true;
    const name = event.message.trim().substring(9).trim();
    system.run(() => {
      const player = event.sender;
      const result = ProgramManager.runProgram(player, name);
      if (result.success) {
        player.sendMessage(`§a✓ 程序 "${name}" 执行成功！共 ${result.steps} 步`);
      } else {
        player.sendMessage(`§c✗ 执行失败: ${result.error}`);
      }
    });
  }
  // /obj list - 列出所有程序
  else if (msg === '/obj list' || msg === '/obj 列表') {
    event.cancel = true;
    system.run(() => {
      const player = event.sender;
      const programs = ProgramManager.listPrograms(player);
      if (programs.length === 0) {
        player.sendMessage('§e还没有保存的程序。使用 /obj 菜单创建！');
      } else {
        player.sendMessage('§b§l已保存的程序:');
        programs.forEach(p => {
          player.sendMessage(`  §a${p.name} §7(${p.steps} 步) - /obj run ${p.name}`);
        });
      }
    });
  }
  // /obj delete <name> - 删除程序
  else if (msg.startsWith('/obj delete ') || msg.startsWith('/obj 删除 ')) {
    event.cancel = true;
    const name = event.message.trim().substring(msg.startsWith('/obj delete ') ? 12 : 8).trim();
    system.run(() => {
      const player = event.sender;
      if (ProgramManager.deleteProgram(player, name)) {
        player.sendMessage(`§a✓ 已删除程序: ${name}`);
      } else {
        player.sendMessage(`§c✗ 程序不存在: ${name}`);
      }
    });
  }
});

// ========== 世界初始化 ==========

world.afterEvents.worldInitialize.subscribe(() => {
  // 初始化方块注册表
  BlockRegistry.init();
  // 初始化程序管理器
  ProgramManager.init();

  // 向所有在线玩家发送欢迎信息
  for (const player of world.getAllPlayers()) {
    player.sendMessage('');
    player.sendMessage('§b§l═══════════════════════════════════════');
    player.sendMessage('  §e§l⚡ Objector 编程模组 §r§7v1.0');
    player.sendMessage('  §a输入 §e/obj §a打开可视化编程菜单');
    player.sendMessage('  §a输入 §e/obj help §a查看帮助');
    player.sendMessage('§b§l═══════════════════════════════════════');
    player.sendMessage('');
  }
});

// ========== 玩家加入事件 ==========

world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  const player = event.player;

  // 给新玩家一本书作为快捷入口
  const inventory = player.getComponent('minecraft:inventory');
  if (inventory) {
    const container = inventory.container;
    // 检查是否已经有 Objector 指南书
    let hasGuide = false;
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (item && item.typeId === 'minecraft:book' && item.nameTag === '§b§lObjector 编程指南') {
        hasGuide = true;
        break;
      }
    }
    if (!hasGuide) {
      try {
        const book = new ItemStack('minecraft:book', 1);
        book.nameTag = '§b§lObjector 编程指南';
        book.setLore(['§7右键打开 Objector 编程菜单', '§e或输入 /obj 打开']);
        container.addItem(book);
      } catch (e) {
        // 忽略物品创建失败
      }
    }
  }

  // 延迟发送欢迎消息（等玩家完全加载）
  system.runTimeout(() => {
    player.sendMessage('§b[Objector] §a欢迎！输入 §e/obj §a开始编程之旅 ✨');
  }, 40); // 2 秒后
});

// ========== 全局执行器（用于定时任务） ==========

// 每 tick 检查是否有待执行的定时任务
const _scheduledTasks = new Map(); // playerId -> [tasks]

export function scheduleTask(player, delayTicks, callback) {
  const id = player.id;
  if (!_scheduledTasks.has(id)) _scheduledTasks.set(id, []);
  _scheduledTasks.get(id).push({
    executeAt: system.currentTick + delayTicks,
    callback: callback,
  });
}

export function clearPlayerTasks(player) {
  _scheduledTasks.delete(player.id);
}

// 主循环 - 每 tick 检查定时任务
system.runInterval(() => {
  const now = system.currentTick;
  for (const [playerId, tasks] of _scheduledTasks) {
    const remaining = [];
    for (const task of tasks) {
      if (task.executeAt <= now) {
        try { task.callback(); } catch (e) { /* 忽略 */ }
      } else {
        remaining.push(task);
      }
    }
    if (remaining.length === 0) {
      _scheduledTasks.delete(playerId);
    } else {
      _scheduledTasks.set(playerId, remaining);
    }
  }
}, 1);

// ========== 导出供 UI 使用 ==========

export { BlockRegistry, executeBlock, getCategories, getBlocksByCategory, ProgramManager };
export { showMainMenu, showCategoryMenu, showBlockParams, showProgramMenu, showHelpMenu };
export { scheduleTask, clearPlayerTasks };
