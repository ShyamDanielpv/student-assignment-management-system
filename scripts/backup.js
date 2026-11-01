const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT_DIR, 'backups', 'pre_clean_backup');

console.log('Creating full project backup before cleaning demo data...');
console.log('Source:', ROOT_DIR);
console.log('Destination:', BACKUP_DIR);

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const EXCLUDE_DIRS = ['backups', 'dist', '.git', 'node_modules'];

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    const base = path.basename(src);
    if (EXCLUDE_DIRS.includes(base)) return;
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((child) => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

fs.readdirSync(ROOT_DIR).forEach((item) => {
  if (EXCLUDE_DIRS.includes(item)) return;
  copyRecursive(path.join(ROOT_DIR, item), path.join(BACKUP_DIR, item));
});

console.log('Backup successfully created at:', BACKUP_DIR);
console.log('Backed up files:', fs.readdirSync(BACKUP_DIR));
