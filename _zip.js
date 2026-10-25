const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'out', 'Objector-win32-x64');
const zipFile = path.join(__dirname, 'out', 'Objector-win32-x64-v1.0.29.zip');

// Remove old zip
try { fs.unlinkSync(zipFile); } catch {}

const output = fs.createWriteStream(zipFile);
const archive = archiver('zip', { zlib: { level: 5 } });

output.on('close', () => {
  const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(1);
  console.log('ZIP 创建成功: ' + zipFile + ' (' + sizeMB + ' MB)');
});

archive.on('error', (err) => {
  console.error('ZIP 失败:', err.message);
  process.exit(1);
});

archive.on('warning', (err) => {
  if (err.code === 'ENOENT') console.warn('Warning:', err.message);
  else throw err;
});

archive.pipe(output);
archive.directory(srcDir, false);
archive.finalize();
