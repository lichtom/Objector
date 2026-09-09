const fs = require('fs');
const path = require('path');
const asar = require('@electron/asar');

const SRC = __dirname;
const BUILD = path.join(SRC, 'build', 'app');

// Clean build dir
if (fs.existsSync(path.join(SRC, 'build'))) {
  fs.rmSync(path.join(SRC, 'build'), { recursive: true, force: true });
}
fs.mkdirSync(BUILD, { recursive: true });

// Directories to include
const includeDirs = [
  'src', 'editor', 'docs', 'community', 'blocks-guide',
  'extension-api', 'how-to-use-advanced-editor', 'Web-Player'
];

// Root files to include
const includeFiles = [
  'package.json', 'community-api.js', 'community-ui.js', 'community.css',
  'icon.png', 'icon.svg', 'preview.png', 'index.html',
  'Objector2.png', 'Objector2.ico', 'Objector2.svg', 'Objector2.icns',
  'Objector.ico', 'Objector.png', 'Objector.svg', 'Objector2_1024.png'
];

// node_modules to include (only runtime dependencies)
const includeNodeModules = ['electron-squirrel-startup', 'debug', 'ms'];

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

console.log('Building clean app directory...');

// Copy directories
let totalFiles = 0;
for (const dir of includeDirs) {
  const srcDir = path.join(SRC, dir);
  const destDir = path.join(BUILD, dir);
  if (fs.existsSync(srcDir)) {
    const count = copyDirSync(srcDir, destDir);
    console.log(`  ${dir}/: ${count} files`);
    totalFiles += count;
  } else {
    console.log(`  ${dir}/: NOT FOUND (skipped)`);
  }
}

// Copy root files
for (const file of includeFiles) {
  const srcFile = path.join(SRC, file);
  const destFile = path.join(BUILD, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
    totalFiles++;
    console.log(`  ${file}`);
  }
}

// Copy node_modules (only needed ones)
const nmDest = path.join(BUILD, 'node_modules');
fs.mkdirSync(nmDest, { recursive: true });
for (const mod of includeNodeModules) {
  const modSrc = path.join(SRC, 'node_modules', mod);
  const modDest = path.join(nmDest, mod);
  if (fs.existsSync(modSrc)) {
    const count = copyDirSync(modSrc, modDest);
    totalFiles += count;
    console.log(`  node_modules/${mod}/: ${count} files`);
  }
}

console.log(`\nTotal: ${totalFiles} files copied to ${BUILD}`);

// Pack asar
console.log('\nPacking asar...');
const asarPath = path.join(SRC, 'build', 'app.asar');
asar.createPackage(BUILD, asarPath).then(() => {
  const stats = fs.statSync(asarPath);
  console.log(`app.asar created: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
  
  // Verify content
  const files = asar.listPackage(asarPath);
  const checks = [
    'docs/community/shared/community-api.js',
    'src/main.js', 'src/index.html', 'src/editor.html', 'src/editor-app.js',
    'src/core/scene-graph.js', 'src/core/filesystem-dock.js', 'src/core/editor-canvas.js',
    'src/stage/stage-3d.js',
    'editor/editor.html', 'editor/core/scene-graph.js',
    'community/index.html', 'blocks-guide/index.html',
    'extension-api/index.html', 'how-to-use-advanced-editor/index.html',
    'Web-Player/index.html',
    'icon.png', 'icon.svg', 'Objector2.png', 'community-api.js', 'package.json'
  ];
  console.log('\nVerification:');
  let allOk = true;
  checks.forEach(f => {
    const found = files.some(af => af.replace(/\\/g, '/').endsWith(f));
    console.log(`  ${found ? 'OK' : 'MISSING'} ${f}`);
    if (!found) allOk = false;
  });
  console.log(`\nTotal files in asar: ${files.length}`);
  console.log(allOk ? '\nAll checks passed!' : '\nSome files are missing!');
}).catch(err => {
  console.error('Failed to pack asar:', err);
});
