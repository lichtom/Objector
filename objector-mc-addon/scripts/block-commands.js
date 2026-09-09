/**
 * Objector MC - 积木指令注册表
 * 定义所有可用的积木分类和指令，每个积木有参数表单配置
 */
import { world, system } from '@minecraft/server';

// ========== 方块/物品选项列表 ==========
const BLOCK_TYPES = [
  'stone', 'dirt', 'grass_block', 'cobblestone', 'oak_planks', 'oak_log',
  'sand', 'gravel', 'glass', 'obsidian', 'bedrock',
  'iron_block', 'gold_block', 'diamond_block', 'emerald_block', 'netherite_block',
  'redstone_block', 'lapis_block', 'tnt', 'glowstone',
  'wool', 'concrete', 'terracotta', 'sponge', 'hay_block',
  'water', 'lava', 'air',
];

const BLOCK_NAMES = {
  stone: '§7石头', dirt: '§6泥土', grass_block: '§a草方块', cobblestone: '§7圆石',
  oak_planks: '§6橡木木板', oak_log: '§6橡木原木', sand: '§e沙子', gravel: '§7沙砾',
  glass: '§f玻璃', obsidian: '§5黑曜石', bedrock: '§8基岩',
  iron_block: '§f铁块', gold_block: '§e金块', diamond_block: '§b钻石块',
  emerald_block: '§a绿宝石块', netherite_block: '§8下界合金块',
  redstone_block: '§c红石块', lapis_block: '§9青金石块', tnt: '§cTNT',
  glowstone: '§e萤石', wool: '§f羊毛', concrete: '§f混凝土',
  terracotta: '§6陶瓦', sponge: '§e海绵', hay_block: '§e干草块',
  water: '§9水', lava: '§6岩浆', air: '§f空气(清除)',
};

const ENTITY_TYPES = [
  'zombie', 'skeleton', 'creeper', 'spider', 'enderman',
  'cow', 'pig', 'chicken', 'sheep', 'horse', 'wolf', 'cat', 'villager',
  'iron_golem', 'snow_golem', 'blaze', 'ghast', 'wither_skeleton',
  'slime', 'magma_cube', 'guardian', 'phantom', 'drowned',
  'bat', 'bee', 'fox', 'rabbit', 'panda', 'dolphin',
  'armor_stand', 'minecart', 'boat', 'tnt',
];

const ENTITY_NAMES = {
  zombie: '§2僵尸', skeleton: '§7骷髅', creeper: '§a苦力怕', spider: '§8蜘蛛',
  enderman: '§5末影人', cow: '§6牛', pig: '§d猪', chicken: '§f鸡',
  sheep: '§f羊', horse: '§6马', wolf: '§7狼', cat: '§e猫',
  villager: '§a村民', iron_golem: '§f铁傀儡', snow_golem: '§f雪傀儡',
  blaze: '§6烈焰人', ghast: '§f恶魂', wither_skeleton: '§8凋灵骷髅',
  slime: '§a史莱姆', magma_cube: '§c岩浆怪', guardian: '§3守卫者',
  phantom: '§5幻翼', drowned: '§9溺尸', bat: '§8蝙蝠', bee: '§e蜜蜂',
  fox: '§6狐狸', rabbit: '§f兔子', panda: '§f熊猫', dolphin: '§b海豚',
  armor_stand: '§7盔甲架', minecart: '§7矿车', boat: '§6船', tnt: '§cTNT(点燃)',
};

const ITEM_TYPES = [
  'diamond_sword', 'diamond_pickaxe', 'diamond_axe', 'diamond_shovel',
  'iron_sword', 'iron_pickaxe', 'bow', 'crossbow', 'trident', 'shield',
  'diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots',
  'netherite_sword', 'netherite_pickaxe',
  'diamond', 'emerald', 'gold_ingot', 'iron_ingot', 'netherite_ingot',
  'apple', 'golden_apple', 'enchanted_golden_apple', 'bread', 'steak',
  'torch', 'lantern', 'bucket', 'water_bucket', 'lava_bucket',
  'ender_pearl', 'firework_rocket', 'elytra', 'totem_of_undying',
  'experience_bottle', 'name_tag', 'saddle',
];

const ITEM_NAMES = {
  diamond_sword: '§b钻石剑', diamond_pickaxe: '§b钻石镐', diamond_axe: '§b钻石斧',
  diamond_shovel: '§b钻石铲', iron_sword: '§f铁剑', iron_pickaxe: '§f铁镐',
  bow: '§7弓', crossbow: '§7弩', trident: '§3三叉戟', shield: '§7盾牌',
  diamond_helmet: '§b钻石头盔', diamond_chestplate: '§b钻石胸甲',
  diamond_leggings: '§b钻石护腿', diamond_boots: '§b钻石靴子',
  netherite_sword: '§8下界合金剑', netherite_pickaxe: '§8下界合金镐',
  diamond: '§b钻石', emerald: '§a绿宝石', gold_ingot: '§e金锭',
  iron_ingot: '§f铁锭', netherite_ingot: '§8下界合金锭',
  apple: '§c苹果', golden_apple: '§e金苹果', enchanted_golden_apple: '§e附魔金苹果',
  bread: '§6面包', steak: '§6牛排', torch: '§e火把', lantern: '§e灯笼',
  bucket: '§7桶', water_bucket: '§9水桶', lava_bucket: '§6岩浆桶',
  ender_pearl: '§5末影珍珠', firework_rocket: '§e烟花', elytra: '§f鞘翅',
  totem_of_undying: '§e不死图腾', experience_bottle: '§a附魔之瓶',
  name_tag: '§f命名牌', saddle: '§6鞍',
};

// ========== 积木分类 ==========
const CATEGORIES = [
  { id: 'block', name: '§a§l📦 方块', desc: '放置、填充、替换方块' },
  { id: 'entity', name: '§d§l🐾 生物', desc: '生成、杀死、操控实体' },
  { id: 'player', name: '§e§l👤 玩家', desc: '传送、物品、效果' },
  { id: 'world', name: '§9§l🌍 世界', desc: '天气、时间、游戏规则' },
  { id: 'structure', name: '§6§l🏗️ 建筑', desc: '生成结构、填充区域' },
  { id: 'effect', name: '§c§l✨ 特效', desc: '粒子、声音、爆炸' },
  { id: 'logic', name: '§5§l🔧 逻辑', desc: '循环、条件、变量' },
];

// ========== 积木注册表 ==========
const _blocks = [];

const BlockRegistry = {
  init() {
    _registerAllBlocks();
    console.log(`[Objector] 已注册 ${_blocks.length} 个积木指令`);
  },

  getAll() { return _blocks; },
  getById(id) { return _blocks.find(b => b.id === id); },
};

function _registerAllBlocks() {
  // ============ 📦 方块类 ============

  _register('block', 'place_block', '放置方块', [
    { key: 'type', label: '方块类型', type: 'dropdown', options: BLOCK_TYPES, names: BLOCK_NAMES },
    { key: 'x', label: 'X 坐标', type: 'text', default: '~' },
    { key: 'y', label: 'Y 坐标', type: 'text', default: '~' },
    { key: 'z', label: 'Z 坐标', type: 'text', default: '~1' },
  ], (p, player) => {
    _run(player, `setblock ${p.x} ${p.y} ${p.z} ${p.type}`);
    return `§a✓ 已在 (${p.x},${p.y},${p.z}) 放置 ${BLOCK_NAMES[p.type] || p.type}`;
  });

  _register('block', 'fill_area', '填充区域', [
    { key: 'type', label: '方块类型', type: 'dropdown', options: BLOCK_TYPES, names: BLOCK_NAMES },
    { key: 'x1', label: '起始 X', type: 'text', default: '~-3' },
    { key: 'y1', label: '起始 Y', type: 'text', default: '~' },
    { key: 'z1', label: '起始 Z', type: 'text', default: '~-3' },
    { key: 'x2', label: '结束 X', type: 'text', default: '~3' },
    { key: 'y2', label: '结束 Y', type: 'text', default: '~3' },
    { key: 'z2', label: '结束 Z', type: 'text', default: '~3' },
  ], (p, player) => {
    _run(player, `fill ${p.x1} ${p.y1} ${p.z1} ${p.x2} ${p.y2} ${p.z2} ${p.type}`);
    return `§a✓ 已填充区域为 ${BLOCK_NAMES[p.type] || p.type}`;
  });

  _register('block', 'replace_blocks', '替换方块', [
    { key: 'from', label: '被替换方块', type: 'dropdown', options: BLOCK_TYPES, names: BLOCK_NAMES },
    { key: 'to', label: '替换为', type: 'dropdown', options: BLOCK_TYPES, names: BLOCK_NAMES },
    { key: 'x1', label: '起始 X', type: 'text', default: '~-5' },
    { key: 'y1', label: '起始 Y', type: 'text', default: '~' },
    { key: 'z1', label: '起始 Z', type: 'text', default: '~-5' },
    { key: 'x2', label: '结束 X', type: 'text', default: '~5' },
    { key: 'y2', label: '结束 Y', type: 'text', default: '~5' },
    { key: 'z2', label: '结束 Z', type: 'text', default: '~5' },
  ], (p, player) => {
    _run(player, `fill ${p.x1} ${p.y1} ${p.z1} ${p.x2} ${p.y2} ${p.z2} ${p.to} replace ${p.from}`);
    return `§a✓ 已将区域内 ${BLOCK_NAMES[p.from]} 替换为 ${BLOCK_NAMES[p.to]}`;
  });

  _register('block', 'clear_area', '清除区域', [
    { key: 'x1', label: '起始 X', type: 'text', default: '~-3' },
    { key: 'y1', label: '起始 Y', type: 'text', default: '~' },
    { key: 'z1', label: '起始 Z', type: 'text', default: '~-3' },
    { key: 'x2', label: '结束 X', type: 'text', default: '~3' },
    { key: 'y2', label: '结束 Y', type: 'text', default: '~5' },
    { key: 'z2', label: '结束 Z', type: 'text', default: '~3' },
  ], (p, player) => {
    _run(player, `fill ${p.x1} ${p.y1} ${p.z1} ${p.x2} ${p.y2} ${p.z2} air`);
    return '§a✓ 已清除区域内所有方块';
  });

  _register('block', 'clone_structure', '克隆结构', [
    { key: 'x1', label: '源起始 X', type: 'text', default: '~-5' },
    { key: 'y1', label: '源起始 Y', type: 'text', default: '~' },
    { key: 'z1', label: '源起始 Z', type: 'text', default: '~-5' },
    { key: 'x2', label: '源结束 X', type: 'text', default: '~5' },
    { key: 'y2', label: '源结束 Y', type: 'text', default: '~5' },
    { key: 'z2', label: '源结束 Z', type: 'text', default: '~5' },
    { key: 'dx', label: '目标 X', type: 'text', default: '~10' },
    { key: 'dy', label: '目标 Y', type: 'text', default: '~' },
    { key: 'dz', label: '目标 Z', type: 'text', default: '~10' },
  ], (p, player) => {
    _run(player, `clone ${p.x1} ${p.y1} ${p.z1} ${p.x2} ${p.y2} ${p.z2} ${p.dx} ${p.dy} ${p.dz}`);
    return '§a✓ 已克隆结构到目标位置';
  });

  // ============ 🐾 生物类 ============

  _register('entity', 'spawn_entity', '生成生物', [
    { key: 'type', label: '生物类型', type: 'dropdown', options: ENTITY_TYPES, names: ENTITY_NAMES },
    { key: 'x', label: 'X 坐标', type: 'text', default: '~' },
    { key: 'y', label: 'Y 坐标', type: 'text', default: '~1' },
    { key: 'z', label: 'Z 坐标', type: 'text', default: '~' },
    { key: 'count', label: '数量', type: 'slider', min: 1, max: 20, default: 1 },
  ], (p, player) => {
    for (let i = 0; i < p.count; i++) {
      _run(player, `summon minecraft:${p.type} ${p.x} ${p.y} ${p.z}`);
    }
    return `§a✓ 已生成 ${p.count} 只 ${ENTITY_NAMES[p.type] || p.type}`;
  });

  _register('entity', 'kill_nearby', '杀死附近实体', [
    { key: 'type', label: '实体类型', type: 'dropdown', options: [...ENTITY_TYPES, '*'], names: { ...ENTITY_NAMES, '*': '§c全部' } },
    { key: 'radius', label: '范围 (格)', type: 'slider', min: 1, max: 50, default: 10 },
  ], (p, player) => {
    _run(player, `kill @e[type=${p.type},r=${p.radius}]`);
    return `§a✓ 已杀死 ${p.radius} 格内的 ${ENTITY_NAMES[p.type] || p.type}`;
  });

  _register('entity', 'ride_entity', '骑乘实体', [
    { key: 'type', label: '骑乘', type: 'dropdown', options: ['horse', 'pig', 'boat', 'minecart', 'llama'], names: { horse: '马', pig: '猪', boat: '船', minecart: '矿车', llama: '羊驼' } },
  ], (p, player) => {
    const pos = player.location;
    _run(player, `summon minecraft:${p.type} ~ ~ ~`);
    system.runTimeout(() => {
      _run(player, `ride @s start_riding @e[type=${p.type},c=1,r=3]`);
    }, 5);
    return `§a✓ 已生成 ${p.type} 并尝试骑乘`;
  });

  _register('entity', 'tp_entity', '传送实体', [
    { key: 'target', label: '目标', type: 'text', default: '@e[type=zombie,r=10]' },
    { key: 'x', label: '目标 X', type: 'text', default: '~' },
    { key: 'y', label: '目标 Y', type: 'text', default: '~5' },
    { key: 'z', label: '目标 Z', type: 'text', default: '~' },
  ], (p, player) => {
    _run(player, `tp ${p.target} ${p.x} ${p.y} ${p.z}`);
    return `§a✓ 已传送实体到 (${p.x},${p.y},${p.z})`;
  });

  // ============ 👤 玩家类 ============

  _register('player', 'teleport', '传送玩家', [
    { key: 'target', label: '目标玩家', type: 'text', default: '@s' },
    { key: 'x', label: 'X 坐标', type: 'text', default: '0' },
    { key: 'y', label: 'Y 坐标', type: 'text', default: '64' },
    { key: 'z', label: 'Z 坐标', type: 'text', default: '0' },
  ], (p, player) => {
    _run(player, `tp ${p.target} ${p.x} ${p.y} ${p.z}`);
    return `§a✓ 已传送到 (${p.x},${p.y},${p.z})`;
  });

  _register('player', 'give_item', '给予物品', [
    { key: 'item', label: '物品', type: 'dropdown', options: ITEM_TYPES, names: ITEM_NAMES },
    { key: 'count', label: '数量', type: 'slider', min: 1, max: 64, default: 1 },
  ], (p, player) => {
    _run(player, `give @s minecraft:${p.item} ${p.count}`);
    return `§a✓ 已获得 ${ITEM_NAMES[p.item] || p.item} x${p.count}`;
  });

  _register('player', 'set_gamemode', '设置游戏模式', [
    { key: 'mode', label: '模式', type: 'dropdown', options: ['survival', 'creative', 'adventure', 'spectator'], names: { survival: '§a生存', creative: '§e创造', adventure: '§6冒险', spectator: '§7旁观' } },
  ], (p, player) => {
    _run(player, `gamemode ${p.mode}`);
    return `§a✓ 已切换为 ${p.mode} 模式`;
  });

  _register('player', 'add_effect', '添加效果', [
    { key: 'effect', label: '效果', type: 'dropdown', options: ['speed', 'strength', 'jump_boost', 'regeneration', 'resistance', 'fire_resistance', 'night_vision', 'invisibility', 'haste', 'slow_falling'], names: { speed: '§b速度', strength: '§c力量', jump_boost: '§a跳跃提升', regeneration: '§d再生', resistance: '§7抗性', fire_resistance: '§6抗火', night_vision: '§9夜视', invisibility: '§f隐身', haste: '§e急迫', slow_falling: '§f缓降' } },
    { key: 'duration', label: '持续时间(秒)', type: 'slider', min: 5, max: 600, default: 30 },
    { key: 'level', label: '等级', type: 'slider', min: 1, max: 5, default: 1 },
  ], (p, player) => {
    _run(player, `effect @s ${p.effect} ${p.duration} ${p.level - 1}`);
    return `§a✓ 已获得 ${p.effect} ${p.level}级 ${p.duration}秒`;
  });

  _register('player', 'set_xp', '设置经验', [
    { key: 'amount', label: '经验等级', type: 'slider', min: 0, max: 100, default: 10 },
  ], (p, player) => {
    _run(player, `xp ${p.amount}L @s`);
    return `§a✓ 已设置经验等级为 ${p.amount}`;
  });

  _register('player', 'feed_player', '恢复饱食度', [], (p, player) => {
    _run(player, `effect @s saturation 1 255`);
    return '§a✓ 已恢复饱食度';
  });

  _register('player', 'heal_player', '恢复生命值', [
    { key: 'amount', label: '恢复量(心)', type: 'slider', min: 1, max: 20, default: 20 },
  ], (p, player) => {
    _run(player, `effect @s instant_health 1 ${Math.floor(p.amount / 2)}`);
    return `§a✓ 已恢复 ${p.amount} 颗心`;
  });

  // ============ 🌍 世界类 ============

  _register('world', 'set_time', '设置时间', [
    { key: 'time', label: '时间', type: 'dropdown', options: ['day', 'noon', 'night', 'midnight'], names: { day: '§e白天(1000)', noon: '§e正午(6000)', night: '§9夜晚(13000)', midnight: '§8午夜(18000)' } },
  ], (p, player) => {
    _run(player, `time set ${p.time}`);
    return `§a✓ 已设置时间为 ${p.time}`;
  });

  _register('world', 'set_weather', '设置天气', [
    { key: 'weather', label: '天气', type: 'dropdown', options: ['clear', 'rain', 'thunder'], names: { clear: '§e晴天', rain: '§9雨天', thunder: '§8雷暴' } },
    { key: 'duration', label: '持续时间(秒)', type: 'slider', min: 10, max: 3600, default: 300 },
  ], (p, player) => {
    _run(player, `weather ${p.weather} ${p.duration}`);
    return `§a✓ 已设置天气为 ${p.weather}，持续 ${p.duration} 秒`;
  });

  _register('world', 'set_difficulty', '设置难度', [
    { key: 'diff', label: '难度', type: 'dropdown', options: ['peaceful', 'easy', 'normal', 'hard'], names: { peaceful: '§a和平', easy: '§e简单', normal: '§6普通', hard: '§c困难' } },
  ], (p, player) => {
    _run(player, `difficulty ${p.diff}`);
    return `§a✓ 已设置难度为 ${p.diff}`;
  });

  _register('world', 'gamerule_set', '设置游戏规则', [
    { key: 'rule', label: '规则', type: 'dropdown', options: ['keepInventory', 'doDaylightCycle', 'doWeatherCycle', 'doMobSpawning', 'doFireTick', 'mobGriefing', 'pvp', 'doTileDrops', 'naturalRegeneration', 'showCoordinates'], names: { keepInventory: '死亡不掉落', doDaylightCycle: '日夜循环', doWeatherCycle: '天气变化', doMobSpawning: '生物生成', doFireTick: '火焰蔓延', mobGriefing: '生物破坏', pvp: 'PvP', doTileDrops: '方块掉落', naturalRegeneration: '自然回血', showCoordinates: '显示坐标' } },
    { key: 'value', label: '开关', type: 'toggle', default: true },
  ], (p, player) => {
    _run(player, `gamerule ${p.rule} ${p.value}`);
    return `§a✓ 已设置 ${p.rule} = ${p.value}`;
  });

  _register('world', 'spawn_point', '设置出生点', [
    { key: 'x', label: 'X 坐标', type: 'text', default: '~' },
    { key: 'y', label: 'Y 坐标', type: 'text', default: '~' },
    { key: 'z', label: 'Z 坐标', type: 'text', default: '~' },
  ], (p, player) => {
    _run(player, `setworldspawn ${p.x} ${p.y} ${p.z}`);
    return `§a✓ 已设置世界出生点为 (${p.x},${p.y},${p.z})`;
  });

  // ============ 🏗️ 建筑类 ============

  _register('structure', 'build_wall', '生成墙壁', [
    { key: 'type', label: '方块', type: 'dropdown', options: BLOCK_TYPES.slice(0, 12), names: BLOCK_NAMES },
    { key: 'length', label: '长度', type: 'slider', min: 1, max: 20, default: 5 },
    { key: 'height', label: '高度', type: 'slider', min: 1, max: 10, default: 3 },
    { key: 'direction', label: '方向', type: 'dropdown', options: ['x', 'z'], names: { x: '§b东西(X)', z: '§a南北(Z)' } },
  ], (p, player) => {
    const dir = p.direction === 'x' ? 'x' : 'z';
    const endCoord = dir === 'x' ? `~${p.length - 1}` : `~${p.length - 1}`;
    if (dir === 'x') {
      _run(player, `fill ~ ~ ~ ~${p.length - 1} ~${p.height - 1} ~ ${p.type}`);
    } else {
      _run(player, `fill ~ ~ ~ ~ ~${p.height - 1} ~${p.length - 1} ${p.type}`);
    }
    return `§a✓ 已生成 ${p.length}x${p.height} 的 ${BLOCK_NAMES[p.type]} 墙壁`;
  });

  _register('structure', 'build_floor', '生成地板', [
    { key: 'type', label: '方块', type: 'dropdown', options: BLOCK_TYPES.slice(0, 12), names: BLOCK_NAMES },
    { key: 'size', label: '大小', type: 'slider', min: 1, max: 20, default: 5 },
  ], (p, player) => {
    const half = Math.floor(p.size / 2);
    _run(player, `fill ~-${half} ~-1 ~-${half} ~${half} ~-1 ~${half} ${p.type}`);
    return `§a✓ 已生成 ${p.size}x${p.size} 的 ${BLOCK_NAMES[p.type]} 地板`;
  });

  _register('structure', 'build_house', '生成简易房屋', [
    { key: 'wall', label: '墙壁方块', type: 'dropdown', options: BLOCK_TYPES.slice(0, 8), names: BLOCK_NAMES },
    { key: 'roof', label: '屋顶方块', type: 'dropdown', options: BLOCK_TYPES.slice(0, 8), names: BLOCK_NAMES },
    { key: 'size', label: '大小(奇数)', type: 'slider', min: 5, max: 15, default: 7 },
  ], (p, player) => {
    const h = Math.floor(p.size / 2);
    const s = p.size;
    // 地板
    _run(player, `fill ~ ~-1 ~ ~${s - 1} ~-1 ~${s - 1} oak_planks`);
    // 四面墙
    _run(player, `fill ~ ~ ~ ~ ~3 ~${s - 1} ${p.wall}`); // 南墙
    _run(player, `fill ~${s - 1} ~ ~ ~${s - 1} ~3 ~${s - 1} ${p.wall}`); // 北墙
    _run(player, `fill ~ ~ ~ ~${s - 1} ~3 ~ ${p.wall}`); // 西墙
    _run(player, `fill ~ ~${s - 1} ~${s - 1} ~3 ~${s - 1} ${p.wall}`); // 东墙
    // 屋顶
    _run(player, `fill ~-1 ~4 ~-1 ~${s} ~4 ~${s} ${p.roof}`);
    // 挖门
    _run(player, `setblock ~${h} ~ ~ air`);
    _run(player, `setblock ~${h} ~1 ~ air`);
    // 挖窗
    _run(player, `setblock ~ ~1 ~${h} glass`);
    _run(player, `setblock ~${s - 1} ~1 ~${h} glass`);
    return `§a✓ 已生成 ${s}x${s} 的简易房屋`;
  });

  _register('structure', 'build_pillar', '生成柱子', [
    { key: 'type', label: '方块', type: 'dropdown', options: BLOCK_TYPES.slice(0, 12), names: BLOCK_NAMES },
    { key: 'height', label: '高度', type: 'slider', min: 1, max: 30, default: 5 },
  ], (p, player) => {
    _run(player, `fill ~ ~ ~ ~ ~${p.height - 1} ~ ${p.type}`);
    return `§a✓ 已生成高度 ${p.height} 的 ${BLOCK_NAMES[p.type]} 柱子`;
  });

  _register('structure', 'build_sphere', '生成球体(近似)', [
    { key: 'type', label: '方块', type: 'dropdown', options: BLOCK_TYPES.slice(0, 12), names: BLOCK_NAMES },
    { key: 'radius', label: '半径', type: 'slider', min: 1, max: 8, default: 3 },
  ], (p, player) => {
    const pos = player.location;
    const r = p.radius;
    const dim = player.dimension;
    let count = 0;
    for (let x = -r; x <= r; x++) {
      for (let y = -r; y <= r; y++) {
        for (let z = -r; z <= r; z++) {
          if (x * x + y * y + z * z <= r * r) {
            const bx = Math.floor(pos.x) + x;
            const by = Math.floor(pos.y) + y;
            const bz = Math.floor(pos.z) + z;
            dim.runCommand(`setblock ${bx} ${by} ${bz} ${p.type}`);
            count++;
          }
        }
      }
    }
    return `§a✓ 已生成半径 ${r} 的球体 (${count} 方块)`;
  });

  // ============ ✨ 特效类 ============

  _register('effect', 'explode', '爆炸', [
    { key: 'power', label: '威力', type: 'slider', min: 1, max: 20, default: 4 },
    { key: 'x', label: 'X 坐标', type: 'text', default: '~' },
    { key: 'y', label: 'Y 坐标', type: 'text', default: '~1' },
    { key: 'z', label: 'Z 坐标', type: 'text', default: '~' },
    { key: 'fire', label: '引燃', type: 'toggle', default: false },
  ], (p, player) => {
    const dim = player.dimension;
    const pos = player.location;
    const x = p.x === '~' ? pos.x : parseFloat(p.x);
    const y = p.y === '~' ? pos.y + 1 : parseFloat(p.y);
    const z = p.z === '~' ? pos.z : parseFloat(p.z);
    dim.createExplosion({ x, y, z }, p.power, { breaksBlocks: true, causesFire: p.fire });
    return `§a✓ 已在 (${p.x},${p.y},${p.z}) 引爆 (威力 ${p.power})`;
  });

  _register('effect', 'lightning', '闪电', [
    { key: 'x', label: 'X 坐标', type: 'text', default: '~' },
    { key: 'y', label: 'Y 坐标', type: 'text', default: '~' },
    { key: 'z', label: 'Z 坐标', type: 'text', default: '~' },
  ], (p, player) => {
    _run(player, `summon lightning_bolt ${p.x} ${p.y} ${p.z}`);
    return `§a✓ 已召唤闪电`;
  });

  _register('effect', 'play_sound', '播放声音', [
    { key: 'sound', label: '声音', type: 'dropdown', options: ['random.levelup', 'random.anvil_use', 'random.orb', 'random.click', 'note.harp', 'note.bass', 'mob.zombie.say', 'mob.enderdragon.growl', 'ambient.weather.thunder'], names: { 'random.levelup': '升级', 'random.anvil_use': '铁砧', 'random.orb': '经验球', 'random.click': '点击', 'note.harp': '竖琴', 'note.bass': '低音', 'mob.zombie.say': '僵尸', 'mob.enderdragon.growl': '末影龙', 'ambient.weather.thunder': '雷声' } },
  ], (p, player) => {
    _run(player, `playsound ${p.sound} @s`);
    return `§a✓ 已播放声音: ${p.sound}`;
  });

  _register('effect', 'title_text', '显示标题', [
    { key: 'title', label: '标题文字', type: 'text', default: 'Hello!' },
    { key: 'subtitle', label: '副标题', type: 'text', default: '' },
  ], (p, player) => {
    if (p.subtitle) _run(player, `title @s subtitle ${p.subtitle}`);
    _run(player, `title @s title ${p.title}`);
    return `§a✓ 已显示标题: ${p.title}`;
  });

  _register('effect', 'actionbar_text', '动作栏消息', [
    { key: 'text', label: '消息', type: 'text', default: 'Objector 编程中...' },
  ], (p, player) => {
    _run(player, `title @s actionbar ${p.text}`);
    return `§a✓ 动作栏: ${p.text}`;
  });

  _register('effect', 'say_message', '广播消息', [
    { key: 'msg', label: '消息', type: 'text', default: '来自 Objector 的消息！' },
  ], (p, player) => {
    world.sendMessage(`§b[Objector] §r${p.msg}`);
    return `§a✓ 已广播: ${p.msg}`;
  });

  // ============ 🔧 逻辑类 ============

  _register('logic', 'loop_command', '循环执行命令', [
    { key: 'command', label: 'MC 命令', type: 'text', default: 'say Hello' },
    { key: 'times', label: '次数', type: 'slider', min: 1, max: 100, default: 5 },
    { key: 'delay', label: '间隔(tick)', type: 'slider', min: 1, max: 100, default: 20 },
  ], (p, player) => {
    let count = 0;
    const id = system.runInterval(() => {
      if (count >= p.times) { system.clearRun(id); return; }
      try { _run(player, p.command); } catch (e) { system.clearRun(id); }
      count++;
    }, p.delay);
    return `§a✓ 将循环执行 ${p.times} 次 (间隔 ${p.delay} tick)`;
  });

  _register('logic', 'delayed_command', '延迟执行', [
    { key: 'command', label: 'MC 命令', type: 'text', default: 'say 3秒后执行！' },
    { key: 'delay', label: '延迟(秒)', type: 'slider', min: 1, max: 60, default: 3 },
  ], (p, player) => {
    system.runTimeout(() => {
      try { _run(player, p.command); } catch (e) {}
    }, p.delay * 20);
    return `§a✓ 将在 ${p.delay} 秒后执行`;
  });

  _register('logic', 'random_action', '随机执行', [
    { key: 'cmd1', label: '命令 A', type: 'text', default: 'give @s diamond 1' },
    { key: 'cmd2', label: '命令 B', type: 'text', default: 'give @s emerald 1' },
  ], (p, player) => {
    const choice = Math.random() < 0.5 ? p.cmd1 : p.cmd2;
    _run(player, choice);
    return `§a✓ 随机执行: ${choice}`;
  });

  _register('logic', 'if_nearby', '如果附近有实体', [
    { key: 'type', label: '实体类型', type: 'dropdown', options: [...ENTITY_TYPES.slice(0, 5), '*'], names: { ...Object.fromEntries(ENTITY_TYPES.slice(0, 5).map(t => [t, ENTITY_NAMES[t]])), '*': '任意' } },
    { key: 'radius', label: '检测范围', type: 'slider', min: 1, max: 30, default: 5 },
    { key: 'command', label: '执行命令', type: 'text', default: 'say 有生物在附近！' },
  ], (p, player) => {
    const selector = p.type === '*' ? `@e[r=${p.radius}]` : `@e[type=${p.type},r=${p.radius}]`;
    _run(player, `execute as @s if entity ${selector} run ${p.command}`);
    return `§a✓ 条件检测已执行`;
  });

  _register('logic', 'custom_command', '自定义命令', [
    { key: 'command', label: 'MC 命令 (不含/)', type: 'text', default: 'say 自定义命令' },
  ], (p, player) => {
    _run(player, p.command);
    return `§a✓ 已执行: ${p.command}`;
  });
}

// ========== 内部工具函数 ==========

function _register(category, id, name, params, executor) {
  _blocks.push({ category, id, name, params, executor });
}

function _run(player, command) {
  try {
    player.dimension.runCommand(command);
  } catch (e) {
    // 某些命令需要在世界级别执行
    try {
      world.getDimension('overworld').runCommand(command);
    } catch (e2) {
      throw new Error(`命令执行失败: ${command} - ${e2.message}`);
    }
  }
}

// ========== 导出 ==========

export function getCategories() { return CATEGORIES; }
export function getBlocksByCategory(catId) { return _blocks.filter(b => b.category === catId); }
export function executeBlock(blockId, params, player) {
  const block = _blocks.find(b => b.id === blockId);
  if (!block) return { success: false, message: '§c积木不存在: ' + blockId };
  try {
    const msg = block.executor(params, player);
    return { success: true, message: msg };
  } catch (e) {
    return { success: false, message: '§c执行失败: ' + e.message };
  }
}

export { BlockRegistry, BLOCK_TYPES, BLOCK_NAMES, ENTITY_TYPES, ENTITY_NAMES, ITEM_TYPES, ITEM_NAMES };
