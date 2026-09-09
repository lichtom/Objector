const fs = require('fs');
const path = require('path');

const mainJsPath = path.join(__dirname, 'main.js');
let content = fs.readFileSync(mainJsPath, 'utf8');

const insertCode = `
let cmdWindow = null;

// IPC: 打开命令行窗口
ipcMain.handle('open-cmd-window', async (_e) => {
  if (cmdWindow && !cmdWindow.isDestroyed()) {
    cmdWindow.focus();
    return true;
  }

  cmdWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    title: 'Objector 命令行',
    icon: APP_ICON,
    backgroundColor: '#1e1e2e',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  cmdWindow.loadFile(path.join(__dirname, 'cmd-window.html'));
  cmdWindow.on('closed', () => { cmdWindow = null; });
  return true;
});
`;

// Find the line after "aiWindow.on('closed', () => { aiWindow = null; });"
const pattern = /aiWindow\.on\('closed', \(\) => \{ aiWindow = null; \}\);\n  return true;\n\}\);/;
const newContent = content.replace(pattern, (match) => match + insertCode);

fs.writeFileSync(mainJsPath, newContent, 'utf8');
console.log('Successfully inserted cmdWindow handler');
