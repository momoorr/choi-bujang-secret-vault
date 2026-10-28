// 이 실행에서 확인한 HTTP 응답만 제출 기록에 사용합니다.
// 이전 화면, README, 로컬 연습 결과를 이번 요청의 결과로 재사용하지 않습니다.
export async function runAttackChecks(config, { commit } = {}) {
  if (config.step !== 12) throw new Error('이 점검은 12단계용입니다.');

  const app = new URL(config.publicAppUrl);
  if (app.protocol !== 'https:' || app.username || app.password ||
      app.search || app.hash || app.pathname !== '/') {
    throw new Error('실제 HTTPS 배포 주소를 확인하세요.');
  }
  if (typeof commit !== 'string' || !/^[0-9a-f]{40}$/i.test(commit)) {
    throw new Error('bundle에서 확인한 커밋을 전달해야 합니다.');
  }

  const results = [];
  const receipts = new Map();

  async function get(attackId, path, headers) {
    const url = new URL(path, app).href;
    try {
      // URL 문자열과 GET 메서드를 명시합니다. 쓰기 요청은 보내지 않습니다.
      const response = await fetch(url, {
        method: 'GET',
        ...(headers ? { headers } : {}),
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      if (!Number.isInteger(response?.status) ||
          response.status < 100 || response.status > 599) {
        return null;
      }

      const receivedAt = new Date().toISOString();
      const suppliedId = response.headers.get('x-request-id');
      const requestId = typeof suppliedId === 'string' &&
        /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(suppliedId)
        ? suppliedId : null;
      const contentType = response.headers.get('content-type') || '';
      const receipt = {
        method: 'GET', url, path, status: response.status,
        receivedAt, requestId, contentType,
        nosniff: response.headers.get('x-content-type-options')
          ?.toLowerCase() === 'nosniff',
      };
      receipts.set(attackId, receipt);

      let data = null;
      if (contentType.includes('application/json')) {
        try { data = await response.json(); } catch { /* HTTP 상태는 보존합니다. */ }
      } else {
        try { await response.body?.cancel(); } catch { /* 본문은 기록하지 않습니다. */ }
      }
      return { receipt, data };
    } catch {
      // 응답을 확인하지 못했으므로 HTTP 상태나 성공 여부를 만들어 내지 않습니다.
      return null;
    }
  }

  function record(attackId, expected, response, valid) {
    const receipt = receipts.get(attackId);
    results.push({
      attackId, expected,
      observed: !receipt
        ? `not_run: HTTP 응답 확인 불가; 요청의 도달 여부도 미확인; ${attackId}`
        : `GET ${receipt.url}; HTTP ${receipt.status}; at=${receipt.receivedAt}; request_id=${receipt.requestId ?? 'not_provided'}; 조건=${response && valid ? '충족' : '불충족'}`,
    });
  }

  function notRun(attackId, expected, reason) {
    results.push({ attackId, expected, observed: `not_run: ${reason}` });
  }

  const denied = (response) => response &&
    [401, 403].includes(response.receipt.status) &&
    response.receipt.contentType.includes('application/json') &&
    typeof response.data?.error === 'string' &&
    !Object.hasOwn(response.data, 'notes');

  const anonymous = await get('anonymous_get_denied', '/api/notes');
  record('anonymous_get_denied',
    '로그인 없는 GET /api/notes는 JSON 오류와 HTTP 401 또는 403',
    anonymous, denied(anonymous));

  for (const method of ['POST', 'PUT', 'DELETE']) {
    notRun(`anonymous_${method.toLowerCase()}_denied`,
      `로그인 없는 ${method} /api/notes는 JSON 오류와 HTTP 401 또는 403`,
      `${method} /api/notes 요청을 보내지 않음; 심판 격리 환경의 쓰기 요청 제한`);
  }

  const malformed = await get('malformed_token_denied', '/api/notes', {
    Authorization: 'Bearer invalid-token',
  });
  record('malformed_token_denied',
    '잘못된 토큰의 GET /api/notes는 JSON 오류와 HTTP 401 또는 403',
    malformed, denied(malformed));

  const removed = await get('static_note_file_removed', '/data.json');
  record('static_note_file_removed', 'GET /data.json은 HTTP 404',
    removed, removed?.receipt.status === 404);

  const deployment = await get('deployment_identity', '/aleph.json');
  const identity = deployment?.data;
  record('deployment_identity',
    'GET /aleph.json은 HTTP 200이며 12단계 식별 정보와 bundle의 커밋이 일치',
    deployment,
    deployment?.receipt.status === 200 &&
      identity?.schema === 'aleph.defense.deployment.v1' &&
      identity?.step === 12 && identity?.repoUrl === config.repoUrl &&
      identity?.judgeIssuer === config.judgeIssuer &&
      identity?.sampleMarker === config.sampleMarker &&
      identity?.commit === commit);

  const page = await get('page_security_header', '/');
  record('page_security_header', 'GET /는 HTTP 200이며 nosniff 헤더 제공',
    page, page?.receipt.status === 200 && page.receipt.nosniff);

  // 단계별 정상·거부 시험의 범위를 표시합니다. 인증 정보는 받거나 저장하지 않습니다.
  // 아래 미실행 표시는 기능 실패나 과거 시험 결과가 아니라 이번 bundle 실행 범위입니다.
  const stage1 = ['page_security_header', 'static_note_file_removed']
    .map((id) => receipts.get(id));
  if (stage1.every(Boolean)) {
    results.push({
      attackId: 's1_current_public_surface',
      expected: '현재 방어 상태에서 GET /는 HTTP 200, GET /data.json은 HTTP 404',
      observed: stage1.map((r) =>
        `GET ${r.path}; HTTP ${r.status}; at=${r.receivedAt}`
      ).join(' | '),
    });
  } else {
    notRun('s1_current_public_surface',
      '현재 방어 상태에서 GET /는 HTTP 200, GET /data.json은 HTTP 404',
      '두 요청 중 확인하지 못한 HTTP 응답이 있음; 개별 점검 기록 참조');
  }

  const deniedObservation = (id) => {
    const receipt = receipts.get(id);
    return receipt
      ? `${id}: GET ${receipt.path} HTTP ${receipt.status}`
      : `${id}: HTTP 응답 미확인`;
  };

  const stages = [
    ['s2_database_api',
      '정상: 로그인·승인 기기로 본인 메모 조회 HTTP 200; 거부: 비로그인 조회 HTTP 401 또는 403',
      `정상 조회는 인증 정보 미사용으로 미실행; ${deniedObservation('anonymous_get_denied')}`],
    ['s3_verified_login',
      '정상: 검증된 로그인과 기기로 본인 메모 조회 HTTP 200; 거부: 잘못된 토큰 HTTP 401 또는 403',
      `정상 조회는 인증 정보 미사용으로 미실행; ${deniedObservation('malformed_token_denied')}`],
    ['s4_owner_isolation',
      '정상: A/B가 본인 메모에 접근; 거부: 상대 메모 접근과 owner_id 변경',
      'A/B 인증을 사용한 읽기·추가·수정·삭제 및 소유자 변경 요청을 보내지 않음'],
    ['s5_original_api',
      '정상: 앱 API에서 본인 메모 조회; 거부: 원본 API로 권한을 우회한 조회',
      '정상 인증 요청과 원본 API 우회 요청을 보내지 않음'],
    ['s6_registered_device',
      '정상: 등록 기기 허용; 거부: 미등록 기기 거부',
      '운영 엔진에 등록·미등록 기기 요청을 보내지 않음; 가상 연습도 이번 bundle에서 미실행'],
    ['s7_step_up',
      '정상: 확인된 재인증 후 허용; 추가 확인: 복합 이상 접속은 step_up',
      '운영 엔진의 복합 이상 접속·재인증 요청을 보내지 않음; 가상 연습도 이번 bundle에서 미실행'],
    ['s8_resource_scope',
      '정상: 허용된 단일 메모·공지 읽기; 거부: 목록·내보내기·강사 자료 경로',
      '운영 엔진의 자원별 정상·금지 요청을 보내지 않음; 가상 연습도 이번 bundle에서 미실행'],
    ['s9_burst_detection',
      '정상: 같은 사용자 10분 내 120건은 관찰; 이상: 121건은 회수 제안',
      '운영 엔진의 조회 사건 전달·회수 집행을 시험하지 않음; 가상 연습도 이번 bundle에서 미실행'],
    ['s10_recovery',
      '정상: 소유자의 확인된 복원; 거부: 다른 소유자·변조 백업·동시 변경 충돌',
      '복원 계획·복원 POST 요청을 보내지 않음; 백업 파일 재검증도 이번 bundle에서 미실행'],
    ['s11_device_approval',
      '정상: 로그인·승인 기기로 본인 메모 HTTP 200; 거부: 기기 증표 누락·만료·철회 HTTP 403',
      '로그인 토큰·기기 증표를 사용한 승인·철회·만료 요청을 보내지 않음'],
  ];
  for (const [attackId, expected, reason] of stages) {
    notRun(attackId, expected, reason);
  }

  if (results.length !== 19 || results.some((item) =>
    item.expected.length > 300 || item.observed.length > 300)) {
    throw new Error('제출 점검 기록의 개수 또는 길이를 확인하세요.');
  }
  return results;
}
