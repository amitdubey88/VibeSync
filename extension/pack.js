#!/usr/bin/env node
/**
 * pack.js — Package the VibeSync extension as a .zip for distribution
 * Usage: node pack.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const out = path.join(__dirname, '..', 'vibesync-extension.zip');
if (fs.existsSync(out)) fs.unlinkSync(out);

// Cross-platform zip using Node's built-in (no external tools)
const AdmZip = (() => {
  try { return require('adm-zip'); } catch {
    execSync('npm install adm-zip --save-dev', { stdio: 'inherit', cwd: __dirname });
    return require('adm-zip');
  }
})();

const zip = new AdmZip();
const SKIP = ['node_modules', 'pack.js', 'create-icons.js', '.DS_Store'];

function addDir(dir, zipPath) {
  for (const entry of fs.readdirSync(dir)) {
    if (SKIP.includes(entry)) continue;
    const full = path.join(dir, entry);
    const zp   = zipPath ? `${zipPath}/${entry}` : entry;
    if (fs.statSync(full).isDirectory()) {
      addDir(full, zp);
    } else {
      zip.addLocalFile(full, path.dirname(zp));
    }
  }
}

addDir(__dirname, '');
zip.writeZip(out);
console.log(`\n📦  Extension packaged → ${out}`);
console.log('    Share this zip file — recipients unzip and use "Load unpacked" in Chrome.\n');
