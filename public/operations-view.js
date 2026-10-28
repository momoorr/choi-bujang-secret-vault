import { createChecksView } from './operations-checks-view.js';
function element(tag, text) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function showTime(value) {
  const time = typeof value === 'string'
    ? Date.parse(value)
    : NaN;

  return Number.isFinite(time)
    ? new Date(time).toLocaleString('ko-KR')
    : '확인 가능한 기록 없음';
}

function section(title, lines) {
  const root = element('section');
  root.append(element('h3', title));

  for (const line of lines) {
    root.append(element('p', line));
  }

  return root;
}

export function createOperationsView({
  root,
  load,
  loadChecks,
  runTask,
}) {
  let revision = 0;

  const refreshButton = element('button', '작전실 새로 확인');
  refreshButton.type = 'button';

  const content = element('div');
  content.setAttribute('aria-live', 'polite');

  root.append(refreshButton, content);

  const checksRoot = element('section');
  root.append(checksRoot);

  const checksView = createChecksView({
    root: checksRoot,
    load: loadChecks,
    runTask,
  });

  function clear() {
    ++revision;
    checksView.clear();
    content.replaceChildren(
      element('p', '인증 후 서버 기록을 조회하세요.')
    );
  }

  async function refresh() {
    const expectedRevision = ++revision;

    content.replaceChildren(
      element('p', '서버 요약을 확인하는 중입니다.')
    );

    let result;

    try {
      result = await load();

      if (expectedRevision !== revision) return;

      const data = result?.data;

      if (
        result.httpStatus !== 200 ||
        data?.schema !== 'vault.operations.v1' ||
        typeof result.requestId !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(result.requestId) ||
        data.requestId !== result.requestId ||
        !Number.isFinite(Date.parse(data.checkedAt)) ||
        !Array.isArray(data.policy?.ruleIds) ||
        data.policy.ruleIds.some(
          (id) => typeof id !== 'string'
        )
      ) {
        throw new Error('작전실 응답 형식을 확인하지 못했습니다.');
      }

      const blocks = [
        section('이번 요약 요청', [
          `실제 API 결과: HTTP ${result.httpStatus}`,
          `요청 ID: ${result.requestId}`,
          `서버 확인 시각: ${showTime(data.checkedAt)}`,
        ]),
        section('학생 판정기 규칙', [
          '출처: 서버가 불러온 학생 판정기 코드',
          `구현된 규칙 수: ${data.policy.ruleIds.length}`,
          `규칙: ${data.policy.ruleIds.join(', ')}`,
          '운영 엔진의 실제 판정 이력: 미연결',
        ]),
      ];

      const devices = data.devices;
      const counts = devices?.counts;

      if (
        devices?.status === 'ok' &&
        ['pending', 'approved', 'revoked'].every(
          (key) => Number.isSafeInteger(counts?.[key]) &&
            counts[key] >= 0
        )
      ) {
        blocks.push(section('내 기기의 현재 상태', [
          '출처: 현재 로그인 계정의 실제 DB 행',
          `승인 대기: ${counts.pending}개`,
          `승인됨: ${counts.approved}개`,
          `철회 상태: ${counts.revoked}개`,
          '위 숫자는 현재 상태이며 누적 회수 횟수가 아닙니다.',
          '과거 기기 승인·철회 이력: 별도 저장 기록 없음',
        ]));
      } else {
        blocks.push(section('내 기기의 현재 상태', [
          '조회 실패 또는 응답 확인 불가',
          '확인하지 못한 값을 0건으로 표시하지 않습니다.',
        ]));
      }

      blocks.push(section('탐지와 운영 접속 회수', [
        '운영 엔진의 실제 탐지 사건: 미연결',
        '운영 접속 회수 실행 결과: 미연결',
        '로컬 가상 사건 연습 결과를 실제 차단 결과로 표시하지 않습니다.',
      ]));

      const recovery = data.recovery;

      if (
        recovery?.status === 'verified' &&
        Number.isSafeInteger(recovery.verifiedFiles) &&
        Number.isSafeInteger(recovery.restoreRecords)
      ) {
        blocks.push(section('정책 백업과 로컬 시험 복원', [
          '출처: 서버에 포함된 백업 파일과 로컬 시험 감사 기록',
          `백업 기준 커밋: ${recovery.baselineCommit}`,
          `SHA-256 일치 파일: ${recovery.verifiedFiles}개`,
          `로컬 시험 사본 복원 기록: ${recovery.restoreRecords}건`,
          `마지막 기록 시각: ${showTime(recovery.lastRestoreAt)}`,
          '범위: 로컬 정책 시험 사본',
          '실제 DB 메모 복원 이력 조회: 미연결',
        ]));
      } else {
        blocks.push(section('정책 백업과 로컬 시험 복원', [
          '백업 파일 또는 감사 기록을 검증하지 못했습니다.',
          '복원 성공으로 표시하지 않습니다.',
        ]));
      }

      content.replaceChildren(...blocks);
      await checksView.refresh(false).catch(() => {});
    } catch (error) {
      if (expectedRevision === revision) {
        content.replaceChildren(
          element(
            'p',
            error.message || '작전실 조회에 실패했습니다.'
          )
        );
      }

      throw error;
    }
  }

  refreshButton.addEventListener('click', () => {
    void runTask(refresh);
  });

  clear();

  return { clear, refresh };
}