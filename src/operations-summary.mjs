import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { RULE_IDS } from './decider.mjs';

const backupRoot = new URL(
  '../recovery/stage10/policy-backup/',
  import.meta.url
);

const expectedFiles = [
  'aleph.config.json',
  'api/notes.js',
  'db-policy.json',
  'src/decider.mjs',
  'src/detect.mjs',
  'src/verify-login.mjs',
].sort();

function readRecoverySummary() {
  try {
    const manifest = JSON.parse(
      readFileSync(new URL('manifest.json', backupRoot), 'utf8')
    );

    if (
      !Array.isArray(manifest.files) ||
      !/^[0-9a-f]{40}$/.test(manifest.commit ?? '')
    ) {
      throw new Error('invalid_manifest');
    }

    const actualFiles = manifest.files
      .map((item) => item.file)
      .sort();

    if (
      JSON.stringify(actualFiles) !==
      JSON.stringify(expectedFiles)
    ) {
      throw new Error('unexpected_backup_files');
    }

    let verifiedFiles = 0;

    for (const item of manifest.files) {
      const bytes = readFileSync(
        new URL(item.file, backupRoot)
      );

      const hash = createHash('sha256')
        .update(bytes)
        .digest('hex');

      if (hash !== item.sha256) {
        throw new Error('backup_hash_mismatch');
      }

      verifiedFiles += 1;
    }

    const auditText = readFileSync(
      new URL(
        '../recovery/stage10/policy-audit.jsonl',
        import.meta.url
      ),
      'utf8'
    );

    const events = auditText
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));

    const restores = events.filter((event) =>
      event.action === 'restore_verified_trial' &&
      event.scope === 'local_policy_trial_only' &&
      event.baselineCommit === manifest.commit &&
      typeof event.at === 'string' &&
      Number.isFinite(Date.parse(event.at))
    );

    const lastRestoreAt = restores.length
      ? new Date(
          Math.max(...restores.map(
            (event) => Date.parse(event.at)
          ))
        ).toISOString()
      : null;

    return {
      status: 'verified',
      source: 'local_backup_and_trial_audit',
      scope: 'local_policy_trial_only',
      baselineCommit: manifest.commit,
      verifiedFiles,
      restoreRecords: restores.length,
      lastRestoreAt,
      liveDatabaseRestoreHistory: 'not_connected',
    };
  } catch {
    return {
      status: 'unavailable',
      source: 'local_backup_and_trial_audit',
      scope: 'local_policy_trial_only',
      baselineCommit: null,
      verifiedFiles: null,
      restoreRecords: null,
      lastRestoreAt: null,
      liveDatabaseRestoreHistory: 'not_connected',
    };
  }
}

async function readDeviceSummary(database, userId) {
  try {
    const { data, error } = await database
      .from('vault_devices')
      .select('status')
      .eq('owner_id', userId);

    if (error || !Array.isArray(data)) {
      throw new Error('device_query_failed');
    }

    const counts = {
      pending: 0,
      approved: 0,
      revoked: 0,
    };

    for (const device of data) {
      if (!Object.hasOwn(counts, device.status)) {
        throw new Error('unknown_device_status');
      }

      counts[device.status] += 1;
    }

    return {
      status: 'ok',
      source: 'current_database_rows',
      counts,
      revocationHistory: 'not_recorded',
    };
  } catch {
    return {
      status: 'unavailable',
      source: 'current_database_rows',
      counts: null,
      revocationHistory: 'not_recorded',
    };
  }
}

export async function createOperationsSummary({
  database,
  userId,
}) {
  if (typeof userId !== 'string' || !userId) {
    throw new Error('verified_user_required');
  }

  return {
    schema: 'vault.operations.v1',
    checkedAt: new Date().toISOString(),
    policy: {
      source: 'student_code',
      ruleIds: [...RULE_IDS],
      liveEngineDecisionHistory: 'not_connected',
    },
    devices: await readDeviceSummary(database, userId),
    detection: {
      source: 'not_connected',
      liveEventCount: null,
      liveRevocationExecution: 'not_connected',
    },
    recovery: readRecoverySummary(),
  };
}