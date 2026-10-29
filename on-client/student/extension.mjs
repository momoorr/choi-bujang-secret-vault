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
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
