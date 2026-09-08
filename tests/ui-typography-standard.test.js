const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const EXTENSIONS = new Set(['.css', '.html', '.js', '.mjs']);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function findContext(lines, index) {
  for (let i = index; i >= Math.max(0, index - 12); i -= 1) {
    const text = lines[i].trim();
    if (!text || text.startsWith('/*') || text.startsWith('*') || text.startsWith('//')) continue;
    if (text.includes('{') || text.includes('style=') || text.includes('cssText') || text.includes('fontSize')) {
      return text.replace(/\s+/g, ' ').slice(0, 180);
    }
  }
  return lines[index].trim().replace(/\s+/g, ' ').slice(0, 180);
}

const records = [];
for (const file of walk(ROOT)) {
  const fileRel = rel(file);
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const regex = /font-size\s*:\s*([0-9]*\.?[0-9]+)px\b/gi;
    let match;
    while ((match = regex.exec(line))) {
      const value = Number(match[1]);
      if (value <= 14) {
        records.push({
          file: fileRel,
          line: i + 1,
          value,
          context: findContext(lines, i),
          source: line.trim().replace(/\s+/g, ' ').slice(0, 220),
        });
      }
    }
  }
}

const lt13 = records.filter((item) => item.value < 13);
const eq13 = records.filter((item) => item.value === 13);
const eq14 = records.filter((item) => item.value === 14);

console.log('=== UI TYPOGRAPHY AUDIT (classification pass) ===');
console.log(`font-size <13px: ${lt13.length}`);
console.log(`font-size 13px: ${eq13.length}`);
console.log(`font-size 14px: ${eq14.length}`);
for (const group of [
  ['<13px', lt13],
  ['13px', eq13],
  ['14px', eq14],
]) {
  console.log(`\n--- ${group[0]} (${group[1].length}) ---`);
  for (const item of group[1]) {
    console.log(`${item.value}px | ${item.file}:${item.line} | ${item.context} | ${item.source}`);
  }
}

console.error('\nAUDIT_ONLY_FAILURE: this first pass intentionally fails so Repository checks preserves the complete classification report.');
process.exitCode = 1;
