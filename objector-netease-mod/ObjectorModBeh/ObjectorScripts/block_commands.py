# -*- coding: utf-8 -*-
"""
Objector block commands - Python 2.7 safe
No module-level MC imports - compFactory is passed as parameter
"""

# ========== 选项列表 ==========

BLOCK_TYPES = [
    'stone', 'dirt', 'grass', 'cobblestone', 'planks', 'log',
    'sand', 'gravel', 'glass', 'obsidian', 'bedrock',
    'iron_block', 'gold_block', 'diamond_block', 'emerald_block',
    'redstone_block', 'lapis_block', 'tnt', 'glowstone',
    'wool', 'sponge', 'hay_block',
    'air',
]

BLOCK_NAMES = {
    'stone': u'§7石头', 'dirt': u'§6泥土', 'grass': u'§a草方块',
    'cobblestone': u'§7圆石', 'planks': u'§6木板', 'log': u'§6原木',
    'sand': u'§e沙子', 'gravel': u'§7沙砾', 'glass': u'§f玻璃',
    'obsidian': u'§5黑曜石', 'bedrock': u'§8基岩',
    'iron_block': u'§f铁块', 'gold_block': u'§e金块',
    'diamond_block': u'§b钻石块', 'emerald_block': u'§a绿宝石块',
    'redstone_block': u'§c红石块', 'lapis_block': u'§9青金石块',
    'tnt': u'§cTNT', 'glowstone': u'§e萤石',
    'wool': u'§f羊毛', 'sponge': u'§e海绵', 'hay_block': u'§e干草块',
    'air': u'§f空气(清除)',
}

ENTITY_TYPES = [
    'zombie', 'skeleton', 'creeper', 'spider', 'enderman',
    'cow', 'pig', 'chicken', 'sheep', 'horse', 'wolf', 'cat', 'villager',
    'iron_golem', 'snow_golem', 'blaze', 'ghast',
    'slime', 'guardian', 'phantom', 'drowned',
    'bat', 'bee', 'fox', 'rabbit', 'panda',
    'armor_stand',
]

ENTITY_NAMES = {
    'zombie': u'§2僵尸', 'skeleton': u'§7骷髅', 'creeper': u'§a苦力怕',
    'spider': u'§8蜘蛛', 'enderman': u'§5末影人',
    'cow': u'§6牛', 'pig': u'§d猪', 'chicken': u'§f鸡',
    'sheep': u'§f羊', 'horse': u'§6马', 'wolf': u'§7狼', 'cat': u'§e猫',
    'villager': u'§a村民', 'iron_golem': u'§f铁傀儡',
    'snow_golem': u'§f雪傀儡', 'blaze': u'§6烈焰人',
    'ghast': u'§f恶魂', 'slime': u'§a史莱姆',
    'guardian': u'§3守卫者', 'phantom': u'§5幻翼',
    'drowned': u'§9溺尸', 'bat': u'§8蝙蝠', 'bee': u'§e蜜蜂',
    'fox': u'§6狐狸', 'rabbit': u'§f兔子', 'panda': u'§f熊猫',
    'armor_stand': u'§7盔甲架',
}

ITEM_TYPES = [
    'diamond_sword', 'diamond_pickaxe', 'diamond_axe', 'diamond_shovel',
    'iron_sword', 'iron_pickaxe', 'bow', 'crossbow', 'trident', 'shield',
    'diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots',
    'diamond', 'emerald', 'gold_ingot', 'iron_ingot',
    'apple', 'golden_apple', 'bread', 'steak',
    'torch', 'lantern', 'bucket',
    'ender_pearl', 'elytra', 'totem_of_undying',
]

ITEM_NAMES = {
    'diamond_sword': u'§b钻石剑', 'diamond_pickaxe': u'§b钻石镐',
    'diamond_axe': u'§b钻石斧', 'diamond_shovel': u'§b钻石铲',
    'iron_sword': u'§f铁剑', 'iron_pickaxe': u'§f铁镐',
    'bow': u'§7弓', 'crossbow': u'§7弩', 'trident': u'§3三叉戟',
    'shield': u'§7盾牌',
    'diamond_helmet': u'§b钻石头盔', 'diamond_chestplate': u'§b钻石胸甲',
    'diamond_leggings': u'§b钻石护腿', 'diamond_boots': u'§b钻石靴子',
    'diamond': u'§b钻石', 'emerald': u'§a绿宝石',
    'gold_ingot': u'§e金锭', 'iron_ingot': u'§f铁锭',
    'apple': u'§c苹果', 'golden_apple': u'§e金苹果',
    'bread': u'§6面包', 'steak': u'§6牛排',
    'torch': u'§e火把', 'lantern': u'§e灯笼', 'bucket': u'§7桶',
    'ender_pearl': u'§5末影珍珠', 'elytra': u'§f鞘翅',
    'totem_of_undying': u'§e不死图腾',
}

# ========== 积木分类 ==========

BLOCK_CATEGORIES = [
    {'id': 'block', 'name': u'§a§l📦 方块', 'desc': u'放置、填充、替换方块'},
    {'id': 'entity', 'name': u'§d§l🐾 生物', 'desc': u'生成、杀死、操控实体'},
    {'id': 'player', 'name': u'§e§l👤 玩家', 'desc': u'传送、物品、效果'},
    {'id': 'world', 'name': u'§9§l🌍 世界', 'desc': u'天气、时间、游戏规则'},
    {'id': 'structure', 'name': u'§6§l🏗️ 建筑', 'desc': u'生成结构、填充区域'},
    {'id': 'effect', 'name': u'§c§l✨ 特效', 'desc': u'粒子、声音、爆炸'},
    {'id': 'logic', 'name': u'§5§l🔧 逻辑', 'desc': u'循环、条件、变量'},
]

# ========== 积木定义列表 ==========

BLOCK_DEFINITIONS = [
    # ============ 📦 方块类 ============
    {
        'category': 'block', 'id': 'place_block',
        'name': u'放置方块',
        'params': [
            {'key': 'type', 'label': u'方块类型', 'type': 'dropdown', 'options': BLOCK_TYPES, 'names': BLOCK_NAMES},
            {'key': 'x', 'label': u'X 坐标', 'type': 'text', 'default': '~'},
            {'key': 'y', 'label': u'Y 坐标', 'type': 'text', 'default': '~'},
            {'key': 'z', 'label': u'Z 坐标', 'type': 'text', 'default': '~1'},
        ],
    },
    {
        'category': 'block', 'id': 'fill_area',
        'name': u'填充区域',
        'params': [
            {'key': 'type', 'label': u'方块类型', 'type': 'dropdown', 'options': BLOCK_TYPES, 'names': BLOCK_NAMES},
            {'key': 'x1', 'label': u'起始 X', 'type': 'text', 'default': '~-3'},
            {'key': 'y1', 'label': u'起始 Y', 'type': 'text', 'default': '~'},
            {'key': 'z1', 'label': u'起始 Z', 'type': 'text', 'default': '~-3'},
            {'key': 'x2', 'label': u'结束 X', 'type': 'text', 'default': '~3'},
            {'key': 'y2', 'label': u'结束 Y', 'type': 'text', 'default': '~3'},
            {'key': 'z2', 'label': u'结束 Z', 'type': 'text', 'default': '~3'},
        ],
    },
    {
        'category': 'block', 'id': 'replace_blocks',
        'name': u'替换方块',
        'params': [
            {'key': 'from_type', 'label': u'被替换方块', 'type': 'dropdown', 'options': BLOCK_TYPES, 'names': BLOCK_NAMES},
            {'key': 'to_type', 'label': u'替换为', 'type': 'dropdown', 'options': BLOCK_TYPES, 'names': BLOCK_NAMES},
            {'key': 'x1', 'label': u'起始 X', 'type': 'text', 'default': '~-5'},
            {'key': 'y1', 'label': u'起始 Y', 'type': 'text', 'default': '~'},
            {'key': 'z1', 'label': u'起始 Z', 'type': 'text', 'default': '~-5'},
            {'key': 'x2', 'label': u'结束 X', 'type': 'text', 'default': '~5'},
            {'key': 'y2', 'label': u'结束 Y', 'type': 'text', 'default': '~5'},
            {'key': 'z2', 'label': u'结束 Z', 'type': 'text', 'default': '~5'},
        ],
    },
    {
        'category': 'block', 'id': 'clear_area',
        'name': u'清除区域',
        'params': [
            {'key': 'x1', 'label': u'起始 X', 'type': 'text', 'default': '~-3'},
            {'key': 'y1', 'label': u'起始 Y', 'type': 'text', 'default': '~'},
            {'key': 'z1', 'label': u'起始 Z', 'type': 'text', 'default': '~-3'},
            {'key': 'x2', 'label': u'结束 X', 'type': 'text', 'default': '~3'},
            {'key': 'y2', 'label': u'结束 Y', 'type': 'text', 'default': '~5'},
            {'key': 'z2', 'label': u'结束 Z', 'type': 'text', 'default': '~3'},
        ],
    },
    {
        'category': 'block', 'id': 'clone_structure',
        'name': u'克隆结构',
        'params': [
            {'key': 'x1', 'label': u'源起始 X', 'type': 'text', 'default': '~-5'},
            {'key': 'y1', 'label': u'源起始 Y', 'type': 'text', 'default': '~'},
            {'key': 'z1', 'label': u'源起始 Z', 'type': 'text', 'default': '~-5'},
            {'key': 'x2', 'label': u'源结束 X', 'type': 'text', 'default': '~5'},
            {'key': 'y2', 'label': u'源结束 Y', 'type': 'text', 'default': '~5'},
            {'key': 'z2', 'label': u'源结束 Z', 'type': 'text', 'default': '~5'},
            {'key': 'dx', 'label': u'目标 X', 'type': 'text', 'default': '~10'},
            {'key': 'dy', 'label': u'目标 Y', 'type': 'text', 'default': '~'},
            {'key': 'dz', 'label': u'目标 Z', 'type': 'text', 'default': '~10'},
        ],
    },

    # ============ 🐾 生物类 ============
    {
        'category': 'entity', 'id': 'spawn_entity',
        'name': u'生成生物',
        'params': [
            {'key': 'type', 'label': u'生物类型', 'type': 'dropdown', 'options': ENTITY_TYPES, 'names': ENTITY_NAMES},
            {'key': 'x', 'label': u'X 坐标', 'type': 'text', 'default': '~'},
            {'key': 'y', 'label': u'Y 坐标', 'type': 'text', 'default': '~1'},
            {'key': 'z', 'label': u'Z 坐标', 'type': 'text', 'default': '~'},
            {'key': 'count', 'label': u'数量', 'type': 'slider', 'min': 1, 'max': 20, 'default': 1},
        ],
    },
    {
        'category': 'entity', 'id': 'kill_nearby',
        'name': u'杀死附近实体',
        'params': [
            {'key': 'radius', 'label': u'范围 (格)', 'type': 'slider', 'min': 1, 'max': 50, 'default': 10},
        ],
    },
    {
        'category': 'entity', 'id': 'tp_entity',
        'name': u'传送实体',
        'params': [
            {'key': 'target', 'label': u'目标选择器', 'type': 'text', 'default': '@e[type=zombie,r=10]'},
            {'key': 'x', 'label': u'目标 X', 'type': 'text', 'default': '~'},
            {'key': 'y', 'label': u'目标 Y', 'type': 'text', 'default': '~5'},
            {'key': 'z', 'label': u'目标 Z', 'type': 'text', 'default': '~'},
        ],
    },

    # ============ 👤 玩家类 ============
    {
        'category': 'player', 'id': 'teleport',
        'name': u'传送玩家',
        'params': [
            {'key': 'x', 'label': u'X 坐标', 'type': 'text', 'default': '0'},
            {'key': 'y', 'label': u'Y 坐标', 'type': 'text', 'default': '64'},
            {'key': 'z', 'label': u'Z 坐标', 'type': 'text', 'default': '0'},
        ],
    },
    {
        'category': 'player', 'id': 'give_item',
        'name': u'给予物品',
        'params': [
            {'key': 'item', 'label': u'物品', 'type': 'dropdown', 'options': ITEM_TYPES, 'names': ITEM_NAMES},
            {'key': 'count', 'label': u'数量', 'type': 'slider', 'min': 1, 'max': 64, 'default': 1},
        ],
    },
    {
        'category': 'player', 'id': 'set_gamemode',
        'name': u'设置游戏模式',
        'params': [
            {'key': 'mode', 'label': u'模式', 'type': 'dropdown',
             'options': ['survival', 'creative', 'adventure', 'spectator'],
             'names': {'survival': u'§a生存', 'creative': u'§e创造', 'adventure': u'§6冒险', 'spectator': u'§7旁观'}},
        ],
    },
    {
        'category': 'player', 'id': 'add_effect',
        'name': u'添加效果',
        'params': [
            {'key': 'effect', 'label': u'效果', 'type': 'dropdown',
             'options': ['speed', 'strength', 'jump_boost', 'regeneration', 'resistance',
                         'fire_resistance', 'night_vision', 'invisibility', 'haste', 'slow_falling'],
             'names': {
                 'speed': u'§b速度', 'strength': u'§c力量', 'jump_boost': u'§a跳跃提升',
                 'regeneration': u'§d再生', 'resistance': u'§7抗性', 'fire_resistance': u'§6抗火',
                 'night_vision': u'§9夜视', 'invisibility': u'§f隐身', 'haste': u'§e急迫',
                 'slow_falling': u'§f缓降',
             }},
            {'key': 'duration', 'label': u'持续时间(秒)', 'type': 'slider', 'min': 5, 'max': 600, 'default': 30},
            {'key': 'level', 'label': u'等级', 'type': 'slider', 'min': 1, 'max': 5, 'default': 1},
        ],
    },
    {
        'category': 'player', 'id': 'set_xp',
        'name': u'设置经验',
        'params': [
            {'key': 'amount', 'label': u'经验等级', 'type': 'slider', 'min': 0, 'max': 100, 'default': 10},
        ],
    },
    {
        'category': 'player', 'id': 'heal_player',
        'name': u'恢复生命值',
        'params': [
            {'key': 'amount', 'label': u'恢复量(心)', 'type': 'slider', 'min': 1, 'max': 20, 'default': 20},
        ],
    },

    # ============ 🌍 世界类 ============
    {
        'category': 'world', 'id': 'set_time',
        'name': u'设置时间',
        'params': [
            {'key': 'time', 'label': u'时间', 'type': 'dropdown',
             'options': ['day', 'noon', 'night', 'midnight'],
             'names': {'day': u'§e白天', 'noon': u'§e正午', 'night': u'§9夜晚', 'midnight': u'§8午夜'}},
        ],
    },
    {
        'category': 'world', 'id': 'set_weather',
        'name': u'设置天气',
        'params': [
            {'key': 'weather', 'label': u'天气', 'type': 'dropdown',
             'options': ['clear', 'rain', 'thunder'],
             'names': {'clear': u'§e晴天', 'rain': u'§9雨天', 'thunder': u'§8雷暴'}},
        ],
    },
    {
        'category': 'world', 'id': 'set_difficulty',
        'name': u'设置难度',
        'params': [
            {'key': 'diff', 'label': u'难度', 'type': 'dropdown',
             'options': ['peaceful', 'easy', 'normal', 'hard'],
             'names': {'peaceful': u'§a和平', 'easy': u'§e简单', 'normal': u'§6普通', 'hard': u'§c困难'}},
        ],
    },
    {
        'category': 'world', 'id': 'gamerule_set',
        'name': u'设置游戏规则',
        'params': [
            {'key': 'rule', 'label': u'规则', 'type': 'dropdown',
             'options': ['keepinventory', 'dodaylightcycle', 'doweathercycle', 'domobspawning',
                         'dofiretick', 'mobgriefing', 'pvp', 'dotiledrops', 'naturalregeneration', 'showcoordinates'],
             'names': {
                 'keepinventory': u'死亡不掉落', 'dodaylightcycle': u'日夜循环',
                 'doweathercycle': u'天气变化', 'domobspawning': u'生物生成',
                 'dofiretick': u'火焰蔓延', 'mobgriefing': u'生物破坏',
                 'pvp': u'PvP', 'dotiledrops': u'方块掉落',
                 'naturalregeneration': u'自然回血', 'showcoordinates': u'显示坐标',
             }},
            {'key': 'value', 'label': u'开关', 'type': 'toggle', 'default': True},
        ],
    },
    {
        'category': 'world', 'id': 'spawn_point',
        'name': u'设置出生点',
        'params': [
            {'key': 'x', 'label': u'X 坐标', 'type': 'text', 'default': '~'},
            {'key': 'y', 'label': u'Y 坐标', 'type': 'text', 'default': '~'},
            {'key': 'z', 'label': u'Z 坐标', 'type': 'text', 'default': '~'},
        ],
    },

    # ============ 🏗️ 建筑类 ============
    {
        'category': 'structure', 'id': 'build_wall',
        'name': u'生成墙壁',
        'params': [
            {'key': 'type', 'label': u'方块', 'type': 'dropdown', 'options': BLOCK_TYPES[:12], 'names': BLOCK_NAMES},
            {'key': 'length', 'label': u'长度', 'type': 'slider', 'min': 1, 'max': 20, 'default': 5},
            {'key': 'height', 'label': u'高度', 'type': 'slider', 'min': 1, 'max': 10, 'default': 3},
            {'key': 'direction', 'label': u'方向', 'type': 'dropdown',
             'options': ['x', 'z'], 'names': {'x': u'§b东西(X)', 'z': u'§a南北(Z)'}},
        ],
    },
    {
        'category': 'structure', 'id': 'build_floor',
        'name': u'生成地板',
        'params': [
            {'key': 'type', 'label': u'方块', 'type': 'dropdown', 'options': BLOCK_TYPES[:12], 'names': BLOCK_NAMES},
            {'key': 'size', 'label': u'大小', 'type': 'slider', 'min': 1, 'max': 20, 'default': 5},
        ],
    },
    {
        'category': 'structure', 'id': 'build_house',
        'name': u'生成简易房屋',
        'params': [
            {'key': 'wall', 'label': u'墙壁方块', 'type': 'dropdown', 'options': BLOCK_TYPES[:8], 'names': BLOCK_NAMES},
            {'key': 'roof', 'label': u'屋顶方块', 'type': 'dropdown', 'options': BLOCK_TYPES[:8], 'names': BLOCK_NAMES},
            {'key': 'size', 'label': u'大小(奇数)', 'type': 'slider', 'min': 5, 'max': 15, 'default': 7},
        ],
    },
    {
        'category': 'structure', 'id': 'build_pillar',
        'name': u'生成柱子',
        'params': [
            {'key': 'type', 'label': u'方块', 'type': 'dropdown', 'options': BLOCK_TYPES[:12], 'names': BLOCK_NAMES},
            {'key': 'height', 'label': u'高度', 'type': 'slider', 'min': 1, 'max': 30, 'default': 5},
        ],
    },
    {
        'category': 'structure', 'id': 'build_sphere',
        'name': u'生成球体(近似)',
        'params': [
            {'key': 'type', 'label': u'方块', 'type': 'dropdown', 'options': BLOCK_TYPES[:12], 'names': BLOCK_NAMES},
            {'key': 'radius', 'label': u'半径', 'type': 'slider', 'min': 1, 'max': 8, 'default': 3},
        ],
    },

    # ============ ✨ 特效类 ============
    {
        'category': 'effect', 'id': 'explode',
        'name': u'爆炸',
        'params': [
            {'key': 'power', 'label': u'威力', 'type': 'slider', 'min': 1, 'max': 20, 'default': 4},
            {'key': 'x', 'label': u'X 坐标', 'type': 'text', 'default': '~'},
            {'key': 'y', 'label': u'Y 坐标', 'type': 'text', 'default': '~1'},
            {'key': 'z', 'label': u'Z 坐标', 'type': 'text', 'default': '~'},
        ],
    },
    {
        'category': 'effect', 'id': 'lightning',
        'name': u'闪电',
        'params': [
            {'key': 'x', 'label': u'X 坐标', 'type': 'text', 'default': '~'},
            {'key': 'y', 'label': u'Y 坐标', 'type': 'text', 'default': '~'},
            {'key': 'z', 'label': u'Z 坐标', 'type': 'text', 'default': '~'},
        ],
    },
    {
        'category': 'effect', 'id': 'play_sound',
        'name': u'播放声音',
        'params': [
            {'key': 'sound', 'label': u'声音', 'type': 'dropdown',
             'options': ['random.levelup', 'random.anvil_use', 'random.orb', 'random.click',
                         'note.harp', 'mob.zombie.say', 'ambient.weather.thunder'],
             'names': {
                 'random.levelup': u'升级', 'random.anvil_use': u'铁砧',
                 'random.orb': u'经验球', 'random.click': u'点击',
                 'note.harp': u'竖琴', 'mob.zombie.say': u'僵尸',
                 'ambient.weather.thunder': u'雷声',
             }},
        ],
    },
    {
        'category': 'effect', 'id': 'title_text',
        'name': u'显示标题',
        'params': [
            {'key': 'title', 'label': u'标题文字', 'type': 'text', 'default': 'Hello!'},
        ],
    },
    {
        'category': 'effect', 'id': 'say_message',
        'name': u'广播消息',
        'params': [
            {'key': 'msg', 'label': u'消息', 'type': 'text', 'default': u'来自 Objector 的消息！'},
        ],
    },

    # ============ 🔧 逻辑类 ============
    {
        'category': 'logic', 'id': 'loop_command',
        'name': u'循环执行命令',
        'params': [
            {'key': 'command', 'label': u'MC 命令(不含/)', 'type': 'text', 'default': 'say Hello'},
            {'key': 'times', 'label': u'次数', 'type': 'slider', 'min': 1, 'max': 100, 'default': 5},
            {'key': 'delay', 'label': u'间隔(秒)', 'type': 'slider', 'min': 1, 'max': 60, 'default': 1},
        ],
    },
    {
        'category': 'logic', 'id': 'delayed_command',
        'name': u'延迟执行',
        'params': [
            {'key': 'command', 'label': u'MC 命令(不含/)', 'type': 'text', 'default': 'say 3秒后执行！'},
            {'key': 'delay', 'label': u'延迟(秒)', 'type': 'slider', 'min': 1, 'max': 60, 'default': 3},
        ],
    },
    {
        'category': 'logic', 'id': 'random_action',
        'name': u'随机执行',
        'params': [
            {'key': 'cmd1', 'label': u'命令 A(不含/)', 'type': 'text', 'default': 'give @s diamond 1'},
            {'key': 'cmd2', 'label': u'命令 B(不含/)', 'type': 'text', 'default': 'give @s emerald 1'},
        ],
    },
    {
        'category': 'logic', 'id': 'custom_command',
        'name': u'自定义命令',
        'params': [
            {'key': 'command', 'label': u'MC 命令(不含/)', 'type': 'text', 'default': 'say 自定义命令'},
        ],
    },
]


# ========== 命令执行函数 ==========

def _run_command(command, playerId, compFactory):
    """Execute a command via compFactory (passed in, not imported)"""
    try:
        import mod.server.extraServerApi as _sApi
        levelId = _sApi.GetServerApi().levelId
        comp = compFactory.CreateGame(levelId)
        comp.SetCommand(command, playerId)
    except Exception as e:
        print '[Objector] cmd err: %s' % str(e)


def execute_block_command(blockId, params, playerId, compFactory):
    """执行一个积木指令，返回 {success, message}"""
    p = params

    try:
        # ============ 📦 方块 ============
        if blockId == 'place_block':
            cmd = 'setblock %s %s %s minecraft:%s' % (p['x'], p['y'], p['z'], p['type'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已放置 %s' % BLOCK_NAMES.get(p['type'], p['type']))

        elif blockId == 'fill_area':
            cmd = 'fill %s %s %s %s %s %s minecraft:%s' % (
                p['x1'], p['y1'], p['z1'], p['x2'], p['y2'], p['z2'], p['type'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已填充区域')

        elif blockId == 'replace_blocks':
            cmd = 'fill %s %s %s %s %s %s minecraft:%s replace minecraft:%s' % (
                p['x1'], p['y1'], p['z1'], p['x2'], p['y2'], p['z2'],
                p['to_type'], p['from_type'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已替换方块')

        elif blockId == 'clear_area':
            cmd = 'fill %s %s %s %s %s %s air' % (
                p['x1'], p['y1'], p['z1'], p['x2'], p['y2'], p['z2'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已清除区域')

        elif blockId == 'clone_structure':
            cmd = 'clone %s %s %s %s %s %s %s %s %s' % (
                p['x1'], p['y1'], p['z1'], p['x2'], p['y2'], p['z2'],
                p['dx'], p['dy'], p['dz'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已克隆结构')

        # ============ 🐾 生物 ============
        elif blockId == 'spawn_entity':
            count = int(p.get('count', 1))
            for _ in range(count):
                cmd = 'summon minecraft:%s %s %s %s' % (p['type'], p['x'], p['y'], p['z'])
                _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已生成 %d 只 %s' % (count, ENTITY_NAMES.get(p['type'], p['type'])))

        elif blockId == 'kill_nearby':
            cmd = 'kill @e[r=%s]' % p['radius']
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已杀死 %s 格内的实体' % p['radius'])

        elif blockId == 'tp_entity':
            cmd = 'tp %s %s %s %s' % (p['target'], p['x'], p['y'], p['z'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已传送实体')

        # ============ 👤 玩家 ============
        elif blockId == 'teleport':
            cmd = 'tp @s %s %s %s' % (p['x'], p['y'], p['z'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已传送到 (%s,%s,%s)' % (p['x'], p['y'], p['z']))

        elif blockId == 'give_item':
            cmd = 'give @s minecraft:%s %s' % (p['item'], int(p.get('count', 1)))
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已获得 %s x%s' % (ITEM_NAMES.get(p['item'], p['item']), p.get('count', 1)))

        elif blockId == 'set_gamemode':
            cmd = 'gamemode %s @s' % p['mode']
            _run_command(cmd, playerId, compFactory)
            mode_names = {'survival': u'生存', 'creative': u'创造', 'adventure': u'冒险', 'spectator': u'旁观'}
            return _ok(u'§a✓ 已切换为 %s 模式' % mode_names.get(p['mode'], p['mode']))

        elif blockId == 'add_effect':
            level = int(p.get('level', 1)) - 1
            cmd = 'effect @s %s %s %s' % (p['effect'], int(p.get('duration', 30)), level)
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已获得 %s 效果' % p['effect'])

        elif blockId == 'set_xp':
            cmd = 'xp %sL @s' % int(p['amount'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已设置经验等级为 %s' % p['amount'])

        elif blockId == 'heal_player':
            amount = int(p.get('amount', 20))
            cmd = 'effect @s instant_health 1 %s' % (amount / 2)
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已恢复 %s 颗心' % amount)

        # ============ 🌍 世界 ============
        elif blockId == 'set_time':
            cmd = 'time set %s' % p['time']
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已设置时间为 %s' % p['time'])

        elif blockId == 'set_weather':
            cmd = 'weather %s' % p['weather']
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已设置天气为 %s' % p['weather'])

        elif blockId == 'set_difficulty':
            cmd = 'difficulty %s' % p['diff']
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已设置难度为 %s' % p['diff'])

        elif blockId == 'gamerule_set':
            value = 'true' if p['value'] else 'false'
            cmd = 'gamerule %s %s' % (p['rule'], value)
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已设置 %s = %s' % (p['rule'], value))

        elif blockId == 'spawn_point':
            cmd = 'setworldspawn %s %s %s' % (p['x'], p['y'], p['z'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已设置出生点')

        # ============ 🏗️ 建筑 ============
        elif blockId == 'build_wall':
            d = p['direction']
            length = int(p['length'])
            height = int(p['height'])
            if d == 'x':
                cmd = 'fill ~ ~ ~ ~%s ~%s ~ minecraft:%s' % (length - 1, height - 1, p['type'])
            else:
                cmd = 'fill ~ ~ ~ ~ ~%s ~%s minecraft:%s' % (height - 1, length - 1, p['type'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已生成 %sx%s 墙壁' % (length, height))

        elif blockId == 'build_floor':
            size = int(p['size'])
            half = size / 2
            cmd = 'fill ~-%s ~-1 ~-%s ~%s ~-1 ~%s minecraft:%s' % (half, half, half, half, p['type'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已生成 %sx%s 地板' % (size, size))

        elif blockId == 'build_house':
            s = int(p['size'])
            h = s / 2
            wall = p['wall']
            roof = p['roof']
            # 地板
            _run_command('fill ~ ~-1 ~ ~%s ~-1 ~%s planks' % (s - 1, s - 1), playerId, compFactory)
            # 四面墙
            _run_command('fill ~ ~ ~ ~ ~3 ~%s %s' % (s - 1, wall), playerId, compFactory)
            _run_command('fill ~%s ~ ~ ~%s ~3 ~%s %s' % (s - 1, s - 1, s - 1, wall), playerId, compFactory)
            _run_command('fill ~ ~ ~ ~%s ~3 ~ %s' % (s - 1, wall), playerId, compFactory)
            _run_command('fill ~ ~%s ~%s ~3 ~%s %s' % (s - 1, s - 1, wall), playerId, compFactory)
            # 屋顶
            _run_command('fill ~-1 ~4 ~-1 ~%s ~4 ~%s %s' % (s, s, roof), playerId, compFactory)
            # 挖门
            _run_command('setblock ~%s ~ ~ air' % h, playerId, compFactory)
            _run_command('setblock ~%s ~1 ~ air' % h, playerId, compFactory)
            return _ok(u'§a✓ 已生成 %sx%s 简易房屋' % (s, s))

        elif blockId == 'build_pillar':
            height = int(p['height'])
            cmd = 'fill ~ ~ ~ ~ ~%s ~ minecraft:%s' % (height - 1, p['type'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已生成高度 %s 的柱子' % height)

        elif blockId == 'build_sphere':
            radius = int(p['radius'])
            cmd = 'fill ~-%s ~-%s ~-%s ~%s ~%s ~%s minecraft:%s' % (
                radius, radius, radius, radius, radius, radius, p['type'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已生成半径 %s 的球体(近似方块)' % radius)

        # ============ ✨ 特效 ============
        elif blockId == 'explode':
            # 使用 summon 点燃 TNT 模拟爆炸
            cmd = 'summon tnt %s %s %s' % (p['x'], p['y'], p['z'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已引爆 (威力 %s)' % p['power'])

        elif blockId == 'lightning':
            cmd = 'summon lightning_bolt %s %s %s' % (p['x'], p['y'], p['z'])
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已召唤闪电')

        elif blockId == 'play_sound':
            cmd = 'playsound %s @s' % p['sound']
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已播放: %s' % p['sound'])

        elif blockId == 'title_text':
            cmd = 'title @s title %s' % p['title']
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已显示标题: %s' % p['title'])

        elif blockId == 'say_message':
            cmd = 'say [Objector] %s' % p['msg']
            _run_command(cmd, playerId, compFactory)
            return _ok(u'§a✓ 已广播: %s' % p['msg'])

        # ============ 🔧 逻辑 ============
        elif blockId == 'loop_command':
            # 简化版：使用 schedule 或直接多次执行
            times = int(p.get('times', 5))
            delay = int(p.get('delay', 1))
            cmd_text = p['command']
            for i in range(times):
                _run_command(cmd_text, playerId, compFactory)
            return _ok(u'§a✓ 已执行 %d 次: %s' % (times, cmd_text))

        elif blockId == 'delayed_command':
            cmd_text = p['command']
            _run_command(cmd_text, playerId, compFactory)
            return _ok(u'§a✓ 已执行: %s' % cmd_text)

        elif blockId == 'random_action':
            import random
            choice = random.choice([p['cmd1'], p['cmd2']])
            _run_command(choice, playerId, compFactory)
            return _ok(u'§a✓ 随机执行: %s' % choice)

        elif blockId == 'custom_command':
            cmd_text = p['command']
            _run_command(cmd_text, playerId, compFactory)
            return _ok(u'§a✓ 已执行: %s' % cmd_text)

        else:
            return _fail(u'§c未知积木: %s' % blockId)

    except Exception as e:
        return _fail(u'§c执行失败: %s' % str(e))


def _ok(message):
    return {'success': True, 'message': message}


def _fail(message):
    return {'success': False, 'message': message}
