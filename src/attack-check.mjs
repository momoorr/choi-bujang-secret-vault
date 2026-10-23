// 응답 기록에 토큰, 비밀 키, 실명, 메모 본문을 넣지 않습니다.
export async function runAttackChecks(config) {
  if (config.step !== 2) {
    throw new Error('이 점검은 2단계용입니다.');
  }

  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('실제 배포 주소를 설정해 주세요.');
  }

  if (
    app.protocol !== 'https:' ||
    app.username ||
    app.password ||
    app.search ||
    app.hash ||
    app.pathname !== '/' ||
    app.hostname.endsWith('.example')
  ) {
    throw new Error('실제 HTTPS 배포 주소를 설정해 주세요.');
  }

  if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) {
    throw new Error('가상 메모의 확인 표시를 설정해 주세요.');
  }

  const request = (path) =>
    fetch(new URL(path, app), {
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });

  const readJson = async (response) => {
    try {
      return await response.json();
    } catch {
      return null;
    }
  };

  const apiResponse = await request('/api/notes');
  const apiData = await readJson(apiResponse);
  const apiVisible =
    apiResponse.status === 200 &&
    apiData?.sampleMarker === config.sampleMarker &&
    Array.isArray(apiData?.notes) &&
    apiData.notes.length === 4 &&
    apiData.notes.every(
      (note) =>
        typeof note?.title === 'string' &&
        typeof note?.content === 'string'
    );

  const staticResponse = await request('/data.json');
  const staticRemoved = staticResponse.status === 404;

  const identityResponse = await request('/aleph.json');
  const identityData = await readJson(identityResponse);
  const identityValid =
    identityResponse.status === 200 &&
    identityData?.schema === 'aleph.defense.deployment.v1' &&
    identityData?.step === 2 &&
    identityData?.repoUrl === config.repoUrl &&
    identityData?.judgeIssuer === config.judgeIssuer &&
    identityData?.sampleMarker === config.sampleMarker &&
    /^[0-9a-f]{40}$/i.test(identityData?.commit ?? '');

  const pageResponse = await request('/');
  const headerValid =
    pageResponse.status === 200 &&
    pageResponse.headers
      .get('x-content-type-options')
      ?.toLowerCase() === 'nosniff';

  return [
    {
      attackId: 'anonymous_api_note_read',
      expected: '2단계에서는 비로그인 API 요청으로 가상 메모 4개 확인',
      observed: apiVisible
        ? '통과: API 응답에서 확인 표시와 가상 메모 4개 확인'
        : `실패: API 응답 조건 불충족 (HTTP ${apiResponse.status})`,
    },
    {
      attackId: 'static_note_file_removed',
      expected: '기존 /data.json 요청은 HTTP 404',
      observed: staticRemoved
        ? '통과: /data.json은 HTTP 404'
        : `실패: /data.json이 HTTP ${staticResponse.status} 반환`,
    },
    {
      attackId: 'deployment_identity',
      expected: '/aleph.json에서 2단계 배포 식별 정보 확인',
      observed: identityValid
        ? '통과: 2단계 배포 식별 정보 확인'
        : `실패: 배포 식별 정보 조건 불충족 (HTTP ${identityResponse.status})`,
    },
    {
      attackId: 'page_security_header',
      expected: '첫 화면이 HTTP 200이며 nosniff 헤더 제공',
      observed: headerValid
        ? '통과: 첫 화면 HTTP 200 및 nosniff 헤더 확인'
        : `실패: 첫 화면 또는 헤더 조건 불충족 (HTTP ${pageResponse.status})`,
    },
  ];
}