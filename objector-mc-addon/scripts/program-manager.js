/**
 * Objector MC - 程序管理器
 * 使用 Minecraft dynamic properties 存储和运行玩家程序
 */
import { world, system } from '@minecraft/server';
import { executeBlock, BlockRegistry } from './block-commands.js';

// ========== 内存中的程序状态 ==========

// 玩家当前正在编辑的程序
const _currentPrograms = new Map(); // playerId -> program

// 玩家已保存的程序列表（从 dynamic properties 加载）
const _playerPrograms = new Map(); // playerId -> [programs]

// ========== 程序管理器 ==========

const ProgramManager = {
  init() {
    console.log('[Objector] ProgramManager 已初始化');
  },

  /** 获取玩家正在编辑的程序（如果没有则创建新的） */
  getCurrentProgram(player) {
    const id = player.id;
    if (!_currentPrograms.has(id)) {
      _currentPrograms.set(id, {
        name: '新程序',
        steps: [],
        createdAt: Date.now(),
      });
    }
    return _currentPrograms.get(id);
  },

  /** 设置当前编辑的程序 */
  setCurrentProgram(player, program) {
    _currentPrograms.set(player.id, program);
  },

  /** 开始新程序 */
  startNewProgram(player, name) {
    _currentPrograms.set(player.id, {
      name: name || '新程序',
      steps: [],
      createdAt: Date.now(),
    });
  },

  /** 清空当前程序 */
  clearCurrentProgram(player) {
    _currentPrograms.delete(player.id);
  },

  /** 保存程序到玩家的 dynamic properties */
  saveProgram(player, program) {
    const id = player.id;
    const programs = _loadPrograms(id);

    // 如果同名程序已存在则覆盖
    const idx = programs.findIndex(p => p.name === program.name);
    if (idx >= 0) {
      programs[idx] = { ...program };
    } else {
      programs.push({ ...program });
    }

    _savePrograms(id, programs);
    _currentPrograms.delete(id); // 保存后清除编辑状态
  },

  /** 列出玩家所有已保存程序 */
  listPrograms(player) {
    return _loadPrograms(player.id);
  },

  /** 删除指定程序 */
  deleteProgram(player, name) {
    const id = player.id;
    const programs = _loadPrograms(id);
    const idx = programs.findIndex(p => p.name === name);
    if (idx < 0) return false;

    programs.splice(idx, 1);
    _savePrograms(id, programs);
    return true;
  },

  /** 运行指定名称的程序 */
  runProgram(player, name) {
    const programs = _loadPrograms(player.id);
    const program = programs.find(p => p.name === name);
    if (!program) {
      return { success: false, error: `程序 "${name}" 不存在` };
    }

    return _executeProgram(player, program);
  },

  /** 运行当前编辑中的程序 */
  runCurrentProgram(player) {
    const program = _currentPrograms.get(player.id);
    if (!program || program.steps.length === 0) {
      return { success: false, error: '程序为空' };
    }

    return _executeProgram(player, program);
  },
};

// ========== 内部函数 ==========

/** 执行一个程序的所有步骤 */
function _executeProgram(player, program) {
  if (!program.steps || program.steps.length === 0) {
    return { success: false, error: '程序没有步骤' };
  }

  let successCount = 0;
  const errors = [];

  for (let i = 0; i < program.steps.length; i++) {
    const step = program.steps[i];
    try {
      const result = executeBlock(step.blockId, step.params, player);
      if (result.success) {
        successCount++;
      } else {
        errors.push(`步骤 ${i + 1} (${step.blockName}): ${result.message}`);
      }
    } catch (e) {
      errors.push(`步骤 ${i + 1} (${step.blockName}): ${e.message}`);
    }
  }

  if (errors.length > 0) {
    player.sendMessage(`§c⚠ 部分步骤执行失败:`);
    errors.forEach(e => player.sendMessage(`  §7${e}`));
  }

  return {
    success: successCount > 0,
    steps: program.steps.length,
    successCount,
    errorCount: errors.length,
  };
}

/** 从 dynamic properties 加载玩家的程序列表 */
function _loadPrograms(playerId) {
  // 先检查内存缓存
  if (_playerPrograms.has(playerId)) {
    return _playerPrograms.get(playerId);
  }

  // 从 dynamic properties 读取
  try {
    const data = world.getDynamicProperty(`obj_programs_${playerId}`);
    if (data) {
      const programs = JSON.parse(data);
      _playerPrograms.set(playerId, programs);
      return programs;
    }
  } catch (e) {
    console.warn(`[Objector] 加载程序失败: ${e.message}`);
  }

  return [];
}

/** 保存程序列表到 dynamic properties */
function _savePrograms(playerId, programs) {
  _playerPrograms.set(playerId, programs);
  try {
    world.setDynamicProperty(`obj_programs_${playerId}`, JSON.stringify(programs));
  } catch (e) {
    console.error(`[Objector] 保存程序失败: ${e.message}`);
  }
}

// ========== 导出 ==========

export { ProgramManager };
