// 이 파일은 학생이 같은 프로젝트에서 이어서 구현합니다.
// 제공 UI를 받은 것만으로 단계 완료를 인정하지 않습니다.
export function createStudentView() {
  return {
    renderIdentity({ me, devices, sessions }) {
      const root = document.createElement('section');
      const deviceNames = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      };
      const sessionNames = {
        active: '활성',
        expired: '만료',
        revoked: '철회됨',
        unknown: '확인 불가',
      };
      const modeNames = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가',
      };
      const shown = (value) =>
        value === undefined || value === null || value === ''
          ? '확인 불가'
          : String(value);

      const addLine = (text) => {
        const line = document.createElement('p');
        line.textContent = text;
        root.appendChild(line);
      };

      const renderResource = (title, resource, renderData) => {
        if (!resource || typeof resource !== 'object') {
          addLine(`${title}: 확인 불가`);
          return;
        }
        if (Object.hasOwn(modeNames, resource.mode)) {
          addLine(`${title} · ${modeNames[resource.mode]}`);
        }
        if (resource.status === 'loading') {
          addLine(`${title}: 불러오는 중`);
        } else if (resource.status === 'error') {
          addLine(`${title}: 연결 실패: ${shown(resource.error?.message)}`);
        } else if (resource.status === 'ok') {
          renderData(resource.data);
        } else {
          addLine(`${title}: 확인 불가`);
        }
      };

      const showDevice = (title, device) => {
        const status = Object.hasOwn(deviceNames, device?.status)
          ? deviceNames[device.status]
          : deviceNames.unknown;
        addLine(`${title}: ${shown(device?.label)} · ID: ${shown(device?.id)} · ${status}`);
      };
      const showSession = (title, session) => {
        const status = Object.hasOwn(sessionNames, session?.status)
          ? sessionNames[session.status]
          : sessionNames.unknown;
        addLine(`${title}: ${shown(session?.id)} · ${status}`);
      };

      renderResource('현재 계정', me, (data) => {
        addLine(`사용자: ${shown(data?.user?.label)} · ID: ${shown(data?.user?.id)}`);
        showDevice('현재 기기', data?.device);
        showSession('현재 세션', data?.session);
      });
      renderResource('기기 목록', devices, (data) => {
        if (!Array.isArray(data)) {
          addLine('기기 목록: 확인 불가');
          return;
        }
        if (data.length === 0) addLine('기기 목록: 항목 없음');
        for (const device of data) showDevice('기기', device);
      });
      renderResource('세션 목록', sessions, (data) => {
        if (!Array.isArray(data)) {
          addLine('세션 목록: 확인 불가');
          return;
        }
        if (data.length === 0) addLine('세션 목록: 항목 없음');
        for (const session of data) showSession('세션', session);
      });
      return root;
    },
    renderDecision({ status, mode, data, error, appId }) {
      const root = document.createElement('section');
      const decisionNames = {
        allow: '접근 허용(allow)',
        deny: '접근 거부(deny)',
        challenge: '추가 확인 필요(challenge)',
        unknown: '판정 확인 불가(unknown)',
      };
      const modeNames = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가',
      };
      const shown = (value) =>
        value === undefined || value === null || value === ''
          ? '확인 불가'
          : String(value);
      const addLine = (text) => {
        const line = document.createElement('p');
        line.textContent = text;
        root.appendChild(line);
      };

      if (Object.hasOwn(modeNames, mode)) {
        addLine(`데이터 상태: ${modeNames[mode]}`);
      }

      if (status === 'idle') {
        addLine('업무 앱을 골라 접속을 요청하세요.');
        return root;
      }

      const selectedAppId = status === 'ok'
        ? data?.appId ?? appId
        : appId;
      addLine(`업무 앱 ID: ${shown(selectedAppId)}`);

      if (status === 'loading') {
        addLine('판정 확인 중');
      } else if (status === 'error') {
        addLine(`요청 실패: ${shown(error?.message)}`);
        addLine('요청 실패는 접근 거부나 접근 허용 판정이 아닙니다.');
      } else if (status === 'ok') {
        const decision = Object.hasOwn(decisionNames, data?.decision)
          ? data.decision
          : 'unknown';
        addLine(`접근 판정: ${decisionNames[decision]}`);
        addLine(`판정 이유: ${shown(data?.reason)}`);
        addLine(`판정 시각: ${shown(data?.checkedAt)}`);

        if (decision === 'allow') {
          addLine('정책상 접근 허용이며 실제 앱 접속 성공을 보장하지 않습니다.');
        } else if (decision === 'challenge') {
          addLine('추가 인증 또는 확인이 필요합니다. 이 앱은 해당 절차를 대신 수행하지 않습니다.');
        } else if (decision === 'unknown') {
          addLine('접근 판정을 확인할 수 없습니다.');
        }
      } else {
        addLine('판정 확인 불가(unknown)');
      }

      return root;
    },
    renderEvents({ status, mode, data, error }) {
      const root = document.createElement('section');
      const modeNames = {
        demo: '예제 자료',
        disconnected: '연결 없음',
        unknown: '확인 불가',
      };
      const kindNames = { access: '접속 기록', xdr: 'XDR 경보' };
      const accessNames = {
        allowed: '허용됨', denied: '거부됨', unknown: '확인 불가',
      };
      const sessionNames = {
        active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가',
      };
      const deviceNames = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      };
      const shown = (value) =>
        value === undefined || value === null || value === ''
          ? '확인 불가'
          : String(value);
      const appText = (value) =>
        value === undefined || value === null || value === ''
          ? '앱을 확인할 수 없습니다.'
          : String(value);
      const stateText = (names, value) => {
        const code = typeof value === 'string' && value ? value : 'unknown';
        const label = Object.hasOwn(names, code) ? names[code] : '확인 불가';
        return `${label}(${code})`;
      };
      const addLine = (parent, text) => {
        const line = document.createElement('p');
        line.textContent = text;
        parent.appendChild(line);
      };

      if (Object.hasOwn(modeNames, mode)) {
        addLine(root, `데이터 상태: ${modeNames[mode]}`);
      }
      addLine(root, '조회 범위: 본인의 최근 기록(최대 40건). XDR 경보는 서버에 저장된 경보입니다.');

      if (status === 'loading') {
        addLine(root, '기록을 불러오는 중입니다.');
        return root;
      }
      if (status === 'error') {
        addLine(root, `기록을 불러오지 못했습니다: ${shown(error?.message)}`);
        if (error?.code === 'CONTRACT_MISMATCH') {
          addLine(root, '응답 형식 확인 불가(CONTRACT_MISMATCH)');
        }
        return root;
      }
      if (
        status !== 'ok' ||
        !Array.isArray(data) ||
        data.some((event) => !event || typeof event !== 'object')
      ) {
        addLine(root, '기록을 확인할 수 없습니다(CONTRACT_MISMATCH).');
        return root;
      }

      const records = [...data].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      const makeFilter = (name, values, describe) => {
        const label = document.createElement('label');
        label.textContent = name;
        const select = document.createElement('select');
        select.setAttribute('aria-label', name);
        const all = document.createElement('option');
        all.value = 'all';
        all.textContent = '전체';
        select.appendChild(all);
        for (const value of new Set(values)) {
          if (typeof value !== 'string' || value === '' || value === 'all') continue;
          const option = document.createElement('option');
          option.value = value;
          option.textContent = describe(value);
          select.appendChild(option);
        }
        select.value = 'all';
        label.appendChild(select);
        root.appendChild(label);
        return select;
      };

      const kindFilter = makeFilter(
        '기록 종류', records.map((event) => event.kind),
        (value) => stateText(kindNames, value)
      );
      const appFilter = makeFilter(
        '업무 앱', records.map((event) => event.appId), (value) => value
      );
      const accessFilter = makeFilter(
        '접속 상태', records.map((event) => event.state?.access),
        (value) => stateText(accessNames, value)
      );
      const count = document.createElement('p');
      count.setAttribute('aria-live', 'polite');
      const empty = document.createElement('p');
      const list = document.createElement('ul');
      const detail = document.createElement('section');
      root.appendChild(count);
      root.appendChild(empty);
      root.appendChild(list);
      root.appendChild(detail);

      const showEntries = (title, entries) => {
        const heading = document.createElement('h4');
        heading.textContent = title;
        detail.appendChild(heading);
        if (!Array.isArray(entries)) {
          addLine(detail, '확인 불가');
          return;
        }
        if (entries.length === 0) {
          addLine(detail, '없음');
          return;
        }
        const entriesList = document.createElement('ul');
        for (const entry of entries) {
          const item = document.createElement('li');
          item.textContent = `ID: ${shown(entry?.id)} · ${shown(entry?.text)}`;
          entriesList.appendChild(item);
        }
        detail.appendChild(entriesList);
      };

      const showDetail = (event) => {
        detail.replaceChildren();
        detail.setAttribute('data-student-event-detail', event.id);
        addLine(detail, `사건 ID: ${shown(event.id)}`);
        addLine(detail, `업무 앱: ${appText(event.appId)}`);
        showEntries('근거(evidence)', event.evidence);
        showEntries('규칙(rules)', event.rules);
        addLine(detail, `접속 상태: ${stateText(accessNames, event.state?.access)}`);
        addLine(detail, `세션 상태: ${stateText(sessionNames, event.state?.session)}`);
        addLine(detail, `기기 상태: ${stateText(deviceNames, event.state?.device)}`);
        if (Array.isArray(event.supportedActions) && event.supportedActions.length > 0) {
          addLine(detail, '조치 실행 연결은 준비 중입니다. 아직 지원하지 않는 조치이며 요청을 보내지 않습니다.');
          for (const action of event.supportedActions) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `${action} 미지원`;
            button.disabled = true;
            detail.appendChild(button);
          }
        }
      };

      const renderList = () => {
        const visible = records.filter((event) =>
          (kindFilter.value === 'all' || event.kind === kindFilter.value) &&
          (appFilter.value === 'all' || event.appId === appFilter.value) &&
          (accessFilter.value === 'all' || event.state?.access === accessFilter.value)
        );
        list.replaceChildren();
        detail.replaceChildren();
        detail.removeAttribute('data-student-event-detail');
        count.textContent = `표시: ${visible.length}건 / 전달받은 기록: ${records.length}건`;
        empty.textContent = visible.length > 0 ? ''
          : records.length === 0 ? '표시할 기록이 없습니다.'
          : '필터 조건에 맞는 기록이 없습니다.';

        for (const event of visible) {
          const row = document.createElement('li');
          row.setAttribute('data-student-event-id', event.id);
          addLine(row, `사건 ID: ${shown(event.id)}`);
          addLine(row, `시각: ${shown(event.at)}`);
          addLine(row, `종류: ${stateText(kindNames, event.kind)}`);
          addLine(row, `업무 앱: ${appText(event.appId)}`);
          addLine(row, `요약: ${shown(event.summary)}`);
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = `${event.id} 상세`;
          button.addEventListener('click', () => showDetail(event));
          row.appendChild(button);
          list.appendChild(row);
        }
      };

      for (const filter of [kindFilter, appFilter, accessFilter]) {
        filter.addEventListener('change', renderList);
      }
      renderList();
      return root;
    },
    renderStatus({ devices, sessions, notifications, diagnostics, mode }) {
      const root = document.createElement('section');
      const modeNames = {
        demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가',
      };
      const deviceNames = {
        compliant: '보안 기준 충족',
        noncompliant: '보안 기준 미충족',
        unknown: '확인 불가',
      };
      const sessionNames = {
        active: '활성', expired: '만료', revoked: '철회됨', unknown: '확인 불가',
      };
      const safeText = (value) => {
        if (!['string', 'number', 'boolean'].includes(typeof value) || value === '') {
          return '확인 불가';
        }
        const text = String(value);
        const secretPattern = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+\S+|\b(?:sk-|sb_secret_)[A-Za-z0-9_-]+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|(?:password|passwd|token|secret|api[_ -]?key|비밀번호|토큰|API\s*키)\s*[:=]\s*\S+/i;
        return secretPattern.test(text) ? '비밀값 의심 정보 숨김' : text;
      };
      const addLine = (parent, text) => {
        const line = document.createElement('p');
        line.textContent = text;
        parent.appendChild(line);
        return line;
      };
      const section = (title) => {
        const part = document.createElement('section');
        const heading = document.createElement('h4');
        heading.textContent = title;
        part.appendChild(heading);
        root.appendChild(part);
        return part;
      };
      const showMode = (part, value) => {
        if (Object.hasOwn(modeNames, value)) {
          addLine(part, `데이터 상태: ${modeNames[value]}`);
        }
      };
      const stateText = (names, value) => {
        const code = typeof value === 'string' && value ? value : 'unknown';
        const label = Object.hasOwn(names, code) ? names[code] : '확인 불가';
        return `${label}(${safeText(code)})`;
      };
      const showFailure = (part, title, error) => {
        const timeout = typeof error?.code === 'string' && /(?:^|_)TIMEOUT$/.test(error.code);
        addLine(part, `${title}를 불러오지 못했습니다${timeout ? '(시간 초과)' : ''}: ${safeText(error?.message)}`);
        addLine(part, `오류 코드: ${safeText(error?.code)}`);
        if (error?.code === 'CONTRACT_MISMATCH') {
          addLine(part, '응답 형식 확인 불가(CONTRACT_MISMATCH)');
        }
        addLine(part, title === '진단 정보'
          ? '다시 시도하려면 제공 화면의 도움정보 불러오기 버튼을 직접 누르세요.'
          : '다시 시도는 위쪽 다시 불러오기 버튼을 직접 누르세요.');
      };
      const showList = (title, resource, emptyText, renderRow) => {
        const part = section(title);
        showMode(part, resource?.mode);
        if (resource?.status === 'loading') {
          addLine(part, `${title}: 불러오는 중`);
        } else if (resource?.status === 'error') {
          showFailure(part, title, resource.error);
        } else if (resource?.status === 'ok' && Array.isArray(resource.data)) {
          if (resource.data.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) {
            addLine(part, `${title}: 확인 불가(CONTRACT_MISMATCH)`);
          } else if (resource.data.length === 0) {
            addLine(part, emptyText);
          } else {
            const list = document.createElement('ul');
            for (const row of resource.data) {
              const item = document.createElement('li');
              item.textContent = renderRow(row);
              list.appendChild(item);
            }
            part.appendChild(list);
          }
        } else {
          addLine(part, `${title}: 확인 불가`);
        }
      };

      showMode(root, mode);
      addLine(root, '등록 기기는 본인 명의의 회수되지 않은 기기 최대 100개이며, 세션은 현재 검증된 연결 한 개입니다. 과거 세션 전체 목록이 아닙니다.');
      showList('기기 정보', devices, '등록된 기기가 없습니다.', (device) =>
        `기기: ${safeText(device.label)} · ID: ${safeText(device.id)} · 상태: ${stateText(deviceNames, device.status)}`
      );
      showList('세션 정보', sessions, '현재 연결이 없습니다.', (session) =>
        `세션 ID: ${safeText(session.id)} · 상태: ${stateText(sessionNames, session.status)}`
      );

      const alerts = section('알림');
      if (!Array.isArray(notifications)) {
        addLine(alerts, '알림을 확인할 수 없습니다.');
      } else if (notifications.length === 0) {
        addLine(alerts, '주의할 알림이 없습니다.');
      } else {
        const list = document.createElement('ul');
        for (const notification of notifications) {
          const item = document.createElement('li');
          addLine(item, `자료(resource): ${safeText(notification?.resource)}`);
          addLine(item, `코드(code): ${safeText(notification?.code)}`);
          addLine(item, `내용(message): ${safeText(notification?.message)}`);
          list.appendChild(item);
        }
        alerts.appendChild(list);
      }

      const help = section('진단 정보');
      showMode(help, diagnostics?.mode);
      let copyText = '';
      if (diagnostics?.status === 'loading') {
        addLine(help, '진단 정보를 불러오는 중입니다.');
      } else if (diagnostics?.status === 'error') {
        showFailure(help, '진단 정보', diagnostics.error);
      } else if (diagnostics?.status === 'idle') {
        addLine(help, '진단 정보를 아직 불러오지 않았습니다. 제공 화면의 도움정보 불러오기 버튼을 직접 누르세요.');
      } else if (diagnostics?.status === 'ok') {
        const data = diagnostics.data;
        const values = [data?.requestId, data?.component, data?.version,
          data?.checkedAt, data?.engine?.mode, data?.engine?.code];
        if (values.every((value) => typeof value === 'string' && value.trim() !== '')) {
          const safe = {
            requestId: safeText(data.requestId),
            component: safeText(data.component),
            version: safeText(data.version),
            checkedAt: safeText(data.checkedAt),
            engine: {
              mode: safeText(data.engine.mode),
              code: safeText(data.engine.code),
            },
          };
          addLine(help, `requestId: ${safe.requestId}`);
          addLine(help, `component: ${safe.component}`);
          addLine(help, `version: ${safe.version}`);
          addLine(help, `checkedAt: ${safe.checkedAt}`);
          addLine(help, `engine.mode: ${safe.engine.mode}`);
          addLine(help, `engine.code: ${safe.engine.code}`);
          copyText = JSON.stringify(safe, null, 2);
        } else {
          addLine(help, '진단 정보가 없거나 형식을 확인할 수 없습니다(CONTRACT_MISMATCH).');
          addLine(help, '제공 화면의 도움정보 불러오기 버튼을 직접 눌러 다시 확인하세요.');
        }
      } else {
        addLine(help, '진단 정보를 확인할 수 없습니다.');
      }

      addLine(help, '도움정보 복사는 표시된 여섯 항목을 도움 요청에 사용할 수 있도록 클립보드에 복사합니다.');
      const copy = document.createElement('button');
      copy.type = 'button';
      copy.textContent = '도움정보 복사';
      copy.disabled = copyText === '';
      const copyStatus = document.createElement('p');
      copyStatus.setAttribute('role', 'status');
      copyStatus.setAttribute('aria-live', 'polite');
      copy.addEventListener('click', async () => {
        if (copy.disabled || !copyText) return;
        copy.disabled = true;
        try {
          await navigator.clipboard.writeText(copyText);
          copyStatus.textContent = '도움정보를 클립보드에 복사했습니다.';
        } catch {
          copyStatus.textContent = '복사하지 못했습니다. 위에 표시된 여섯 항목을 직접 선택해 복사하세요.';
        } finally {
          copy.disabled = false;
        }
      });
      help.appendChild(copy);
      help.appendChild(copyStatus);
      return root;
    },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection({ status, mode, data, error, checkedAt, explanationAccepted }) {
      const root = document.createElement('section');
      const addLine = (text) => {
        const line = document.createElement('p');
        line.textContent = text;
        root.appendChild(line);
      };
      const safeText = (value, fallback = '확인 불가') => {
        if (typeof value !== 'string' || !value.trim()) return fallback;
        const unsafe = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-|sb_secret_|gh[pousr]_)[A-Za-z0-9_-]+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|\bBearer\s+\S+|(?:authorization|cookie)\s*:|(?:password|passwd|secret|(?:access[_ -]?|refresh[_ -]?)?token|api[_ -]?key|비밀번호|토큰|API\s*키)\s*[:=]\s*\S+|https?:\/\/[^\s/]+:[^\s@]+@|(?:^|\n)\s*at\s+\S+\s*\(|Traceback\s*\(|\bError:\s/i;
        return unsafe.test(value) ? fallback : value;
      };
      const modeNames = {
        demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가',
      };
      if (Object.hasOwn(modeNames, mode)) {
        addLine(`데이터 상태: ${modeNames[mode]}`);
      }
      const manualCheck = () => addLine('다시 점검하려면 원인을 확인한 뒤 제공 화면의 현재 API 연결 점검 버튼을 직접 누르세요. 자동으로 다시 요청하지 않습니다.');

      if (status === 'idle') {
        addLine('AI 연결 점검 전');
        addLine('제공 화면에서 계정 연결과 AI 앱 승인을 확인한 뒤 현재 API 연결 점검 버튼을 직접 누르세요.');
        return root;
      }
      if (status === 'loading') {
        addLine('AI 연결 점검 중');
        addLine('이 점검은 모델 목록을 확인하며 사건 설명을 실행하지 않습니다.');
        return root;
      }
      if (status === 'error') {
        const recovery = [
          [['ON_AI_PROVISIONING_PENDING', 'ON_AI_TRANSPORT_PENDING'],
            '권한 준비 중', '담당자에게 계정 연결과 앱 권한 발급 상태를 확인해 달라고 요청하세요.'],
          [['WB_CLCO_AUTH_REQUIRED', 'WB_CLCO_INVALID_TOKEN'],
            '인증 확인 필요', '계정 연결과 AI 앱 승인을 다시 확인하고, 계속 실패하면 담당자에게 문의하세요.'],
          [['WB_CLCO_ACCESS_BLOCKED'],
            '접근 제한', '담당자에게 현재 계정의 AI 이용 권한과 운영 중지 여부를 확인하세요.'],
          [['WB_CLCO_COHORT_BUDGET_EXHAUSTED'],
            '반 사용량 소진', '담당자에게 반의 AI 사용량을 확인하세요.'],
          [['WB_CLCO_LIMIT_REACHED'],
            '이용 한도 도달', '담당자에게 현재 계정의 AI 이용 한도를 확인하세요.'],
          [['WB_CLCO_SESSION_CLOSED'],
            '이용 시간 아님', '현재 AI 이용 가능 시간을 확인하세요.'],
          [['WB_CLCO_RATE_LIMITED'],
            '요청 제한', '잠시 기다린 뒤 직접 다시 점검하세요.'],
          [['TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT', 'WB_CLCO_TIMEOUT'],
            '시간 초과', '잠시 뒤 연결 상태를 확인하고 직접 다시 점검하세요.'],
          [['NETWORK_ERROR', 'WB_CLCO_NETWORK_ERROR', 'WB_CLCO_SERVER_UNAVAILABLE'],
            '네트워크 또는 서버 연결 실패', '앱 실행 창과 네트워크 연결을 확인하고 잠시 뒤 직접 다시 점검하세요.'],
          [['CANCELLED', 'REQUEST_CANCELLED', 'WB_CLCO_CANCELLED'],
            '취소됨', '이전 결과는 현재 결과가 아닙니다. 필요하면 직접 새 점검을 시작하세요.'],
          [['MODEL_NOT_CONFIGURED', 'ON_AI_MODEL_LIST_EMPTY'],
            '사용할 수 있는 모델 없음', '담당자에게 앱의 모델 허용 설정을 확인해 달라고 요청하세요.'],
          [['ON_AI_AUTHORIZATION_CHANGED'],
            '이용 권한 변경', '계정 연결과 현재 앱 권한을 담당자에게 확인한 뒤 직접 다시 점검하세요.'],
          [['SUBJECT_SCOPE_UNVERIFIED', 'ON_AI_INVALID_INPUT', 'ON_AI_INVALID_OUTPUT', 'AI_REQUEST_UNVERIFIED'],
            '확인 불가', '현재 계정 연결과 앱 권한 또는 응답을 확인할 수 없습니다. 담당자에게 안전한 오류 코드와 확인 시각을 전달하세요.'],
        ];
        const matched = recovery.find(([codes]) => codes.includes(error?.code));
        const code = matched ? error.code : 'AI_REQUEST_UNVERIFIED';
        const message = matched
          ? safeText(error?.message, '안전한 오류 메시지를 확인할 수 없습니다.')
          : 'AI 연결 또는 응답을 확인할 수 없습니다.';
        addLine(`AI 연결 점검 실패 · 코드: ${code}`);
        addLine(`내용: ${message}`);
        addLine(`원인 구분: ${matched ? matched[1] : '확인 불가'}`);
        addLine(matched ? matched[2] : '담당자에게 계정 연결과 앱 권한 상태를 확인해 달라고 요청하세요.');
        manualCheck();
        return root;
      }
      if (status !== 'ok') {
        addLine('AI 연결 점검 상태 확인 불가');
        manualCheck();
        return root;
      }

      const authorizationNames = {
        test: '시험 연결 점검(test)',
        verified: '앱 권한 확인 후 점검(verified)',
      };
      if (
        data?.transportChecked !== true ||
        !Object.hasOwn(authorizationNames, data?.audienceAuthorization) ||
        !Number.isSafeInteger(data?.modelCount) || data.modelCount < 0 ||
        typeof checkedAt !== 'string' || !Number.isFinite(Date.parse(checkedAt))
      ) {
        addLine('AI 연결 점검 결과 확인 불가(CONTRACT_MISMATCH)');
        manualCheck();
        return root;
      }
      addLine(authorizationNames[data.audienceAuthorization]);
      addLine('연결 점검(transportChecked): true');
      addLine(`응답 모델 수(modelCount): ${data.modelCount}`);
      addLine(`점검 시각(checkedAt): ${safeText(checkedAt)}`);
      if (data.modelCount === 0) {
        addLine('응답 모델이 없습니다. 담당자에게 모델 허용 설정을 확인해 달라고 요청하세요.');
      }
      if (explanationAccepted === false) {
        addLine('사건 설명은 아직 실행하지 않았습니다.');
      } else {
        addLine('이 연결 점검만으로 사건 설명의 실행 여부를 확인할 수 없습니다.');
      }
      addLine('모델 목록 응답은 사건 설명 결과가 아닙니다. 사건 설명은 보안 기록에서 별도로 요청하고 확인합니다.');
      manualCheck();
      return root;
    },
    renderExplanation({ event, explanation, checkedAt }) {
      const root = document.createElement('section');
      const addLine = (text) => {
        const line = document.createElement('p');
        line.textContent = text;
        root.appendChild(line);
      };
      const safeText = (value, fallback = '확인 불가') => {
        if (typeof value !== 'string' || !value.trim()) return fallback;
        const unsafe = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-|sb_secret_|gh[pousr]_)[A-Za-z0-9_-]+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|\bBearer\s+\S+|(?:authorization|cookie)\s*:|(?:password|passwd|secret|(?:access[_ -]?|refresh[_ -]?)?token|api[_ -]?key|비밀번호|토큰|API\s*키)\s*[:=]\s*\S+|https?:\/\/[^\s/]+:[^\s@]+@|(?:^|\n)\s*at\s+\S+\s*\(|Traceback\s*\(|\bError:\s/i;
        return unsafe.test(value) ? fallback : value;
      };
      const modeNames = {
        demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가',
      };
      if (Object.hasOwn(modeNames, explanation?.mode)) {
        addLine(`데이터 상태: ${modeNames[explanation.mode]}`);
      }
      if (explanation?.status === 'idle') {
        addLine('사건 설명 요청 전');
        addLine('보안 기록에서 사건을 선택한 뒤 AI 설명을 직접 요청하세요. 연결 점검만으로 사건 설명이 실행되지는 않습니다.');
      } else if (explanation?.status === 'loading') {
        addLine('사건 설명 요청 중');
        addLine('설명 결과는 아직 확인되지 않았습니다. 기록은 그대로 유지됩니다.');
      } else if (explanation?.status === 'error') {
        const codes = new Set([
          'ON_AI_PROVISIONING_PENDING', 'ON_AI_TRANSPORT_PENDING',
          'WB_CLCO_AUTH_REQUIRED', 'WB_CLCO_INVALID_TOKEN', 'WB_CLCO_ACCESS_BLOCKED',
          'WB_CLCO_COHORT_BUDGET_EXHAUSTED', 'WB_CLCO_LIMIT_REACHED', 'WB_CLCO_SESSION_CLOSED',
          'WB_CLCO_RATE_LIMITED', 'TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT', 'WB_CLCO_TIMEOUT',
          'NETWORK_ERROR', 'WB_CLCO_NETWORK_ERROR', 'WB_CLCO_SERVER_UNAVAILABLE',
          'CANCELLED', 'REQUEST_CANCELLED', 'WB_CLCO_CANCELLED',
          'MODEL_NOT_CONFIGURED', 'ON_AI_MODEL_LIST_EMPTY', 'ON_AI_AUTHORIZATION_CHANGED',
          'SUBJECT_SCOPE_UNVERIFIED', 'ON_AI_INVALID_INPUT', 'ON_AI_INVALID_OUTPUT', 'AI_REQUEST_UNVERIFIED',
        ]);
        const known = codes.has(explanation.error?.code);
        const code = known ? explanation.error.code : 'AI_REQUEST_UNVERIFIED';
        const message = known
          ? safeText(explanation.error?.message, '안전한 오류 메시지를 확인할 수 없습니다.')
          : 'AI 설명 또는 응답을 확인할 수 없습니다.';
        addLine(`사건 설명 요청 실패 · 코드: ${code}`);
        addLine(`내용: ${message}`);
        if (['TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT', 'WB_CLCO_TIMEOUT'].includes(code)) {
          addLine('시간 초과: 설명 결과를 확인하지 못했습니다.');
        } else if (['CANCELLED', 'REQUEST_CANCELLED', 'WB_CLCO_CANCELLED'].includes(code)) {
          addLine('취소됨. 이전 설명은 현재 결과가 아닙니다.');
        }
        addLine('기록은 그대로 유지됩니다. 연결 상태와 오류 원인을 확인한 뒤 필요하면 보안 기록에서 AI 설명 요청을 직접 누르세요. 자동으로 다시 요청하지 않습니다.');
      } else if (explanation?.status === 'ok') {
        const id = typeof event?.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(event.id)
          ? safeText(event.id, '') : '';
        const summary = safeText(explanation.data?.summary, '');
        if (!id || !summary) {
          addLine('사건 설명 확인 불가(CONTRACT_MISMATCH). 기록은 그대로 유지됩니다.');
          return root;
        }
        root.setAttribute('data-student-explanation-event', id);
        addLine(`사건 ID: ${id}`);
        addLine('AI 사건 설명(참고용)');
        addLine(summary);
        addLine(`설명 확인 시각(checkedAt): ${safeText(checkedAt)}`);
        addLine('이 표시는 선택한 사건의 설명 응답입니다. AI 설명은 실제 조치 실행을 뜻하지 않습니다.');
      } else {
        addLine('사건 설명 상태 확인 불가. 기록은 그대로 유지됩니다.');
      }
      return root;
    },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
