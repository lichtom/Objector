# Objector

> Visual Block Programming Editor — Build Unlimited Creativity with Blocks

[![Version](https://img.shields.io/badge/version-1.0.25.beta-blue)](https://github.com/lichtom/Objector/releases)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey)](https://github.com/lichtom/Objector/releases)

**Objector** is a [Electron](https://www.electronjs.org/)-based visual block programming editor that enables even beginners to create animations, games, and interactive programs. Not just a Scratch clone — it's a comprehensive evolution designed for professional developers.

[🌐 Try Online](https://lichtom.github.io/Objector-Coder/editor/) · [📖 Blocks Guide](https://lichtom.github.io/Objector-Coder/blocks-guide/) · [📥 Download Latest](https://github.com/lichtom/Objector/releases/latest)

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🧩 **Visual Block Programming** | Drag-and-drop blocks with flow connections, parameter embedding, and C-type sub-code blocks |
| 🤖 **AI Assistant** | Built-in AI chat window supporting OpenAI / DeepSeek / Qwen and more — generate blocks from natural language |
| ⚙️ **Settings Panel + 6 Themes** | Default / Dark / Light / Solarized / Nord / Dracula, with custom CSS editor |
| 👥 **Collaboration** | Push progress, branch management, view members, share links (powered by Supabase) |
| ⌨️ **Command Line** | Standalone terminal with `sprite` / `run` / `save` commands |
| 🐛 **Professional Debugging** | Breakpoints, step-through execution, variable watch panel |
| 🎨 **12 Block Modules** | Events, Motion, Looks, Control, Operators, Variables, Functions, OOP, Lists, Sound, 3D, Sensing |
| 📦 **Multi-Format Export** | Standalone HTML files, project ZIP packages |
| 🔍 **Block Search + Multi-Select** | Ctrl+F to search blocks, Shift+click for multi-select batch operations |
| 📖 **Interactive Tutorial** | Built-in beginner tutorial with highlighted UI guidance |
| 🌐 **PWA Support** | Installable as PWA on Android devices |
| ⛏️ **Minecraft Mod Development** | Code generation for Bedrock, NetEase, and Java editions |
| 💻 **Code Programming Mode** | Python / C++ / JavaScript code editor |
| 📊 **Data Analysis Mode** | Python-like data analysis environment with charts and data processing |

## 🎯 Creation Modes

| Mode | Description |
|------|-------------|
| 🎮 Standard | Classic block programming with 2D / 3D rendering |
| 🎬 Advanced | Godot-style professional editor with block and code dual modes |
| 🧩 Extensions | Create custom extension blocks |
| 📊 Data Analysis | Python-style data analysis environment |
| ⛏️ MC Mod Dev | Minecraft mod code generation |
| 💻 Code Programming | Python / C++ / JavaScript programming |

## 📥 Download

### Windows (x64)
- **[Installer (.exe)](https://github.com/lichtom/Objector/releases/download/v1.0.25.beta/Objector-Setup-1.0.25.beta.exe)** — NSIS installer with custom install path
- **[Portable (.zip)](https://github.com/lichtom/Objector/releases/download/v1.0.25.beta/Objector-1.0.25.beta-win.zip)** — Extract and run

### Linux (x64)
- **[Archive (.tar.gz)](https://github.com/lichtom/Objector/releases/download/v1.0.25.beta/objector-1.0.25.beta.tar.gz)** — Requires libgtk-3 and libnss3

See [all releases](https://github.com/lichtom/Objector/releases) for previous versions.

## 🚀 Quick Start

### Run from Source

```bash
# Clone the repository
git clone https://github.com/lichtom/Objector.git
cd Objector

# Install dependencies
npm install

# Start the application
npm start
```

### Build

```bash
# Windows (NSIS installer + ZIP portable)
npx electron-builder build --win nsis zip

# Linux (tar.gz archive)
npx electron-builder build --linux tar.gz
```

## 🏗️ Project Structure

```
Objector/
├── src/                    # Source code
│   ├── main.js             # Electron main process entry
│   ├── preload.js          # Preload script (IPC bridge)
│   ├── index.html          # Home page (project selection/creation)
│   ├── app.js              # Home page logic
│   ├── editor.html         # Editor page
│   ├── editor-app.js       # Editor entry point
│   ├── styles.css          # Global styles
│   ├── ai-window.html      # AI assistant window
│   ├── cmd-window.html     # Command line window
│   ├── core/               # Core modules
│   │   ├── editor-canvas.js        # Block canvas rendering
│   │   ├── block-defs.js           # Block definitions
│   │   ├── block-renderer.js       # Block drawing
│   │   ├── executor.js             # Block execution engine
│   │   ├── ai-assistant.js         # AI assistant
│   │   ├── collaboration-manager.js # Collaboration management
│   │   ├── history-manager.js      # Undo/Redo
│   │   ├── palette.js              # Block palette
│   │   ├── scene-graph.js          # Scene graph
│   │   ├── project-manager.js      # Project management
│   │   ├── tutorial-system.js      # Tutorial system
│   │   ├── sound-manager.js        # Sound management
│   │   ├── extension-manager.js    # Extension management
│   │   ├── minecraft-mod.js        # Minecraft mod support
│   │   └── ...
│   ├── stage/              # Stage modules
│   │   ├── stage-canvas.js # 2D stage rendering
│   │   ├── stage-3d.js     # 3D stage rendering (Three.js)
│   │   ├── stage-manager.js # Sprite management
│   │   └── sprite.js       # Sprite class
│   └── i18n/               # Internationalization
│       ├── zh-CN.js        # Chinese
│       └── en.js           # English
├── editor/                 # Runtime directory (copy of src)
├── tests/                  # Unit tests
├── electron-builder.json   # Build configuration
├── package.json
└── README.md
```

## 🧱 Block Data Structure

Objector stores blocks as JavaScript objects:

```javascript
{
  id: "blk_abc123",                    // Unique block ID
  type: "control_repeat",             // Block type
  x: 100, y: 200,                     // Canvas coordinates
  params: { times: 10 },              // Parameter values
  flowIn: null,                       // Previous block in chain (null = chain start)
  flowOut: "blk_def456",              // Next block in chain (null = chain end)
  subBlocks: { body: "blk_sub" },     // C-type slot: sub-block entry point
  paramConnections: { steps: "blk_r" } // Parameter connections to reporter blocks
}
```

**Key concepts:**
- **flowOut / flowIn**: Sequential execution chain — `A.flowOut = B.id` means A executes before B
- **subBlocks**: C-type slots (e.g., `body`, `then`, `else`) — entry points for nested code blocks
- **paramConnections**: Reporter/boolean blocks connected to parameter input slots

## 🤖 AI Assistant

The AI assistant supports a `>>>` command system for editor operations:

```
>>> sprite add "MySprite"    # Add a new sprite
>>> sprite list              # List all sprites
>>> run                      # Run the project
>>> save                     # Save the project
```

**Available tool calls:** `generate_blocks`, `modify_blocks`, `manage_sprites`, `run_project`, `save_project`, `screenshot`, `fetch_url`

## 🛠️ Tech Stack

| Category | Technology |
|----------|-----------|
| Runtime | [Electron 43](https://www.electronjs.org/) |
| 2D Rendering | Canvas 2D |
| 3D Rendering | [Three.js](https://threejs.org/) |
| Code Editor | [CodeMirror 5](https://codemirror.net/5/) |
| Charts | [Chart.js 4](https://www.chartjs.org/) |
| Database | [Supabase](https://supabase.com/) (Community & Collaboration) |
| Build | [electron-builder](https://www.electron.build/) |
| Compression | [JSZip](https://stuk.github.io/jszip/) + [Archiver](https://www.archiverjs.com/) |

## 📄 License

[MIT License](LICENSE) — Free and open source

## 🔗 Links

- [Website](https://lichtom.github.io/Objector-Coder/)
- [Online Editor](https://lichtom.github.io/Objector-Coder/editor/)
- [Blocks Guide](https://lichtom.github.io/Objector-Coder/blocks-guide/)
- [Extension API Docs](https://lichtom.github.io/Objector-Coder/extension-api/)
- [Version History](https://lichtom.github.io/Objector-Coder/versions.html)
