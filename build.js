const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

const skip = ['dist', 'node_modules', 'package.json', 'package-lock.json', 'build.js'];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      if (entry === '.DS_Store') continue;
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

for (const item of fs.readdirSync('.')) {
  if (skip.includes(item) || item.startsWith('.')) continue;
  copyRecursive(item, path.join(distDir, item));
}

for (const hidden of ['.htaccess', '404.shtml']) {
  if (fs.existsSync(hidden)) {
    fs.copyFileSync(hidden, path.join(distDir, hidden));
  }
}

console.log('Build complete: static files copied to dist/');
