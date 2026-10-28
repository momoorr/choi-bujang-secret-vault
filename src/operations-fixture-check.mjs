import { decide, RULE_IDS } from './decider.mjs';
import { detect } from './detect.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';

const RESPONSE_KEYS =
  'decision,reasonCode,requestId,ruleIds,schema';

function record(spec, result, observed) {
  return {
    stage: spec.stage,
    check_id: spec.checkId,
    source: 'local_fixture',
    expected: spec.expected,
    observed,
    result,
    http_status: null,
    request_id: null,
    checked_at: new Date().toISOString(),
  };
}

function decisionInput(scenario) {
  const { normal, suspicious } = fixtureRequests();

  if (scenario === 'registered') return normal;

  if (scenario === 'unregistered') {
    return { ...normal, deviceRegistered: false };
  }

  if (scenario === 'suspicious') return suspicious;

  if (scenario === 'suspicious_verified') {
    return {
      ...suspicious,
      stepUp: {
        verified: true,
        authAgeSeconds: 60,
      },
    };
  }

  if (scenario === 'note_list') {
    return {
      ...normal,
      service: 'notes',
      method: 'GET',
      path: '/notes',
      route: 'GET /notes',
    };
  }

  throw new Error('unknown_fixture');
}

function validDecision(request, response) {
  return (
    response &&
    typeof response === 'object' &&
    !Array.isArray(response) &&
    Object.keys(response).sort().join(',') === RESPONSE_KEYS &&
    response.schema === 'aleph.decision.v1' &&
    response.requestId === request.requestId &&
    ['allow', 'deny', 'step_up'].includes(response.decision) &&
    typeof response.reasonCode === 'string' &&
    /^[a-z][a-z0-9_]{0,63}$/.test(response.reasonCode) &&
    Array.isArray(response.ruleIds) &&
    response.ruleIds.length > 0 &&
    response.ruleIds.every((id) => RULE_IDS.includes(id))
  );
}

async function checkDecision(spec) {
  const request = decisionInput(spec.scenario);
  const response = await decide(request);

  if (!validDecision(request, response)) {
    return record(
      spec,
      'failed',
      '가상 판정 요청의 응답 형식 또는 규칙 목록이 계약과 다릅니다.'
    );
  }

  const expectations = {
    registered: ['approved', 'device_registered'],
    unregistered: ['device_not_registered', 'device_registered'],
    suspicious: ['step_up_required', 'step_up_required'],
    suspicious_verified: ['approved', 'device_registered'],
    note_list: ['resource_not_allowed', 'resource_scope'],
  };

  const [reason, rule] = expectations[spec.scenario];

  const passed =
    response.decision === spec.expectedValue &&
    response.reasonCode === reason &&
    response.ruleIds.includes(rule);

  return record(
    spec,
    passed ? 'passed' : 'failed',
    `가상 입력 실행: ${response.decision} · ` +
    `${response.reasonCode} · 규칙 ${response.ruleIds.join(', ')}`
  );
}

async function checkDetection(spec) {
  const count = spec.scenario === 'reads_120'
    ? 120
    : spec.scenario === 'reads_121'
      ? 121
      : null;

  if (count === null) {
    throw new Error('unknown_fixture');
  }

  const subject = 'learner_fixture';
  const start = Date.UTC(2026, 9, 1);

  const events = Array.from({ length: count }, (_, index) => ({
    at: new Date(start + index * 2000).toISOString(),
    method: 'GET',
    identity: { sub: subject },
  }));

  const response = await detect(events);

  let passed = false;

  if (spec.expectedValue === 'observe') {
    passed =
      response?.action === 'observe' &&
      Object.keys(response).join(',') === 'action';
  } else {
    passed =
      response?.action === 'propose_revocation' &&
      response.reasonCode === 'burst_read' &&
      response.subject === subject &&
      Object.keys(response).sort().join(',') ===
        'action,reasonCode,subject';
  }

  return record(
    spec,
    passed ? 'passed' : 'failed',
    passed
      ? `가상 조회 ${count}건 실행: ${spec.expectedValue} · 실제 접속 회수는 실행하지 않음`
      : `가상 조회 ${count}건의 탐지 응답이 기대 조건과 다름`
  );
}

export async function runFixtureCheck(spec) {
  try {
    if (spec.kind === 'decision_fixture') {
      return await checkDecision(spec);
    }

    if (spec.kind === 'detection_fixture') {
      return await checkDetection(spec);
    }

    throw new Error('unknown_fixture');
  } catch {
    return record(
      spec,
      'error',
      '가상 입력을 사용한 학생 함수 실행에 실패했습니다.'
    );
  }
}