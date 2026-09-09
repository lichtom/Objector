# Objector 编程模组 - 网易我的世界 ModSDK 版

在网易版 Minecraft 游戏内使用可视化积木编程操控世界！

## 📁 文件结构

```
ObjectorModBeh/
├── manifest.json              ← 行为包配置
├── entities/                  ← 必需目录（行为包识别用）
└── ObjectorScripts/           ← 模组脚本目录
    ├── __init__.py
    ├── modMain.py             ← 入口文件
    ├── ObjectorServerSystem.py ← 服务端系统（命令执行）
    ├── ObjectorClientSystem.py ← 客户端系统（UI 菜单）
    ├── block_commands.py      ← 36 个积木指令定义
    └── program_manager.py     ← 程序存储管理
```

## 🔧 开发环境搭建

### 1. 安装 Python 2.7
- 访问 https://www.python.org/downloads/
- 下载 Python 2.7.x 版本
- 安装时勾选 **"Add Python to PATH"**

### 2. 安装 MC Studio
- 访问 https://mc.163.com/dev/ 下载「我的世界开发者启动器」
- 安装并登录网易开发者账号

### 3. 导入项目
1. 打开 MC Studio
2. 创建一个新组件/附加包项目
3. 将 `ObjectorModBeh` 文件夹的内容复制到行为包目录
4. 确保 `entities/` 文件夹存在（即使为空）

## 🎮 使用方法

### 命令列表
| 命令 | 说明 |
|------|------|
| `/obj` | 打开编程主菜单 |
| `/obj help` | 查看帮助 |
| `/obj list` | 列出已保存程序 |
| `/obj run <名称>` | 运行程序 |
| `/obj delete <名称>` | 删除程序 |

### 游戏内菜单流程
```
/obj → 主菜单
  ├─ 🎯 执行积木 → 选择分类 → 选择积木 → 填写参数 → 执行！
  ├─ 📋 我的程序 → 选择程序 → 运行/编辑/删除
  ├─ 🔨 编写程序 → 添加积木 → 保存 → 随时运行
  └─ 📖 帮助
```

## 📦 积木分类（36 个指令）

| 分类 | 数量 | 示例 |
|------|------|------|
| 📦 方块 | 5 | 放置、填充、替换、清除、克隆 |
| 🐾 生物 | 3 | 生成、杀死、传送 |
| 👤 玩家 | 6 | 传送、给物品、游戏模式、效果、经验、回血 |
| 🌍 世界 | 5 | 时间、天气、难度、游戏规则、出生点 |
| 🏗️ 建筑 | 5 | 墙壁、地板、房屋、柱子、球体 |
| ✨ 特效 | 5 | 爆炸、闪电、声音、标题、广播 |
| 🔧 逻辑 | 4 | 循环、延迟、随机、自定义命令 |

## 📤 发布到网易资源中心

1. **注册开发者账号**
   - 访问 https://mc.163.com/dev/
   - 申请成为创造者

2. **测试模组**
   - 在 MC Studio 中加载测试
   - 确保所有积木正常工作
   - 检查日志是否有错误

3. **提交审核**
   - 在 MC Studio 中打包组件
   - 填写模组描述、截图、定价
   - 提交审核，等待通过

4. **发布**
   - 审核通过后自动上架资源中心
   - 玩家可在游戏内直接下载

## ⚠️ 注意事项

1. **Python 2.7 语法** - 所有代码必须使用 Python 2 语法
2. **客户端/服务端分离** - 不能在 ServerSystem 中导入 ClientApi
3. **entities 目录** - 必须存在，否则行为包不被识别
4. **热更新** - MC Studio 支持修改代码后自动热重载
5. **调试** - 使用 `print` 输出日志到「脚本测试日志」窗口

## 🔧 添加新积木

在 `block_commands.py` 的 `BLOCK_DEFINITIONS` 列表中添加：

```python
{
    'category': 'block',
    'id': 'my_new_block',
    'name': u'我的新积木',
    'params': [
        {'key': 'param1', 'label': u'参数1', 'type': 'dropdown', 'options': ['a', 'b']},
        {'key': 'param2', 'label': u'参数2', 'type': 'slider', 'min': 1, 'max': 10},
    ],
},
```

然后在 `execute_block_command` 函数中添加执行逻辑：

```python
elif blockId == 'my_new_block':
    cmd = 'some_command %s %s' % (p['param1'], p['param2'])
    _run_command(cmd, playerId)
    return _ok(u'§a✓ 执行成功')
```

## 📜 许可

MIT - 可自由使用和修改
