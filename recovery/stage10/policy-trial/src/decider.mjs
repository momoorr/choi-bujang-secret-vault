export const RULE_IDS = Object.freeze([
  'device_registered',
  'step_up_required',
  'resource_scope',
]);

export async function decide(request) {
  const respond = (decision, reasonCode, ruleIds) => ({
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision,
    reasonCode,
    ruleIds,
  });

  if (request.deviceRegistered !== true) {
    return respond('deny', 'device_not_registered', [
      'device_registered',
    ]);
  }


  // 서비스·메서드·실제 경로·엔진의 경로 모양을 함께 확인합니다.
  const path = request.path;
  const route = request.route;
  const method = request.method;

  const notePaths = ['/notes', '/api/notes'];
  const noticePaths = ['/notices', '/api/notices'];

  const reservedIds = new Set([
    'export', 'search', 'bulk', 'all', 'list',
  ]);

  const singleResource = (base) => {
    if (typeof path !== 'string' || !path.startsWith(base + '/')) {
      return false;
    }

    const id = path.slice(base.length + 1);

    return id.length > 0 &&
      !/[\/\\%?#\s]/u.test(id) &&
      !reservedIds.has(id.toLowerCase()) &&
      route === `${method} ${base}/:id`;
  };

  const noteRead =
    request.service === 'notes' &&
    method === 'GET' &&
    notePaths.some(singleResource);

  const noticeRead =
    request.service === 'notices' &&
    method === 'GET' &&
    noticePaths.some((base) =>
      (path === base && route === `GET ${base}`) ||
      singleResource(base)
    );

  if (!noteRead && !noticeRead) {
    return respond('deny', 'resource_not_allowed', [
      'device_registered',
      'resource_scope',
    ]);
  }

  const signals = request.signals;
  const events = Array.isArray(request.recentEvents)
    ? request.recentEvents
    : [];

  // 가상 신호를 실제 위치나 네트워크 증거로 취급하지 않습니다.
  const fixtureSource = signals?.source === 'judge_fixture';

  const unusualHour =
    Number.isInteger(signals?.hour) &&
    signals.hour >= 0 &&
    signals.hour < 6;

  const unusualNetwork = signals?.network === 'unusual';

  const bulkAccess = events.some((event) =>
    event?.kind === 'risk_signal' &&
    Number.isFinite(event.ageSeconds) &&
    event.ageSeconds >= 0 &&
    event.ageSeconds <= 300 &&
    Number.isInteger(event.count) &&
    event.count >= 20
  );

  const suspicious =
    fixtureSource && unusualHour && unusualNetwork && bulkAccess;

  const stepUp = request.stepUp;
  const recentlyVerified =
    stepUp?.verified === true &&
    Number.isFinite(stepUp.authAgeSeconds) &&
    stepUp.authAgeSeconds >= 0 &&
    stepUp.authAgeSeconds <= 900;

  if (suspicious && !recentlyVerified) {
    return respond('step_up', 'step_up_required', [
      'device_registered',
      'step_up_required',
    ]);
  }

  return respond('allow', 'approved', ['device_registered']);
}