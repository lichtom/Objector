# Objector

> 图形化积木编程编辑器 — 用积木搭建无限创意

[![Version](https://img.shields.io/badge/version-1.0.25.beta-blue)](https://github.com/tomlct2015/Objector/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey)](https://github.com/tomlct2015/Objector/releases)

**Objector** 是一款基于 [Electron](https://www.electronjs.org/) 的图形化积木编程编辑器，让零基础用户也能创作动画、游戏和交互式程序。不仅仅是 Scratch 的复刻，更是面向专业开发者的全面进化。

[🌐 在线体验网页版](https://tomlct2015.github.io/Objector-Coder/editor/) · [📖 积木使用指南](https://tomlct2015.github.io/Objector-Coder/blocks-guide/) · [📥 下载最新版本](https://github.com/tomlct2015/Objector/releases/latest)

---

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🧩 **可视化积木编程** | 拖拽式操作，支持流程连接、参数嵌入、C 型子代码块 |
| 🤖 **AI 智能助手** | 内置 AI 对话窗口，支持 OpenAI / DeepSeek / 通义千问等模型，自然语言生成积木 |
| ⚙️ **设置面板 + 6 种主题** | 默认 / 深色 / 浅色 / Solarized / Nord / Dracula，支持自定义 CSS |
| 👥 **协作管理** | 推送进度、分支管理、查看人员、分享链接（基于 Supabase） |
| ⌨️ **命令行窗口** | 独立终端，支持 `sprite` / `run` / `save` 等命令 |
| 🐛 **专业调试系统** | 断点设置、单步执行、变量监视面板 |
| 🎨 **12 大积木模块** | 事件、运动、外观、控制、运算、变量、函数、面向对象、列表、声音、3D、传感 |
| 📦 **多格式导出** | HTML 独立运行文件、项目 ZIP 包 |
| 🔍 **积木搜索 + 多选** | Ctrl+F 搜索积木，Shift+点击多选批量操作 |
| 📖 **交互式教程** | 内置入门教程，高亮引导 UI 元素 |
| 🌐 **PWA 支持** | 可作为 PWA 安装运行于 Android |
| ⛏️ **Minecraft 模组开发** | 支持基岩版、网易版、Java 版模组代码生成 |
| 💻 **代码编程模式** | Python / C++ / JavaScript 代码编辑器 |
| 📊 **数据分析模式** | 类 Python 数据分析环境，支持图表和数据处理 |

## 🎯 创作模式

| 模式 | 说明 |
|------|------|
| 🎮 普通创作 | 经典积木编程，支持 2D / 3D 渲染 |
| 🎬 高级创作 | Godot 式专业编辑器，积木与代码双模式 |
| 🧩 扩展创作 | 创建自定义扩展积木 |
| 📊 数据分析 | Python 式数据分析环境 |
| ⛏️ MC 模组开发 | Minecraft 模组代码生成 |
| 💻 代码编程 | Python / C++ / JavaScript 编程 |

## 📥 下载

### Windows (x64)
- **[安装包 (.exe)](https://github.com/tomlct2015/Objector/releases/download/v1.0.25.beta/Objector-Setup-1.0.25.beta.exe)** — NSIS 安装程序，支持自定义安装路径
- **[便携版 (.zip)](https://github.com/tomlct2015/Objector/releases/download/v1.0.25.beta/Objector-1.0.25.beta-win.zip)** — 解压即用

### Linux (x64)
- **[压缩包 (.tar.gz)](https://github.com/tomlct2015/Objector/releases/download/v1.0.25.beta/objector-1.0.25.beta.tar.gz)** — 需要 libgtk-3 和 libnss3

### 🇨🇳 国内镜像加速
如果 GitHub 下载较慢，可使用 [ghproxy 镜像](https://mirror.ghproxy.com/) 加速。

## 🚀 快速开始

### 运行项目

```bash
# 克隆仓库
git clone https://github.com/tomlct2015/Objector.git
cd Objector

# 安装依赖
npm install

# 启动
npm start
```

### 打包

```bash
# Windows (NSIS + ZIP)
npx electron-builder build --win nsis zip

# Linux (tar.gz)
npx electron-builder build --linux tar.gz
```

## 🏗️ 项目结构

```
Objector/
├── src/                    # 源码目录
│   ├── main.js             # Electron 主进程入口
│   ├── preload.js          # 预加载脚本（IPC 桥接）
│   ├── index.html          # 主页（项目选择/新建）
│   ├── app.js              # 主页逻辑
│   ├── editor.html         # 编辑器页面
│   ├── editor-app.js       # 编辑器入口
│   ├── styles.css          # 全局样式
│   ├── ai-window.html      # AI 助手窗口
│   ├── cmd-window.html     # 命令行窗口
│   ├── core/               # 核心模块
│   │   ├── editor-canvas.js        # 积木画布渲染
│   │   ├── block-defs.js           # 积木定义
│   │   ├── block-renderer.js       # 积木绘制
│   │   ├── executor.js             # 积木执行器
│   │   ├── ai-assistant.js         # AI 助手
│   │   ├── collaboration-manager.js # 协作管理
│   │   ├── history-manager.js      # 撤销/重做
│   │   ├── palette.js              # 积木面板
│   │   ├── scene-graph.js          # 场景图
│   │   ├── project-manager.js      # 项目管理
│   │   ├── tutorial-system.js      # 教程系统
│   │   ├── sound-manager.js        # 声音管理
│   │   ├── extension-manager.js    # 扩展管理
│   │   ├── minecraft-mod.js        # MC 模组
│   │   └── ...
│   ├── stage/              # 舞台模块
│   │   ├── stage-canvas.js # 2D 舞台渲染
│   │   ├── stage-3d.js     # 3D 舞台渲染
│   │   ├── stage-manager.js # 角色管理
│   │   └── sprite.js       # 角色类
│   └── i18n/               # 国际化
│       ├── zh-CN.js
│       └── en.js
├── editor/                 # 运行时目录（src 的副本）
├── tests/                  # 测试
├── electron-builder.json   # 打包配置
├── package.json
└── README.md
```

## 🧱 积木数据结构

Objector 的积木使用 JS 对象存储：

```javascript
{
  id: "blk_abc123",           // 唯一 ID
  type: "control_repeat",     // 积木类型
  x: 100, y: 200,            // 画布坐标
  params: { times: 10 },      // 参数值
  flowIn: null,               // 上一个积木 ID
  flowOut: "blk_def456",      // 下一个积木 ID
  subBlocks: { body: "blk_sub" },  // C 型槽子积木
  paramConnections: {}         // 参数连接
}
```

## 🤖 AI 助手

AI 助手支持通过 `>>>` 指令系统操作编辑器：

```
>>> sprite add "角色名"      # 添加角色
>>> sprite list              # 列出所有角色
>>> run                      # 运行项目
>>> save                     # 保存项目
```

支持的工具调用：`generate_blocks`、`modify_blocks`、`manage_sprites`、`run_project`、`save_project`、`screenshot`、`fetch_url`

## 🛠️ 技术栈

- **运行时**: [Electron 43](https://www.electronjs.org/)
- **渲染**: Canvas 2D + [Three.js](https://threejs.org/)（3D 模式）
- **代码编辑**: [CodeMirror 5](https://codemirror.net/5/)
- **图表**: [Chart.js 4](https://www.chartjs.org/)
- **数据库**: [Supabase](https://supabase.com/)（社区 & 协作）
- **打包**: [electron-builder](https://www.electron.build/)
- **压缩**: [JSZip](https://stuk.github.io/jszip/) + [Archiver](https://www.archiverjs.com/)

## 📄 许可证

[MIT License](LICENSE) — 开源免费

## 🔗 相关链接

- [官网](https://tomlct2015.github.io/Objector-Coder/)
- [在线编辑器](https://tomlct2015.github.io/Objector-Coder/editor/)
- [积木使用指南](https://tomlct2015.github.io/Objector-Coder/blocks-guide/)
- [扩展 API 文档](https://tomlct2015.github.io/Objector-Coder/extension-api/)
- [历史版本下载](https://tomlct2015.github.io/Objector-Coder/versions.html)
