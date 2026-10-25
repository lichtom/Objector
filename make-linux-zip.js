const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const srcDir = 'out/Objector-linux-x64';
const outFile = 'E:/ObjectScratch-dist/Objector-linux-x64-v1.0.20.zip';

const output = fs.createWriteStream(outFile);
const archive = new archiver.ZipArchive();

output.on('close', () => {
  console.log('Done: ' + outFile + ' (' + Math.round(archive.pointer() / 1024 / 1024) + ' MB)');
});

archive.on('error', (err) => {
  console.error('Error:', err.message);
});

archive.pipe(output);
console.log('Adding files from ' + srcDir + '...');
archive.directory(srcDir, false);
console.log('Finalizing...');
archive.finalize();
