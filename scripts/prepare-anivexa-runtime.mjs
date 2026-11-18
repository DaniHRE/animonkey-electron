import { spawnSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const apiRoot = path.join(projectRoot, 'vendor', 'anivexa-api');
const runtimeRoot = path.join(projectRoot, 'anivexa-runtime');
const sourceDirs = ['core', 'extractors', 'providers'];
const targetPlatform = process.argv[2] ?? process.platform;
const targetArch = process.argv[3] ?? process.arch;

function fail(message) {
  process.stderr.write(message + '\n');
  process.exit(1);
}

if (targetPlatform !== process.platform || targetArch !== process.arch) {
  fail(
    'Anivexa native dependencies must be prepared on the same OS and architecture as the build target.',
  );
}

const relativeRuntimePath = path.relative(projectRoot, runtimeRoot);
if (
  !relativeRuntimePath ||
  relativeRuntimePath.startsWith('..') ||
  path.isAbsolute(relativeRuntimePath)
) {
  fail('The Anivexa runtime staging path is outside the project.');
}

const packageManifestPath = path.join(apiRoot, 'package.json');
const lockfilePath = path.join(apiRoot, 'package-lock.json');
try {
  await readFile(path.join(apiRoot, 'index.js'));
  await readFile(packageManifestPath);
  await readFile(lockfilePath);
} catch {
  fail('Initialize the Anivexa submodule before preparing the runtime.');
}

const submoduleStatus = spawnSync(
  'git',
  ['-C', apiRoot, 'status', '--porcelain'],
  { encoding: 'utf8' },
);
if (submoduleStatus.status !== 0) {
  fail('Could not inspect the pinned Anivexa submodule.');
}
if (submoduleStatus.stdout.trim()) {
  fail(
    'The Anivexa submodule has local changes; commit or preserve them separately before packaging.',
  );
}

const revision = spawnSync('git', ['-C', apiRoot, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
});
if (revision.status !== 0) fail('Could not identify the Anivexa commit.');

await rm(runtimeRoot, { recursive: true, force: true });
await mkdir(runtimeRoot, { recursive: true });
for (const directory of sourceDirs) {
  await cp(path.join(apiRoot, directory), path.join(runtimeRoot, directory), {
    recursive: true,
  });
}
for (const file of ['index.js', 'package.json', 'package-lock.json']) {
  await cp(path.join(apiRoot, file), path.join(runtimeRoot, file));
}
await cp(
  path.join(projectRoot, 'src', 'electron', 'anivexa-utility.cjs'),
  path.join(runtimeRoot, 'utility-worker.cjs'),
);
await writeFile(
  path.join(runtimeRoot, 'anivexa-version.json'),
  JSON.stringify(
    {
      repository: 'https://github.com/DaniHRE/Anivexa-API',
      commit: revision.stdout.trim(),
    },
    null,
    2,
  ) + '\n',
);

const install =
  process.platform === 'win32'
    ? spawnSync(
        'cmd.exe',
        ['/d', '/c', 'npm.cmd ci --omit=dev --no-audit --no-fund'],
        { cwd: runtimeRoot, stdio: 'inherit' },
      )
    : spawnSync('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], {
        cwd: runtimeRoot,
        stdio: 'inherit',
      });
if (install.error) throw install.error;
if (install.status !== 0) {
  fail('Could not install the pinned Anivexa production dependencies.');
}

process.stdout.write(
  'Prepared Anivexa runtime at ' +
    relativeRuntimePath +
    ' (' +
    revision.stdout.trim() +
    ').\n',
);
