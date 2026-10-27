import { execFileSync } from 'node:child_process';

export async function runAttackChecks(config) {
  if (config.step !== 7) {
    throw new Error('이 점검은 7단계용입니다.');
  }

  const app = new URL(config.publicAppUrl);
  if (
    app.protocol !== 'https:' ||
    app.username ||
    app.password ||
    app.search ||
    app.hash ||
    app.pathname !== '/'
  ) {
    throw new Error('실제 HTTPS 배포 주소를 확인하세요.');
  }

  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();

  const results = [];

  async function request(path, options = {}) {
    return fetch(new URL(path, app), {
      ...options,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  }

  async function json(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  function record(attackId, expected, passed, detail) {
    results.push({
      attackId,
      expected,
      observed: `${passed ? '통과' : '실패'}: ${detail}`,
    });
  }

  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const response = await request('/api/notes', { method });
    const data = await json(response);
    const passed =
      [401, 403].includes(response.status) &&
      response.headers.get('content-type')?.includes('application/json') &&
      typeof data?.error === 'string' &&
      !Object.hasOwn(data, 'notes');

    record(
      `anonymous_${method.toLowerCase()}_denied`,
      `로그인 없는 ${method} 요청은 JSON 오류와 HTTP 401 또는 403`,
      passed,
      `${method} 요청 HTTP ${response.status}, JSON 거부 조건 ${passed ? '충족' : '불충족'}`
    );
  }

  const invalidResponse = await request('/api/notes', {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  const invalidData = await json(invalidResponse);

  record(
    'malformed_token_denied',
    '형식이 잘못된 토큰의 메모 조회 거부',
    [401, 403].includes(invalidResponse.status) &&
      typeof invalidData?.error === 'string',
    `잘못된 토큰 요청 HTTP ${invalidResponse.status}`
  );

  const staticResponse = await request('/data.json');
  record(
    'static_note_file_removed',
    '/data.json은 HTTP 404',
    staticResponse.status === 404,
    `/data.json HTTP ${staticResponse.status}`
  );

  const identityResponse = await request('/aleph.json');
  const identity = await json(identityResponse);
  const identityValid =
    identityResponse.status === 200 &&
    identity?.schema === 'aleph.defense.deployment.v1' &&
    identity?.step === 7 &&
    identity?.repoUrl === config.repoUrl &&
    identity?.judgeIssuer === config.judgeIssuer &&
    identity?.sampleMarker === config.sampleMarker &&
    identity?.commit === commit;

  record(
    'deployment_identity',
    '배포 식별 정보가 7단계이며 현재 커밋과 일치',
    identityValid,
    `배포 식별 정보와 현재 커밋 ${identityValid ? '일치' : '불일치'}`
  );

  const page = await request('/');
  const headerValid =
    page.status === 200 &&
    page.headers.get('x-content-type-options')?.toLowerCase() === 'nosniff';

  record(
    'page_security_header',
    '첫 화면 HTTP 200 및 nosniff 헤더 제공',
    headerValid,
    `첫 화면 HTTP ${page.status}, nosniff ${headerValid ? '확인' : '조건 불충족'}`
  );

  return results;
}