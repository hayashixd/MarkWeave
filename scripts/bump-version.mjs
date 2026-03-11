#!/usr/bin/env node
/**
 * バージョン一括更新スクリプト
 *
 * distribution-design.md §7 に準拠。
 * package.json / src-tauri/Cargo.toml / src-tauri/tauri.conf.json の
 * バージョンを同期的に更新する。
 *
 * 使い方:
 *   node scripts/bump-version.mjs <new-version>
 *   node scripts/bump-version.mjs 1.2.0
 *   node scripts/bump-version.mjs patch   # 0.1.0 → 0.1.1
 *   node scripts/bump-version.mjs minor   # 0.1.0 → 0.2.0
 *   node scripts/bump-version.mjs major   # 0.1.0 → 1.0.0
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const FILES = {
  packageJson: resolve(root, 'package.json'),
  cargoToml: resolve(root, 'src-tauri/Cargo.toml'),
  tauriConf: resolve(root, 'src-tauri/tauri.conf.json'),
};

function readCurrentVersion() {
  const pkg = JSON.parse(readFileSync(FILES.packageJson, 'utf-8'));
  return pkg.version;
}

function bumpSemver(current, type) {
  const [major, minor, patch] = current.split('.').map(Number);
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      return null;
  }
}

function validateVersion(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

function updatePackageJson(version) {
  const content = JSON.parse(readFileSync(FILES.packageJson, 'utf-8'));
  content.version = version;
  writeFileSync(FILES.packageJson, JSON.stringify(content, null, 2) + '\n', 'utf-8');
}

function updateCargoToml(version) {
  let content = readFileSync(FILES.cargoToml, 'utf-8');
  // [package] セクション内の version のみ置換
  content = content.replace(
    /^(version\s*=\s*")[\d.]+(")/m,
    `$1${version}$2`,
  );
  writeFileSync(FILES.cargoToml, content, 'utf-8');
}

function updateTauriConf(version) {
  const content = JSON.parse(readFileSync(FILES.tauriConf, 'utf-8'));
  content.version = version;
  writeFileSync(FILES.tauriConf, JSON.stringify(content, null, 2) + '\n', 'utf-8');
}

// --- main ---

const arg = process.argv[2];

if (!arg) {
  console.error('Usage: node scripts/bump-version.mjs <version|patch|minor|major>');
  process.exit(1);
}

const current = readCurrentVersion();
let newVersion;

if (['patch', 'minor', 'major'].includes(arg)) {
  newVersion = bumpSemver(current, arg);
} else {
  newVersion = arg;
}

if (!validateVersion(newVersion)) {
  console.error(`Invalid version: "${newVersion}". Expected format: X.Y.Z`);
  process.exit(1);
}

console.log(`Bumping version: ${current} → ${newVersion}`);

updatePackageJson(newVersion);
console.log(`  ✓ package.json`);

updateCargoToml(newVersion);
console.log(`  ✓ src-tauri/Cargo.toml`);

updateTauriConf(newVersion);
console.log(`  ✓ src-tauri/tauri.conf.json`);

console.log(`\nDone! Version updated to ${newVersion}.`);
console.log(`Next: git add -A && git commit -m "chore: bump version to ${newVersion}" && git tag v${newVersion}`);
