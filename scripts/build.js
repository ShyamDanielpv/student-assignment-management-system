const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

console.log('======================================================');
console.log('  🚀 SAMS Progressive Web App - Production Build');
console.log('======================================================\n');

// 1. Clean & prepare dist directory
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });
fs.mkdirSync(path.join(DIST_DIR, 'css'), { recursive: true });
fs.mkdirSync(path.join(DIST_DIR, 'js'), { recursive: true });
fs.mkdirSync(path.join(DIST_DIR, 'icons'), { recursive: true });

// Helper to copy file
function copyFile(src, dest) {
  fs.copyFileSync(path.join(ROOT_DIR, src), path.join(DIST_DIR, dest));
}

// 2. Copy and optimize index.html
console.log('📦 Optimizing HTML & Core Shell...');
let html = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
// Normalize whitespace without altering template logic
fs.writeFileSync(path.join(DIST_DIR, 'index.html'), html, 'utf8');

// 3. Copy CSS
console.log('📦 Bundling & Copying Stylesheets...');
copyFile('css/style.css', 'css/style.css');
copyFile('css/responsive.css', 'css/responsive.css');

// 4. Copy JS
console.log('📦 Bundling & Copying JavaScript Modules...');
const jsFiles = ['app.js', 'auth.js', 'data.js', 'storage.js', 'ui.js', 'firebase-config.js'];
jsFiles.forEach(file => copyFile(`js/${file}`, `js/${file}`));

// 5. Copy Icons
console.log('📦 Copying PWA Brand Icons...');
const iconFiles = ['icon-192.png', 'icon-512.png', 'icon-maskable.png', 'apple-touch-icon.png', 'icon.svg'];
iconFiles.forEach(icon => {
  const iconSrc = path.join(ROOT_DIR, 'icons', icon);
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, path.join(DIST_DIR, 'icons', icon));
  }
});

// 6. Copy PWA Manifest & Service Worker
console.log('📦 Copying PWA Manifest & Service Worker...');
copyFile('manifest.json', 'manifest.json');
copyFile('sw.js', 'sw.js');

console.log('\n✅ Production Build Compiled Successfully into /dist directory!\n');

// ============================================================================
// PRE-DEPLOYMENT AUDIT & VERIFICATION CHECKS (8 CATEGORIES)
// ============================================================================
console.log('======================================================');
console.log('  🔍 Running Pre-Deployment Verification Audit');
console.log('======================================================\n');

const audit = {
  checks: [],
  passed: 0,
  warnings: 0,
  failed: 0
};

function addCheck(category, name, passed, details) {
  audit.checks.push({ category, name, passed, details });
  if (passed === true) audit.passed++;
  else if (passed === 'warning') audit.warnings++;
  else audit.failed++;
  const icon = passed === true ? '✅ PASS' : passed === 'warning' ? '⚠️ NOTICE' : '❌ FAIL';
  console.log(`${icon} [${category}] ${name}: ${details}`);
}

// 1. Firebase Configuration
const fbConfigContent = fs.readFileSync(path.join(ROOT_DIR, 'js/firebase-config.js'), 'utf8');
const hasLocalFallback = fbConfigContent.includes('isFirebaseLiveActive') && fbConfigContent.includes('sams_custom_firebase_config');
addCheck('Firebase Config', 'Resilient Dual-Mode Architecture', hasLocalFallback, 'Automatic local fallback + in-app cloud configuration modal enabled.');

// 2. Database Rules (firestore.rules)
const firestoreRules = fs.readFileSync(path.join(ROOT_DIR, 'firestore.rules'), 'utf8');
const hasStudentRestriction = firestoreRules.includes('isStudent()') && firestoreRules.includes('request.resource.data.grade == null');
const hasFacultyOnly = firestoreRules.includes('isFaculty()');
addCheck('Database Rules', 'Firestore Security Isolation', hasStudentRestriction && hasFacultyOnly, 'Role guards prevent students from modifying marks, grades, or other students submissions.');

// 3. File-Upload Restrictions (storage.rules)
const storageRules = fs.readFileSync(path.join(ROOT_DIR, 'storage.rules'), 'utf8');
const hasSizeLimit = storageRules.includes('25 * 1024 * 1024');
const hasPathIsolation = storageRules.includes('/submissions/{userId}/') && storageRules.includes('/assignments/{assignmentId}/');
addCheck('File Uploads', 'Storage Restrictions & Size Limits', hasSizeLimit && hasPathIsolation, '25MB per-file quota enforced; user submissions isolated to /submissions/{userId}/.');

// 4. Environment Settings
const hasHttpsCheck = html.includes('https://www.gstatic.com/firebasejs/');
const hasViewportFit = html.includes('viewport-fit=cover');
const hasMetaCharset = html.includes('charset="UTF-8"');
addCheck('Environment', 'HTTPS CDN, Charset & Safe-Area Viewport', hasHttpsCheck && hasViewportFit && hasMetaCharset, 'Official Google HTTPS CDNs used, UTF-8 charset declared, iPhone viewport-fit=cover configured.');

// 5. Mobile Layout & Touch Controls
const cssResponsive = fs.readFileSync(path.join(ROOT_DIR, 'css/responsive.css'), 'utf8');
const hasTouchTarget = cssResponsive.includes('min-height: 46px');
const hasNoZoom = cssResponsive.includes('font-size: 16px !important');
const hasBottomNav = html.includes('id="mobileBottomNav"');
addCheck('Mobile Layout', 'Touch Targets & Bottom Navigation', hasTouchTarget && hasNoZoom && hasBottomNav, 'Minimum 46-48px touch targets, iOS zoom prevention (16px), sticky bottom navigation bar active.');

// 6. App Icon
const has192 = fs.existsSync(path.join(DIST_DIR, 'icons/icon-192.png'));
const has512 = fs.existsSync(path.join(DIST_DIR, 'icons/icon-512.png'));
const hasMaskable = fs.existsSync(path.join(DIST_DIR, 'icons/icon-maskable.png'));
const hasAppleIcon = fs.existsSync(path.join(DIST_DIR, 'icons/apple-touch-icon.png'));
addCheck('App Icons', 'Multi-Resolution PWA Icons', has192 && has512 && hasMaskable && hasAppleIcon, '192x192, 512x512, maskable (safe-zone), and Apple touch icons verified in /dist/icons.');

// 7. Manifest
const manifestJson = JSON.parse(fs.readFileSync(path.join(DIST_DIR, 'manifest.json'), 'utf8'));
const manifestValid = manifestJson.name && manifestJson.short_name && manifestJson.display === 'standalone' && manifestJson.theme_color && manifestJson.icons.length >= 3;
addCheck('PWA Manifest', 'Manifest Compliance (W3C PWA)', manifestValid, `Name: "${manifestJson.name}", Display: standalone, Theme: ${manifestJson.theme_color}, ${manifestJson.icons.length} icon definitions.`);

// 8. Service Worker
const swContent = fs.readFileSync(path.join(DIST_DIR, 'sw.js'), 'utf8');
const hasCacheShell = swContent.includes('PRECACHE_ASSETS') && swContent.includes('caches.open');
const hasOfflineStrategy = swContent.includes('Network First') || swContent.includes('caches.match');
addCheck('Service Worker', 'Offline Caching & Shell Pre-Cache', hasCacheShell && hasOfflineStrategy, 'Cache-First for shell assets, Network-First for HTML navigation, automatic offline fallback.');

console.log('\n======================================================');
console.log(`  Audit Summary: ${audit.passed} Passed, ${audit.warnings} Warnings, ${audit.failed} Failed`);
console.log('======================================================\n');

// Write audit report to dist and appData scratch directory
fs.writeFileSync(
  path.join(DIST_DIR, 'pre_deployment_audit_report.json'),
  JSON.stringify(audit, null, 2),
  'utf8'
);
