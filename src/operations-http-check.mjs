import { BACKUP_SHA256 } from './note-recovery.mjs';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function validId(value) {
  return (
    (typeof value === 'string' || typeof value === 'number') &&
    /^[1-9][0-9]{0,18}$/.test(String(value)) &&
    !(typeof value === 'number' && !Number.isSafeInteger(value))
  );
}

function validShape(shape, response, data, config, noteId) {
  if (shape === 'status') return true;

  if (shape === 'html') {
    return response.headers
      .get('content-type')
      ?.toLowerCase()
      .includes('text/html') === true;
  }

  if (
    !response.headers.get('content-type')
      ?.toLowerCase().includes('application/json')
  ) {
    return false;
  }

  if (shape === 'error') {
    return (
      typeof data?.error === 'string' &&
      !Object.hasOwn(data, 'notes') &&
      !Object.hasOwn(data, 'body')
    );
  }

  if (shape === 'notes') {
    return (
      Array.isArray(data?.notes) &&
      data.sampleMarker === config.sampleMarker
    );
  }

  if (shape === 'note') {
    return (
      data &&
      !Array.isArray(data) &&
      Object.keys(data).sort().join(',') === 'body,id,title' &&
      String(data.id) === String(noteId) &&
      typeof data.title === 'string' &&
      typeof data.body === 'string'
    );
  }

  if (shape === 'restore_plan') {
    return (
      String(data?.targetId) === '6' &&
      data.ownerMatches === true &&
      data.backupHash === BACKUP_SHA256 &&
      typeof data.changed === 'boolean' &&
      data.scope === 'single_note'
    );
  }

  return false;
}

export async function runHttpCheck(spec, context) {
  const {
    config,
    authorization,
    deviceToken,
    ownNoteId,
    otherNoteId,
    restoreEligibility,
    fetcher = fetch,
  } = context;

  let app;

  try {
    app = new URL(config.publicAppUrl);

    if (
      app.protocol !== 'https:' ||
      app.username ||
      app.password ||
      app.pathname !== '/' ||
      app.search ||
      app.hash
    ) {
      throw new Error('invalid_app_url');
    }
  } catch {
    return notRun(spec, '배포 주소를 검증하지 못해 실행하지 않았습니다.');
  }

  let path;
  let method = 'GET';
  let noteId = null;
  let target = null;

  switch (spec.target) {
    case 'home':
      path = '/';
      break;

    case 'static_notes':
      path = '/data.json';
      break;

    case 'notes_list':
      path = '/api/notes';
      break;

    case 'own_note':
      if (!validId(ownNoteId)) {
        return notRun(spec, '현재 계정의 시험 대상 메모가 없습니다.');
      }
      noteId = ownNoteId;
      path = '/api/notes/' + encodeURIComponent(String(noteId));
      break;

    case 'other_note':
      if (!validId(otherNoteId)) {
        return notRun(spec, '다른 소유자의 시험 대상 메모가 없습니다.');
      }
      noteId = otherNoteId;
      path = '/api/notes/' + encodeURIComponent(String(noteId));
      break;

    case 'restore_plan':
      if (
        spec.mode === 'approved' &&
        restoreEligibility !== 'owner'
      ) {
        return notRun(
          spec,
          restoreEligibility === 'other_owner'
            ? '현재 계정이 복원 백업의 소유자가 아닙니다.'
            : '복원 백업 설정을 확인하지 못했습니다.'
        );
      }

      path = '/api/restore';
      method = 'POST';
      break;

    case 'original_keyless':
      try {
        const issuer = new URL(config.identityProvider.issuer);
        const expected = issuer.origin + '/rest/v1/notes';

        if (
          config.originalApiUrl !== expected ||
          spec.mode !== 'anonymous'
        ) {
          throw new Error('invalid_original_url');
        }

        target = new URL(expected);
        path = '/rest/v1/notes';
      } catch {
        return notRun(spec, '원본 API 주소를 검증하지 못했습니다.');
      }
      break;

    default:
      return notRun(spec, '등록되지 않은 점검 대상입니다.');
  }

  const headers = {};

  if (spec.mode === 'approved' || spec.mode === 'login_only') {
    if (typeof authorization !== 'string' || !authorization) {
      return notRun(spec, '검증된 로그인 정보가 없습니다.');
    }

    headers.Authorization = authorization;
  }

  if (spec.mode === 'approved') {
    if (typeof deviceToken !== 'string' || !deviceToken) {
      return notRun(spec, '검증된 기기 접속 증표가 없습니다.');
    }

    headers['X-Vault-Device'] = deviceToken;
  }

  if (spec.mode === 'malformed') {
    headers.Authorization = 'Bearer invalid-token';
  }

  let body;

  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    headers.Origin = app.origin;
    body = JSON.stringify({ action: 'plan' });
  }

  try {
    const response = await fetcher(
      target ?? new URL(path, app),
      {
        method,
        headers,
        body,
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      }
    );

    let data = null;

    if (!['status', 'html'].includes(spec.shape)) {
      data = await response.json().catch(() => null);
    } else if (response.body) {
      await response.body.cancel().catch(() => {});
    }

    const statusMatches =
      response.status === spec.expectedStatus;

    const shapeMatches = validShape(
      spec.shape, response, data, config, noteId
    );

    const rawRequestId = response.headers.get('x-request-id');
    const requestId = UUID.test(rawRequestId ?? '')
      ? rawRequestId
      : null;

    return {
      stage: spec.stage,
      check_id: spec.checkId,
      source: 'actual_http',
      expected: spec.expected,
      observed:
        `${method} ${path} · HTTP ${response.status} · ` +
        `응답 조건 ${shapeMatches ? '충족' : '불충족'}` +
        (requestId ? '' : ' · 서버 요청 ID 미제공'),
      result: statusMatches && shapeMatches
        ? 'passed'
        : 'failed',
      http_status: response.status,
      request_id: requestId,
      checked_at: new Date().toISOString(),
    };
  } catch {
    return {
      stage: spec.stage,
      check_id: spec.checkId,
      source: 'actual_http',
      expected: spec.expected,
      observed: `${method} ${path} · 요청 또는 응답 처리 실패`,
      result: 'error',
      http_status: null,
      request_id: null,
      checked_at: new Date().toISOString(),
    };
  }
}