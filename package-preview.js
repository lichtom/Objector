/**
 * 打包预览版本并复制到目标目录
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = __dirname;
const targetDir = 'F:\\李承唐\\Objector\\';

console.log('=== 打包预览版本 ===');
console.log('项目目录:', projectDir);
console.log('目标目录:', targetDir);

// 确保目标目录存在
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

// 使用 electron-packager 打包
console.log('\n[1/2] 运行 electron-packager...');
try {
    execSync(
        'npx electron-packager . Objector --platform=win32 --arch=x64 --out=out --overwrite --asar --icon=Objector2.ico',
        {
            cwd: projectDir,
            stdio: 'inherit',
            env: {
                ...process.env,
                ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/'
            }
        }
    );
    console.log('\n[2/2] 复制到目标目录...');
    
    const outDir = path.join(projectDir, 'out', 'Objector-win32-x64');
    if (!fs.existsSync(outDir)) {
        throw new Error('打包输出目录不存在: ' + outDir);
    }
    
    // 使用 robocopy 复制（保留权限，显示进度）
    execSync(`robocopy "${outDir}" "${targetDir}" /E /IS /IT /R:0 /W:0 /NFL /NDL /NJH /NJS`, { stdio: 'inherit' });
    
    console.log('\n=== 打包完成 ===');
    console.log('预览版本已复制到:', targetDir);
    console.log('可直接运行:', path.join(targetDir, 'Objector.exe'));
} catch (e) {
    console.error('\n打包失败:', e.message);
    process.exit(1);
}
