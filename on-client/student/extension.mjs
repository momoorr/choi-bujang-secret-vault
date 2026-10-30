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
    renderVulnerabilities({ status, mode, data, error } = {}) {
      const root = document.createElement('section');
      const safeText = (value, fallback = '확인 불가') => {
        if (!['string', 'number', 'boolean'].includes(typeof value)) return fallback;
        if (typeof value === 'number' && !Number.isFinite(value)) return fallback;
        const text = String(value);
        if (!text.trim()) return fallback;
        const unsafe = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-|sb_secret_|gh[pousr]_)[A-Za-z0-9_-]+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|\bBearer\s+\S+|(?:authorization|cookie)\s*:|(?:password|passwd|secret|(?:access[_ -]?|refresh[_ -]?)?token|api[_ -]?key|비밀번호|토큰|API\s*키)\s*[:=]\s*\S+|https?:\/\/[^\s/]+:[^\s@]+@|(?:^|\n)\s*at\s+\S+\s*\(|Traceback\s*\(|\bError:\s/i;
        return unsafe.test(text) ? fallback : text;
      };
      const addLine = (parent, text) => {
        const line = document.createElement('p');
        line.textContent = text;
        parent.appendChild(line);
      };
      const modeNames = { demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가' };
      if (Object.hasOwn(modeNames, mode)) addLine(root, `데이터 상태: ${modeNames[mode]}`);

      if (status === 'idle') {
        addLine(root, '조회 전(idle). 아직 설치 패키지의 알려진 취약점을 조회하지 않았습니다.');
        addLine(root, '보호 현황의 제공 조회 버튼을 직접 눌러 조회하세요.');
        return root;
      }
      if (status === 'loading') {
        addLine(root, '조회 중(loading). 현재 조회 결과는 아직 확인되지 않았습니다.');
        return root;
      }
      if (status === 'error') {
        addLine(root, `조회 실패: ${safeText(error?.message, '안전한 오류 메시지를 확인할 수 없습니다.')}`);
        const code = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.code)
          ? safeText(error.code, '') : '';
        if (code) addLine(root, `오류 코드: ${code}`);
        if (['TIMEOUT', 'REQUEST_TIMEOUT'].includes(code)) {
          addLine(root, '시간 초과로 조회 결과를 확인하지 못했습니다.');
        } else if (['CANCELLED', 'REQUEST_CANCELLED'].includes(code)) {
          addLine(root, '조회가 취소됐습니다. 이전 결과는 현재 확인 결과가 아닙니다.');
        }
        addLine(root, '조회 실패로 취약점의 존재 여부를 판단할 수 없습니다.');
        addLine(root, '원인을 확인한 뒤 보호 현황의 제공 조회 버튼을 직접 눌러 다시 조회하세요. 자동으로 다시 요청하지 않습니다.');
        return root;
      }

      const scanNames = {
        complete: '모두 조회(complete)',
        partial: '일부 조회 실패(partial)',
        not_checked: '아직 조회 안 함(not_checked)',
        not_configured: '조회 준비 미완료(not_configured)',
        unverifiable: 'lock 파일 확인 불가(unverifiable)',
      };
      if (status !== 'ok' || !data || !Object.hasOwn(scanNames, data.status) || !Array.isArray(data.packages)) {
        addLine(root, '조회 결과 확인 불가(CONTRACT_MISMATCH). 현재 조회 결과를 표시할 수 없습니다.');
        return root;
      }
      addLine(root, `전체 조회 상태: ${scanNames[data.status]}`);
      if (data.status === 'not_configured') {
        addLine(root, '조회 대상 프로젝트 설정이 필요합니다. 대상 경로와 허용 패키지는 담당자가 준비합니다. 아직 조회한 결과가 아닙니다.');
      } else if (data.status === 'not_checked') {
        addLine(root, '승인된 공개 조회 대상이 없어 조회하지 않은 상태입니다. 대상과 허용 패키지는 담당자가 준비합니다.');
      } else if (data.status === 'unverifiable') {
        addLine(root, 'package-lock.json과 설치 메타데이터를 확인할 수 없어 조회 결과를 확인할 수 없습니다.');
      } else if (data.status === 'partial') {
        addLine(root, '일부 조회를 확인하지 못했습니다. 이미 받은 취약점 ID는 아래에 유지합니다.');
      } else {
        addLine(root, '전달된 조회 대상 범위에 대한 조회 결과입니다.');
      }
      for (const field of ['lockfileVersion', 'lockfileHash', 'checkedAt']) {
        if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
          addLine(root, `${field}: ${safeText(data[field])}`);
        }
      }
      addLine(root, '버전은 서버가 package-lock.json과 설치된 node_modules의 메타데이터를 대조해 전달한 값입니다.');
      addLine(root, 'OSV는 알려진 취약점 데이터베이스입니다. 조회 결과만으로 패키지나 앱 전체의 안전성을 보장할 수 없습니다.');

      if (data.packages.length === 0) {
        if (data.status === 'complete') addLine(root, '표시할 패키지 조회 결과가 없습니다.');
        else addLine(root, '표시할 패키지별 조회 결과가 없습니다. 취약점의 존재 여부를 판단할 수 없습니다.');
        return root;
      }
      const packageNames = {
        known_vulnerabilities: '알려진 항목 있음(known_vulnerabilities)',
        none_found: '알려진 항목 없음(none_found)',
        unverifiable: '조회 확인 불가(unverifiable)',
      };
      const exactVersion = (value) => {
        if (typeof value !== 'string') return false;
        const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(value);
        return Boolean(match && (!match[4] || match[4].split('.').every(part => !/^0\d+$/.test(part))));
      };
      const list = document.createElement('ul');
      for (const pkg of data.packages) {
        const row = document.createElement('li');
        const name = typeof pkg?.name === 'string' ? safeText(pkg.name, '') : '';
        const version = exactVersion(pkg?.version) ? safeText(pkg.version, '') : '';
        if (name) row.setAttribute('data-student-package-name', name);
        if (version) row.setAttribute('data-student-package-version', version);
        addLine(row, `패키지명(name): ${name || '확인 불가'}`);
        addLine(row, `정확한 설치 버전(version): ${version || '확인 불가'}`);
        if (!version) addLine(row, '정확한 설치 버전을 확인할 수 없습니다. 버전 범위를 설치 버전으로 표시하지 않습니다.');
        const findings = Array.isArray(pkg?.vulnerabilities) ? pkg.vulnerabilities : [];
        const packageStatus = Object.hasOwn(packageNames, pkg?.status) ? pkg.status : 'unverifiable';
        addLine(row, `패키지 조회 상태: ${packageNames[packageStatus]}`);
        addLine(row, `출처(source): ${safeText(pkg?.source)}`);
        addLine(row, `패키지 조회 시각(checkedAt): ${safeText(pkg?.checkedAt)}`);
        if (packageStatus === 'none_found') {
          addLine(row, '조회 범위와 시점에서 알려진 항목을 찾지 못했다는 뜻이며 패키지나 앱 전체의 안전성을 보장하지 않습니다.');
        } else if (packageStatus === 'unverifiable') {
          addLine(row, findings.length > 0
            ? '일부 확인·전체 조회 확인 불가. 아래 ID는 이미 확인된 항목이며 전체 목록을 확인한 결과가 아닙니다.'
            : '조회 결과를 확인할 수 없어 취약점의 존재 여부를 판단할 수 없습니다.');
        }
        if (findings.length > 0) {
          const findingList = document.createElement('ul');
          for (const finding of findings) {
            const item = document.createElement('li');
            item.textContent = `취약점 ID: ${safeText(finding?.id)} · 수정 시각(modified): ${safeText(finding?.modified)}`;
            findingList.appendChild(item);
          }
          row.appendChild(findingList);
        } else if (packageStatus === 'known_vulnerabilities') {
          addLine(row, '알려진 항목의 상세 목록을 확인할 수 없습니다.');
        }
        list.appendChild(row);
      }
      root.appendChild(list);
      return root;
    },
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
      const addLine = (parent, text) => {
        const line = document.createElement('p');
        line.textContent = text;
        parent.appendChild(line);
      };
      const heading = (text) => {
        const title = document.createElement('h4');
        title.textContent = text;
        root.appendChild(title);
      };
      const safeText = (value, fallback = '확인 불가') => {
        if (typeof value !== 'string' || !value.trim()) return fallback;
        const unsafe = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-|sb_secret_|gh[pousr]_)[A-Za-z0-9_-]+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|\bBearer\s+\S+|(?:authorization|cookie)\s*:|(?:password|passwd|secret|(?:access[_ -]?|refresh[_ -]?)?token|api[_ -]?key|비밀번호|토큰|API\s*키)\s*[:=]\s*\S+|https?:\/\/[^\s/]+:[^\s@]+@|(?:^|\n)\s*at\s+\S+\s*\(|Traceback\s*\(|\bError:\s/i;
        return unsafe.test(value) ? fallback : value;
      };
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
      const showFailure = (reason, fallbackCode = 'ON_AI_INVALID_OUTPUT') => {
        const known = codes.has(explanation?.error?.code);
        const code = known ? explanation.error.code : fallbackCode;
        addLine(root, `AI 설명 실패 · 코드: ${code}`);
        addLine(root, `까닭: ${reason}`);
        if (known) {
          addLine(root, `내용: ${safeText(explanation.error?.message, '안전한 오류 메시지를 확인할 수 없습니다.')}`);
        }
        if (code === 'ON_AI_INVALID_INPUT') {
          addLine(root, '근거 부족 또는 선택한 기록의 입력을 확인할 수 없습니다.');
        } else if (code === 'ON_AI_INVALID_OUTPUT') {
          addLine(root, 'AI 응답의 근거·제안 형식을 확인할 수 없습니다.');
        } else if (code === 'SUBJECT_SCOPE_UNVERIFIED') {
          addLine(root, '현재 계정과 선택한 기록의 연결을 확인할 수 없습니다.');
        } else if (['TIMEOUT', 'REQUEST_TIMEOUT', 'ENGINE_TIMEOUT', 'WB_CLCO_TIMEOUT'].includes(code)) {
          addLine(root, '시간 초과: 설명 결과를 확인하지 못했습니다.');
        } else if (['CANCELLED', 'REQUEST_CANCELLED', 'WB_CLCO_CANCELLED'].includes(code)) {
          addLine(root, '취소됨. 이전 설명은 현재 결과가 아닙니다.');
        }
        addLine(root, '기록은 그대로 유지됩니다. 이 오류는 업무 앱 판정이나 과제의 공식 판정 결과가 아닙니다.');
        addLine(root, '현재 기록과 연결 상태를 확인한 뒤 필요하면 AI 설명 요청을 직접 누르세요. 자동으로 다시 요청하지 않습니다.');
      };
      const modeNames = {
        demo: '예제 자료', disconnected: '연결 없음', unknown: '확인 불가',
      };
      if (Object.hasOwn(modeNames, explanation?.mode)) {
        addLine(root, `데이터 상태: ${modeNames[explanation.mode]}`);
      }

      // 입력 검사 실패는 선택한 기록이 null이어도 먼저 표시합니다.
      if (explanation?.status === 'error') {
        showFailure('설명 요청 또는 응답을 확인하지 못했습니다.', 'AI_REQUEST_UNVERIFIED');
        return root;
      }
      if (event == null) {
        addLine(root, '보안 기록에서 기록을 먼저 고르세요.');
        return root;
      }
      if (explanation?.status === 'idle') {
        addLine(root, '사건 설명 요청 전');
        addLine(root, '선택한 기록에서 AI 설명을 직접 요청하세요. 연결 점검만으로 사건 설명이 실행되지는 않습니다.');
        return root;
      }
      if (explanation?.status === 'loading') {
        addLine(root, '사건 설명 요청 중');
        addLine(root, '설명 결과는 아직 확인되지 않았습니다. 기록은 그대로 유지됩니다.');
        return root;
      }
      if (explanation?.status !== 'ok') {
        addLine(root, '사건 설명 상태 확인 불가. 기록은 그대로 유지됩니다.');
        return root;
      }

      const data = explanation.data;
      const isId = (value) => typeof value === 'string'
        && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(value) && safeText(value, '') !== '';
      if (data?.executed === true) {
        showFailure('AI가 조치를 이미 실행했다고 표시한 설명은 사용할 수 없습니다.');
        return root;
      }
      if (data?.executed !== false || data?.requiresHumanConfirmation !== true) {
        showFailure('조치의 미실행 상태와 사람 확인 필요 여부를 확인할 수 없습니다.');
        return root;
      }
      const summary = safeText(data?.summary, '');
      if (!isId(event.id) || !summary) {
        showFailure('선택한 사건 ID 또는 안전한 AI 요약을 확인할 수 없습니다.');
        return root;
      }
      if (!Array.isArray(event.evidence) || event.evidence.length === 0) {
        showFailure('근거 부족: 선택한 기록에 설명을 대조할 근거가 없습니다.');
        return root;
      }
      const evidence = new Map();
      for (const entry of event.evidence) {
        if (!isId(entry?.id) || !safeText(entry?.text, '') || evidence.has(entry.id)) {
          showFailure('근거 부족 또는 불일치: 근거 ID와 근거 글을 정확하게 대조할 수 없습니다.');
          return root;
        }
        evidence.set(entry.id, entry.text);
      }
      const refsMatch = (refs) => Array.isArray(refs) && refs.length > 0
        && new Set(refs).size === refs.length
        && refs.every((id) => isId(id) && evidence.has(id));
      if (!refsMatch(data.evidenceIds)) {
        showFailure('근거가 맞지 않아 이 설명을 사용할 수 없습니다. 현재 기록에 없는 근거 ID, 중복 또는 인용 근거 누락이 있습니다.');
        return root;
      }
      if (data.evidenceIds.length !== evidence.size) {
        showFailure('근거 부족: 현재 기록의 모든 근거 ID를 인용하지 않아 이 설명을 사용할 수 없습니다.');
        return root;
      }
      if (!Array.isArray(event.rules) || event.rules.some((rule) => !isId(rule?.id) || !safeText(rule?.text, ''))) {
        showFailure('선택한 기록의 규칙 ID와 규칙 글을 확인할 수 없습니다.');
        return root;
      }
      const stateCodes = {
        access: ['allowed', 'denied', 'unknown'],
        session: ['active', 'expired', 'revoked', 'unknown'],
        device: ['compliant', 'noncompliant', 'unknown'],
      };
      if (Object.entries(stateCodes).some(([key, values]) => !values.includes(event.state?.[key]))) {
        showFailure('선택한 기록의 접속·세션·기기 상태 형식을 확인할 수 없습니다.');
        return root;
      }
      if (!Array.isArray(event.supportedActions) || !Array.isArray(data.proposals)) {
        showFailure('지원 조치와 AI 제안 목록의 형식을 확인할 수 없습니다.');
        return root;
      }
      if (data.proposals.some((proposal) => !isId(proposal?.action)
        || !event.supportedActions.includes(proposal.action)
        || !safeText(proposal?.reason, '') || !refsMatch(proposal?.evidenceIds))) {
        showFailure('제안의 조치·이유·근거가 현재 기록과 맞지 않아 이 설명을 사용할 수 없습니다.');
        return root;
      }

      // 현재 기록과의 대조가 끝난 설명에만 성공 표식을 붙입니다.
      root.setAttribute('data-student-explanation-event', event.id);
      addLine(root, `사건 ID: ${event.id}`);
      heading('AI 설명(참고용)');
      addLine(root, summary);
      addLine(root, `설명 확인 시각(checkedAt): ${safeText(checkedAt)}`);
      addLine(root, 'AI 설명은 해석입니다. 사실 판단은 아래 근거 글과 연동 시스템이 알려 준 상태를 기준으로 합니다.');

      heading('인용한 근거');
      const evidenceList = document.createElement('ul');
      for (const id of data.evidenceIds) {
        const item = document.createElement('li');
        item.textContent = `${id} — ${evidence.get(id)}`;
        evidenceList.appendChild(item);
      }
      root.appendChild(evidenceList);

      heading('현재 기록의 규칙');
      const ruleList = document.createElement('ul');
      for (const rule of event.rules) {
        const item = document.createElement('li');
        item.textContent = `${rule.id} — ${rule.text}`;
        ruleList.appendChild(item);
      }
      if (event.rules.length === 0) addLine(root, '전달된 규칙이 없습니다.');
      root.appendChild(ruleList);

      heading('확인 불가 상태');
      const stateNames = { access: '접속', session: '세션', device: '기기' };
      const unknownKeys = Object.keys(stateNames).filter((key) => event.state[key] === 'unknown');
      if (unknownKeys.length === 0) {
        addLine(root, '없음');
      } else {
        const unknownList = document.createElement('ul');
        for (const key of unknownKeys) {
          const item = document.createElement('li');
          item.textContent = `${stateNames[key]}: 확인 불가(unknown)`;
          unknownList.appendChild(item);
        }
        root.appendChild(unknownList);
      }

      heading('조치 제안(미실행)');
      if (data.proposals.length === 0) {
        addLine(root, event.supportedActions.length === 0
          ? '연동 시스템이 지원하는 조치가 없어 제안이 없습니다(정상).'
          : 'AI가 제안한 조치가 없습니다.');
      } else {
        const proposalList = document.createElement('ul');
        for (const proposal of data.proposals) {
          const item = document.createElement('li');
          addLine(item, `조치: ${proposal.action}`);
          addLine(item, `이유: ${proposal.reason}`);
          addLine(item, `제안 근거 ID: ${proposal.evidenceIds.join(', ')}`);
          addLine(item, '사람 확인이 필요하며 실행되지 않았습니다.');
          proposalList.appendChild(item);
        }
        root.appendChild(proposalList);
      }
      addLine(root, '설명과 제안만으로 보안 조치가 실행되지는 않습니다. 아직 실행되지 않았습니다(executed: false).');
      return root;
    },
    renderAction({ status, event, actionId, target, receipt, observation, message, confirmationExpiresAt, error } = {}) {
      const root = document.createElement('section');
      const safeText = (value, fallback = '') => {
        if (!['string', 'number', 'boolean'].includes(typeof value)) return fallback;
        if (typeof value === 'number' && !Number.isFinite(value)) return fallback;
        const text = String(value);
        if (!text.trim()) return fallback;
        const unsafe = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-|sb_secret_|gh[pousr]_)[A-Za-z0-9_-]+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|\bBearer\s+\S+|(?:authorization|cookie)\s*:|(?:password|passwd|secret|(?:access[_ -]?|refresh[_ -]?)?token|api[_ -]?key|비밀번호|토큰|API\s*키)\s*[:=]\s*\S+|https?:\/\/[^\s/]+:[^\s@]+@|(?:^|\n)\s*at\s+\S+\s*\(|Traceback\s*\(|\bError:\s/i;
        return unsafe.test(text) ? fallback : text;
      };
      const addLine = (text) => {
        const line = document.createElement('p');
        line.textContent = text;
        root.appendChild(line);
      };
      const showField = (name, value) => {
        const text = safeText(value);
        if (text) addLine(`${name}: ${text}`);
      };
      const labels = {
        idle: '아직 미실행(idle)',
        loading: '조치 준비 또는 결과 조회 중(loading). 결과는 아직 확인되지 않았습니다.',
        prepared: '준비됨·미실행(prepared)',
        executing: '서버에 전달 중(executing). 결과는 아직 확인되지 않았습니다.',
        pending: '서버 접수·처리 중(pending). 접수 응답(ACK)은 실제 효과를 확인한 결과가 아닙니다.',
        succeeded: '효과 확인(succeeded)',
        denied: '거절(denied)',
        failed: '실패(failed)',
        unknown: '결과 불명(unknown)',
        expired: '확인 기한 지남(expired)',
        error: '요청 처리 안 됨(error)',
      };
      const eventId = typeof event?.id === 'string' ? safeText(event.id) : '';
      const currentActionId = typeof actionId === 'string' ? safeText(actionId) : '';
      const requestId = typeof receipt?.requestId === 'string' ? safeText(receipt.requestId) : '';
      const bindingMismatch = Boolean(receipt && (
        (eventId && receipt.eventId != null && receipt.eventId !== event.id) ||
        (currentActionId && receipt.actionId != null && receipt.actionId !== actionId)
      ));
      let shownStatus = Object.hasOwn(labels, status) ? status : 'unknown';
      if (shownStatus !== 'idle' && (bindingMismatch || receipt?.superseded === true ||
        (shownStatus === 'succeeded' && observation?.effectApplied !== true))) {
        shownStatus = 'unknown';
      }

      addLine(labels[shownStatus]);
      if (shownStatus === 'idle') {
        const currentMessage = safeText(message);
        if (currentMessage) addLine(currentMessage);
        addLine('AI의 설명과 제안만으로 보안 조치가 실행되지는 않습니다.');
        addLine('현재 기록에 지원 조치가 없으면 조치 준비 버튼이 나오지 않는 것이 정상입니다.');
        addLine('실제 학생 계정의 조치 처리 연결은 미완료이며 기다림(UNV)입니다.');
        addLine('조치 화면 취소는 이미 서버에 전달된 조치 효과를 되돌리는 기능이 아닙니다.');
        return root;
      }

      if (eventId) {
        root.setAttribute('data-student-action-event', eventId);
        showField('사건 ID(event.id)', eventId);
      }
      if (Array.isArray(event?.evidence)) {
        for (const evidence of event.evidence) showField('근거 ID', evidence?.id);
      }
      showField('조치 ID(actionId)', currentActionId);
      showField('실제 대상 ID(target.id)', target?.id);
      showField('대상 세대(target.generation)', target?.generation);
      if (!bindingMismatch) {
        if (requestId) root.setAttribute('data-student-action-request', requestId);
        showField('요청 ID(requestId)', requestId);
        showField('접수증 ID(receiptId)', receipt?.receiptId);
        showField('결과 버전(version)', receipt?.version);
        if (receipt?.replayed === true) {
          addLine('기존 요청의 응답이 다시 전달됐습니다(replayed: true). 새 조치를 집행했다는 뜻이 아닙니다.');
          addLine('같은 조치를 다시 집행하지 말고 현재 요청의 결과만 직접 재조회하세요.');
        }
      }

      if (shownStatus === 'prepared') {
        addLine(`사람 확인 기한(confirmationExpiresAt): ${safeText(confirmationExpiresAt, '확인 불가')}`);
        addLine('사건·근거·조치·실제 대상·세대와 확인 기한을 확인하세요. 준비만 됐으며 아직 실행되지 않았습니다.');
        addLine('집행하려면 제공 화면의 「대상과 조치를 확인했으며 집행합니다」 버튼을 사용자가 직접 눌러야 합니다.');
      } else if (shownStatus === 'succeeded') {
        addLine(`관측 시각(observation.observedAt): ${safeText(observation?.observedAt, '확인 불가')}`);
        addLine('effectApplied: true');
        addLine('위 표시는 전달받은 연동 시스템의 효과 관측 결과입니다. 시험용 상태 표시만으로 실제 학생 계정의 집행 연결을 확인한 것은 아닙니다.');
      } else if (shownStatus === 'unknown') {
        if (bindingMismatch) {
          root.removeAttribute('data-student-action-event');
          addLine('접수 정보의 사건 또는 조치가 현재 입력과 맞지 않아 결과를 연결할 수 없습니다.');
        }
        if (receipt?.superseded === true) {
          addLine('이전 조회는 최신 결과를 대신하지 않습니다(superseded: true).');
        }
        if (status === 'succeeded' && observation?.effectApplied !== true) {
          addLine('효과가 적용됐다는 관측을 확인할 수 없어 결과 불명으로 표시합니다.');
        }
        addLine('성공으로도 효과 없음으로도 판단할 수 없습니다. 같은 조치를 다시 집행하지 마세요.');
        addLine('제공 화면의 「연동 시스템 결과만 재조회」 버튼을 직접 눌러 현재 요청의 결과만 확인하세요.');
      } else if (shownStatus === 'expired') {
        showField('사람 확인 기한(confirmationExpiresAt)', confirmationExpiresAt);
        addLine('확인 기한이 지났습니다. 제공 화면에서 조치를 다시 준비하고 실제 대상과 기한을 확인하세요.');
      }

      if (['denied', 'failed', 'unknown', 'expired', 'error'].includes(shownStatus)) {
        const currentMessage = safeText(message);
        if (currentMessage) addLine(`안내: ${currentMessage}`);
        const code = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.code)
          ? safeText(error.code) : '';
        if (code) addLine(`오류 코드: ${code}`);
        if (error != null || shownStatus === 'error') {
          addLine(`오류 내용: ${safeText(error?.message, '안전한 오류 메시지를 확인할 수 없습니다.')}`);
        }
        if (shownStatus === 'denied' || shownStatus === 'failed') {
          if (!currentMessage && error == null) addLine('거절·실패 이유를 확인할 수 없습니다.');
        }
        if (shownStatus === 'error') {
          addLine('현재 입력은 요청이 처리되지 않은 상태입니다. 제공 화면의 안내로 원인을 확인하세요.');
        }
      }
      addLine('조치 화면 취소는 이미 서버에 전달된 조치 효과를 되돌리는 기능이 아닙니다.');
      return root;
    },
  };
}
