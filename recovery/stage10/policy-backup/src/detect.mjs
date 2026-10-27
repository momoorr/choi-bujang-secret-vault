// 엔진이 검증한 사건을 대상으로 회수 제안만 반환합니다.
// 토큰·메모 내용·이메일을 저장하거나 출력하지 않습니다.
export function detect(events) {
  if (!Array.isArray(events)) {
    throw new TypeError('invalid_detection_events');
  }

  const readsBySubject = new Map();

  for (const event of events) {
    if (event?.method !== 'GET') continue;

    const subject = event.identity?.sub;
    if (typeof subject !== 'string' || subject.length === 0) {
      continue;
    }

    if (typeof event.at !== 'string') continue;

    const time = Date.parse(event.at);
    if (!Number.isFinite(time)) continue;

    if (!readsBySubject.has(subject)) {
      readsBySubject.set(subject, []);
    }

    readsBySubject.get(subject).push(time);
  }

  const windowMilliseconds = 10 * 60 * 1000;

  for (const [subject, times] of readsBySubject) {
    times.sort((a, b) => a - b);

    let left = 0;

    for (let right = 0; right < times.length; right += 1) {
      while (times[right] - times[left] > windowMilliseconds) {
        left += 1;
      }

      if (right - left + 1 > 120) {
        return {
          action: 'propose_revocation',
          reasonCode: 'burst_read',
          subject,
        };
      }
    }
  }

  return { action: 'observe' };
}