import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const root = 'recovery/stage10';
const backup = path.join(root, 'policy-backup');
const trial = path.join(root, 'policy-trial');
const audit = path.join(root, 'policy-audit.jsonl');

const hash = data =>
  createHash('sha256').update(data).digest('hex');

const expectedFiles = [
  'src/decider.mjs',
  'src/detect.mjs',
  'src/verify-login.mjs',
  'aleph.config.json',
  'api/notes.js',
  'db-policy.json',
];

const manifest = JSON.parse(
  fs.readFileSync(path.join(backup, 'manifest.json'), 'utf8')
);

assert.deepEqual(
  manifest.files.map(entry => entry.file).sort(),
  [...expectedFiles].sort(),
  'Unexpected backup file list'
);

// 모든 백업을 먼저 검증합니다. 실패하면 사본도 수정하지 않습니다.
const originals = new Map();

for (const entry of manifest.files) {
  const data = fs.readFileSync(path.join(backup, entry.file));
  assert.equal(hash(data), entry.sha256, `Invalid backup: ${entry.file}`);
  originals.set(entry.file, data);
}

const record = (action, files) => {
  fs.appendFileSync(audit, JSON.stringify({
    at: new Date().toISOString(),
    action,
    baselineCommit: manifest.commit,
    scope: 'local_policy_trial_only',
    files,
  }) + '\n');
};

const mode = process.argv[2] ?? 'plan';

if (mode === 'prepare') {
  assert.ok(!fs.existsSync(trial), 'Trial already exists');

  const source = originals.get('src/decider.mjs').toString('utf8');
  const target = 'if (!noteRead && !noticeRead) {';
  assert.equal(source.split(target).length, 2, 'Rule line not found');

  for (const [file, data] of originals) {
    const destination = path.join(trial, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, data, { flag: 'wx' });
  }

  fs.writeFileSync(
    path.join(trial, 'src/decider.mjs'),
    source.replace(target, 'if (false) { // TRIAL ONLY: weakened scope')
  );

  record('prepare_weakened_trial', ['src/decider.mjs']);
  console.log('PASS: trial created; one scope rule weakened.');
} else if (mode === 'plan' || mode === 'restore') {
  const changes = [];

  for (const entry of manifest.files) {
    const destination = path.join(trial, entry.file);
    const currentHash = fs.existsSync(destination)
      ? hash(fs.readFileSync(destination))
      : null;

    if (currentHash !== entry.sha256) {
      changes.push({
        file: entry.file,
        before: currentHash,
        after: entry.sha256,
      });
    }
  }

  console.log('Baseline commit:', manifest.commit);
  console.log('Scope: local policy trial only');
  console.log(JSON.stringify(changes, null, 2));

  if (mode === 'restore') {
    assert.ok(
      process.argv.includes('--confirm-trial'),
      'Review plan, then use --confirm-trial'
    );

    for (const change of changes) {
      const destination = path.join(trial, change.file);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, originals.get(change.file));
    }

    for (const entry of manifest.files) {
      assert.equal(
        hash(fs.readFileSync(path.join(trial, entry.file))),
        entry.sha256,
        `Restore mismatch: ${entry.file}`
      );
    }

    record('restore_verified_trial', changes.map(change => change.file));
    console.log('PASS: trial restored; all 6 hashes match.');
  }
} else {
  throw new Error('Use prepare, plan, or restore');
}