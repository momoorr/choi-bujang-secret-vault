const sourceNames = {
  actual_http: '실제 HTTP',
  local_fixture: '가상 입력',
  local_artifact: '로컬 파일 검증',
  not_run: '미실행',
};

const resultNames = {
  passed: '통과',
  failed: '실패',
  error: '오류',
  not_run: '미실행',
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function node(tag, text) {
  const result = document.createElement(tag);
  if (text !== undefined) result.textContent = text;
  return result;
}

function timeText(value) {
  return value
    ? new Date(value).toLocaleString('ko-KR')
    : '미실행';
}

function validRow(row, runId) {
  if (
    !row ||
    row.run_id !== runId ||
    !Number.isInteger(row.stage) ||
    row.stage < 1 ||
    row.stage > 12 ||
    typeof row.check_id !== 'string' ||
    !/^s(?:[1-9]|1[0-2])_[a-z0-9_]+$/.test(row.check_id) ||
    !Object.hasOwn(sourceNames, row.source) ||
    !Object.hasOwn(resultNames, row.result) ||
    typeof row.expected !== 'string' ||
    typeof row.observed !== 'string' ||
    (
      row.request_id !== null &&
      !UUID.test(row.request_id ?? '')
    ) ||
    (
      row.http_status !== null &&
      (
        !Number.isInteger(row.http_status) ||
        row.http_status < 100 ||
        row.http_status > 599
      )
    ) ||
    (
      row.deployment_commit !== null &&
      !/^[0-9a-f]{40}$/i.test(row.deployment_commit ?? '')
    )
  ) {
    return false;
  }

  if (row.result === 'not_run') {
    return (
      row.source === 'not_run' &&
      row.checked_at === null &&
      row.request_id === null &&
      row.http_status === null
    );
  }

  return (
    row.source !== 'not_run' &&
    typeof row.checked_at === 'string' &&
    Number.isFinite(Date.parse(row.checked_at)) &&
    (
      row.source === 'actual_http' ||
      row.http_status === null
    )
  );
}

function countsText(rows) {
  return ['passed', 'failed', 'error']
    .map((result) =>
      `${resultNames[result]} ${
        rows.filter((row) => row.result === result).length
      }건`
    )
    .join(' · ');
}

export function createChecksView({ root, load, runTask }) {
  let revision = 0;
  let savedReport = null;

  root.append(node('h3', '1~11단계 현재 상태 재점검'));

  root.append(node(
    'p',
    '현재 방어 상태를 점검합니다. 운영 엔진의 41종 총공세 결과는 별도로 확인합니다.'
  ));

  const runButton = node('button', '재점검 실행');
  const readButton = node('button', '저장 기록 불러오기');
  const downloadButton = node('button', '표 JSON 내려받기');

  for (const button of [
    runButton, readButton, downloadButton,
  ]) {
    button.type = 'button';
  }

  const content = node('div');
  content.setAttribute('aria-live', 'polite');

  root.append(runButton, readButton, downloadButton, content);

  function clear() {
    ++revision;
    savedReport = null;
    downloadButton.hidden = true;

    content.replaceChildren(
      node('p', '기기 인증 후 저장 기록을 조회하세요.')
    );
  }

  function render(data) {
    if (
      data?.schema !== 'vault.operation-checks.v1' ||
      !Array.isArray(data.checks)
    ) {
      throw new Error('점검 기록 형식을 확인하지 못했습니다.');
    }

    if (data.status === 'not_run') {
      if (data.checks.length !== 0) {
        throw new Error('미실행 응답과 기록 수가 다릅니다.');
      }

      savedReport = null;
      downloadButton.hidden = true;

      content.replaceChildren(
        node('p', '이 계정에 저장된 재점검 결과가 없습니다.')
      );
      return;
    }

    if (
      data.status !== 'stored' ||
      !UUID.test(data.runId ?? '') ||
      data.checks.length === 0 ||
      !data.checks.every((row) => validRow(row, data.runId)) ||
      new Set(data.checks.map(
        (row) => row.check_id
      )).size !== data.checks.length
    ) {
      throw new Error('점검 기록의 식별 정보나 결과가 올바르지 않습니다.');
    }

    // 내려받기에도 허용한 항목만 포함합니다.
    const checks = data.checks.map((row) => ({
      run_id: row.run_id,
      stage: row.stage,
      check_id: row.check_id,
      source: row.source,
      expected: row.expected,
      observed: row.observed,
      result: row.result,
      http_status: row.http_status,
      request_id: row.request_id,
      checked_at: row.checked_at,
      deployment_commit: row.deployment_commit,
    }));

    savedReport = {
      schema: data.schema,
      runId: data.runId,
      checks,
    };

    downloadButton.hidden = false;

    const actual = checks.filter(
      (row) => row.source === 'actual_http'
    );

    const fixtures = checks.filter(
      (row) => row.source === 'local_fixture'
    );

    const notRunCount = checks.filter(
      (row) => row.result === 'not_run'
    ).length;

    const commits = [...new Set(
      checks.map((row) => row.deployment_commit)
        .filter(Boolean)
    )];

    const wrapper = node('div');
    wrapper.style.overflowX = 'auto';

    const table = node('table');
    table.style.minWidth = '1100px';
    table.style.borderCollapse = 'collapse';

    const head = node('thead');
    const heading = node('tr');

    for (const title of [
      '단계', '출처', '결과', '기대',
      '관찰', '요청 ID', '확인 시각',
    ]) {
      const cell = node('th', title);
      cell.scope = 'col';
      heading.append(cell);
    }

    head.append(heading);

    const body = node('tbody');

    for (const row of checks) {
      const line = node('tr');

      const values = [
        String(row.stage),
        sourceNames[row.source],
        resultNames[row.result],
        row.expected,
        row.observed,
        row.request_id ?? (
          row.source === 'actual_http'
            ? '서버 미제공'
            : '해당 없음'
        ),
        timeText(row.checked_at),
      ];

      for (const value of values) {
        line.append(node('td', value));
      }

      body.append(line);
    }

    table.append(head, body);

    for (const cell of table.querySelectorAll('th, td')) {
      cell.style.padding = '10px';
      cell.style.textAlign = 'left';
      cell.style.verticalAlign = 'top';
      cell.style.borderBottom = '1px solid #51667c';
      cell.style.overflowWrap = 'anywhere';
    }

    wrapper.append(table);

    content.replaceChildren(
      node('p', `점검 실행 묶음 ID: ${data.runId}`),
      node(
        'p',
        `기록 생성 배포 커밋: ${
          commits.length ? commits.join(', ') : '확인 불가'
        }`
      ),
      node('p', `실제 HTTP: ${countsText(actual)}`),
      node('p', `가상 입력: ${countsText(fixtures)}`),
      node('p', `미실행: ${notRunCount}건`),
      wrapper
    );
  }

  async function refresh(run = false) {
    const expectedRevision = ++revision;

    savedReport = null;
    downloadButton.hidden = true;

    content.replaceChildren(node(
      'p',
      run
        ? '서버에서 점검하고 결과를 저장하는 중입니다.'
        : '저장된 점검 기록을 불러오는 중입니다.'
    ));

    try {
      const result = await load(run);

      if (expectedRevision !== revision) return;

      if (
        result?.httpStatus !== 200 ||
        !UUID.test(result.requestId ?? '') ||
        result.data?.requestId !== result.requestId
      ) {
        throw new Error('점검 API 응답을 확인하지 못했습니다.');
      }

      render(result.data);
    } catch (error) {
      if (expectedRevision === revision) {
        content.replaceChildren(node(
          'p',
          error.message || '점검 기록 조회에 실패했습니다.'
        ));
      }

      throw error;
    }
  }

  runButton.addEventListener('click', () => {
    void runTask(() => refresh(true));
  });

  readButton.addEventListener('click', () => {
    void runTask(() => refresh(false));
  });

  downloadButton.addEventListener('click', () => {
    if (!savedReport) return;

    const blob = new Blob(
      [JSON.stringify(savedReport, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const link = node('a');

    link.href = url;
    link.download = 'operations-checks.json';
    document.body.append(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  clear();

  return { clear, refresh };
}