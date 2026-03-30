#!/usr/bin/env node
/**
 * Copies the site into dist/ and injects GOOGLE_MAP_PLATFORM into HTML placeholders.
 * Vercel: set env GOOGLE_MAP_PLATFORM in project settings.
 * Local: create .env.local with GOOGLE_MAP_PLATFORM=your_key (not committed).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PLACEHOLDER = '__GOOGLE_MAPS_API_KEY__';

function loadEnvLocal() {
  for (const name of ['.env.local', '.env']) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

function shouldCopy(rel) {
  if (!rel) return true;
  const n = rel.split(path.sep)[0];
  if (n === 'node_modules' || n === 'dist' || n === '.git' || n === 'scripts') return false;
  if (n === '.env.local' || n === '.env') return false;
  const base = path.basename(rel);
  if (['package.json', 'package-lock.json', 'vercel.json', '.env.example', '.gitignore'].includes(base)) {
    return false;
  }
  return true;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, ent.name);
    const rel = path.relative(ROOT, from);
    if (!shouldCopy(rel)) continue;
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function walkHtmlFiles(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkHtmlFiles(full, out);
    } else if (/\.html?$/i.test(ent.name)) {
      out.push(full);
    }
  }
}

function injectKey(dir, apiKey) {
  const files = [];
  walkHtmlFiles(dir, files);
  let count = 0;
  for (const file of files) {
    let s = fs.readFileSync(file, 'utf8');
    if (!s.includes(PLACEHOLDER)) continue;
    s = s.split(PLACEHOLDER).join(apiKey);
    fs.writeFileSync(file, s, 'utf8');
    count++;
  }
  return count;
}

loadEnvLocal();
const apiKey = (process.env.GOOGLE_MAP_PLATFORM || '').trim();
if (!apiKey) {
  console.error(
    'build-static: missing GOOGLE_MAP_PLATFORM. Set it in Vercel → Environment Variables, or add .env.local in the project root:\n  GOOGLE_MAP_PLATFORM=your_key'
  );
  process.exit(1);
}

fs.rmSync(DIST, { recursive: true, force: true });
copyDir(ROOT, DIST);
const n = injectKey(DIST, apiKey);
console.log('build-static: wrote dist/ and injected Maps key into', n, 'HTML file(s).');
