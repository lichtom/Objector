const path = require('path');
const { execSync } = require('child_process');

const nativeDir = path.join(__dirname, 'native', 'app-runtime');
const nodeGypCli = path.join(__dirname, 'node_modules', 'node-gyp', 'bin', 'node-gyp.js');

console.log('=== Building native addon ===');
console.log('Native dir:', nativeDir);
console.log('node-gyp CLI:', nodeGypCli);

try {
    execSync(`node "${nodeGypCli}" rebuild --verbose`, {
        cwd: nativeDir,
        stdio: 'inherit',
        timeout: 300000,
        env: Object.assign({}, process.env, {
            npm_config_nodedir: ''
        })
    });
    console.log('\n=== BUILD SUCCESS ===');

    const fs = require('fs');
    const outFile = path.join(nativeDir, 'build', 'Release', 'app_runtime.node');
    if (fs.existsSync(outFile)) {
        console.log('Output:', outFile);
        console.log('Size:', (fs.statSync(outFile).size / 1024).toFixed(1), 'KB');
    }
} catch (e) {
    console.error('\n=== BUILD FAILED ===');
    console.error(e.message);
    process.exit(1);
}
