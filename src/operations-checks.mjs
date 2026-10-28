import { randomUUID } from 'node:crypto';
import { CHECK_PLAN } from './operations-plan.mjs';
import { runHttpCheck } from './operations-http-check.mjs';
import { runFixtureCheck } from './operations-fixture-check.mjs';
import { readNoteBackup } from './note-recovery.mjs';

const columns = [
  'run_id',
  'stage',
  'check_id',
  'source',
  'expected',
  'observed',
  'result',
  'http_status',
  'request_id',
  'checked_at',
  'recorded_at',
  'deployment_commit',
].join(',');

function notRun(spec, reason) {
  return {
    stage: spec.stage,
    check_id: spec.checkId,
    source: 'not_run',
    expected: spec.expected,
    observed: reason,
    result: 'not_run',
    http_status: null,
    request_id: null,
    checked_at: null,
  };
}

function restoreEligibility(userId) {
  try {
    const backup = readNoteBackup(
      process.env.STAGE10_NOTE_BACKUP_JSON
    );

    return backup.owner_id === userId
      ? 'owner'
      : 'other_owner';
  } catch {
    return 'unavailable';
  }
}

async function findNote(database, userId, own) {
  try {
    let query = database
      .from('notes')
      .select('id');

    query = own
      ? query.eq('owner_id', userId)
      : query.neq('owner_id', userId);

    const { data, error } = await query
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return {
      available: true,
      id: data?.id ?? null,
    };
  } catch {
    return {
      available: false,
      id: null,
    };
  }
}

export async function readOperationChecks({
  database,
  userId,
  runId,
}) {
  const { data, error } = await database
    .from('vault_operation_checks')
    .select(columns)
    .eq('owner_id', userId)
    .eq('run_id', runId)
    .order('stage', { ascending: true })
    .order('check_id', { ascending: true });

  if (error || !Array.isArray(data)) {
    throw new Error('operations_record_read_failed');
  }

  const checkedTimes = data
    .map((row) => Date.parse(row.checked_at))
    .filter(Number.isFinite);

  return {
    schema: 'vault.operation-checks.v1',
    status: 'stored',
    runId,
    readAt: new Date().toISOString(),
    checkedAt: checkedTimes.length
      ? new Date(Math.max(...checkedTimes)).toISOString()
      : null,
    checks: data,
  };
}

export async function readLatestOperationChecks({
  database,
  userId,
}) {
  const { data, error } = await database
    .from('vault_operation_checks')
    .select('run_id')
    .eq('owner_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('operations_record_read_failed');
  }

  if (!data) {
    return {
      schema: 'vault.operation-checks.v1',
      status: 'not_run',
      runId: null,
      readAt: new Date().toISOString(),
      checkedAt: null,
      checks: [],
    };
  }

  return readOperationChecks({
    database,
    userId,
    runId: data.run_id,
  });
}

export async function runOperationChecks({
  database,
  userId,
  config,
  authorization,
  deviceToken,
}) {
  const runId = randomUUID();

  const rawCommit = process.env.VERCEL_GIT_COMMIT_SHA;
  const deploymentCommit = /^[0-9a-f]{40}$/i.test(
    rawCommit ?? ''
  )
    ? rawCommit.toLowerCase()
    : null;

  const [ownNote, otherNote] = await Promise.all([
    findNote(database, userId, true),
    findNote(database, userId, false),
  ]);

  const context = {
    config,
    authorization,
    deviceToken,
    ownNoteId: ownNote.id,
    otherNoteId: otherNote.id,
    restoreEligibility: restoreEligibility(userId),
  };

  async function execute(spec) {
    if (spec.kind === 'not_run') {
      return notRun(
        spec,
        '이 점검에서는 운영 엔진의 41종 총공세를 실행하지 않았습니다.'
      );
    }

    if (spec.kind.endsWith('_fixture')) {
      return runFixtureCheck(spec);
    }

    if (spec.kind === 'http') {
      const noteLookup = spec.target === 'own_note'
        ? ownNote
        : spec.target === 'other_note'
          ? otherNote
          : null;

      if (noteLookup && !noteLookup.available) {
        return notRun(
          spec,
          '점검 대상 메모 ID 조회에 실패해 실행하지 않았습니다.'
        );
      }

      return runHttpCheck(spec, context);
    }

    return notRun(spec, '등록되지 않은 점검 종류입니다.');
  }

  const results = [];

  // 한 번에 최대 4건만 실행합니다.
  for (let index = 0; index < CHECK_PLAN.length; index += 4) {
    const batch = CHECK_PLAN.slice(index, index + 4);
    results.push(...await Promise.all(batch.map(execute)));
  }

  const rows = results.map((result) => ({
    ...result,
    run_id: runId,
    owner_id: userId,
    deployment_commit: deploymentCommit,
  }));

  const { error } = await database
    .from('vault_operation_checks')
    .insert(rows);

  if (error) {
    throw new Error('operations_record_write_failed');
  }

  const stored = await readOperationChecks({
    database,
    userId,
    runId,
  });

  if (stored.checks.length !== CHECK_PLAN.length) {
    throw new Error('operations_record_count_mismatch');
  }

  return stored;
}