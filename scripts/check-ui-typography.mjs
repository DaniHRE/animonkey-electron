import { readdirSync, readFileSync } from 'node:fs';
import { extname, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = resolve(repositoryRoot, 'src');
const supportedExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
]);
const violations = [];

function collectSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectSourceFiles(path));
    else if (supportedExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function isBelowFloor(value, unit) {
  const pixels = value * (unit.toLowerCase() === 'px' ? 1 : 16);
  return pixels < 12;
}

function recordSizes(source, file, expression, sizeGroup) {
  for (const match of source.matchAll(expression)) {
    const values = match[sizeGroup].matchAll(
      /(\d+(?:\.\d+)?|\.\d+)(px|rem|em)\b/gi,
    );
    for (const sizeMatch of values) {
      const value = Number(sizeMatch[1]);
      if (!isBelowFloor(value, sizeMatch[2])) continue;
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      violations.push(
        `${relative(repositoryRoot, file)}:${line}: ${value}${sizeMatch[2]} is below 12px`,
      );
    }
  }
}

for (const file of collectSourceFiles(sourceRoot)) {
  const source = readFileSync(file, 'utf8');
  recordSizes(source, file, /\btext-\[([^\]]+)\]/g, 1);
  recordSizes(source, file, /font-size\s*:\s*([^;{}]+)/gi, 1);
  recordSizes(source, file, /\bfontSize\s*:\s*([^,}\n]+)/g, 1);
}

if (violations.length > 0) {
  process.stderr.write(
    `UI typography must be at least 12px:\n${violations.join('\n')}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write('UI typography floor passed (minimum 12px).\n');
}
