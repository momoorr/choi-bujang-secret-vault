function http(stage, key, label, target, mode, status, shape) {
  return Object.freeze({
    stage,
    checkId: `s${stage}_${key}`,
    kind: 'http',
    label,
    target,
    mode,
    expectedStatus: status,
    shape,
    expected: `${label}: HTTP ${status}`,
  });
}

function fixture(stage, key, label, scenario, expectedValue) {
  return Object.freeze({
    stage,
    checkId: `s${stage}_${key}`,
    kind: stage === 9 ? 'detection_fixture' : 'decision_fixture',
    label,
    scenario,
    expectedValue,
    expected: `${label}: ${expectedValue}`,
  });
}

// 과거 취약 상태를 재현하지 않고 현재 자료실의 방어 상태를 점검합니다.
export const CHECK_PLAN = Object.freeze([
  http(
    1, 'home', '첫 화면 정상 제공',
    'home', 'anonymous', 200, 'html'
  ),
  http(
    1, 'static_removed', '과거 정적 메모 파일 접근 거부',
    'static_notes', 'anonymous', 404, 'status'
  ),

  http(
    2, 'own_list', '본인 메모 목록 조회',
    'notes_list', 'approved', 200, 'notes'
  ),
  http(
    2, 'anonymous_denied', '비로그인 메모 조회 거부',
    'notes_list', 'anonymous', 401, 'error'
  ),

  http(
    3, 'own_note', '로그인과 기기 인증 후 본인 메모 조회',
    'own_note', 'approved', 200, 'note'
  ),
  http(
    3, 'malformed_denied', '잘못된 로그인 토큰 거부',
    'notes_list', 'malformed', 401, 'error'
  ),

  http(
    4, 'own_note', '본인 소유 메모 조회',
    'own_note', 'approved', 200, 'note'
  ),
  http(
    4, 'other_note_denied', '다른 소유자의 메모 조회 거부',
    'other_note', 'approved', 404, 'error'
  ),

  http(
    5, 'server_api', '앱 서버를 통한 본인 메모 조회',
    'notes_list', 'approved', 200, 'notes'
  ),
  http(
    5, 'keyless_original', 'API 키 없는 원본 API 요청 거부',
    'original_keyless', 'anonymous', 401, 'status'
  ),

  fixture(
    6, 'registered', '가상 등록 기기 요청 허용',
    'registered', 'allow'
  ),
  fixture(
    6, 'unregistered', '가상 미등록 기기 요청 거부',
    'unregistered', 'deny'
  ),

  fixture(
    7, 'verified', '가상 복합 이상 요청의 재인증 후 허용',
    'suspicious_verified', 'allow'
  ),
  fixture(
    7, 'step_up', '가상 복합 이상 요청에 추가 인증 요구',
    'suspicious', 'step_up'
  ),

  fixture(
    8, 'single_resource', '가상 단일 메모 경로 허용',
    'registered', 'allow'
  ),
  fixture(
    8, 'list_denied', '가상 일괄 메모 경로 거부',
    'note_list', 'deny'
  ),

  fixture(
    9, 'normal_reads', '가상 10분 구간의 조회 120건 관찰',
    'reads_120', 'observe'
  ),
  fixture(
    9, 'burst_reads', '가상 조회 121건에 회수 제안',
    'reads_121', 'propose_revocation'
  ),

  http(
    10, 'restore_plan', '백업 소유자의 복원 계획 조회',
    'restore_plan', 'approved', 200, 'restore_plan'
  ),
  http(
    10, 'anonymous_restore', '비로그인 복원 요청 거부',
    'restore_plan', 'anonymous', 401, 'error'
  ),

  http(
    11, 'approved_read', '승인된 인증 수단으로 본인 메모 조회',
    'own_note', 'approved', 200, 'note'
  ),
  http(
    11, 'proof_missing', '로그인만 있고 기기 증표 없는 요청 거부',
    'notes_list', 'login_only', 403, 'error'
  ),

  Object.freeze({
    stage: 12,
    checkId: 's12_engine_assault_41',
    kind: 'not_run',
    label: '운영 엔진의 41종 총공세',
    expected: '운영 엔진의 실제 시험 결과로 별도 확인',
  }),
]);