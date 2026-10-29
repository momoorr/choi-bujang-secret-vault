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
    renderEvents() { return '학생 구현 대기: 본인 접속·XDR 기록을 연결하세요.'; },
    renderStatus() { return '학생 구현 대기: 기기·세션·알림과 연결 점검 상태를 구분하세요.'; },
    renderVulnerabilities() { return '학생 구현 대기: 정확한 설치 버전·OSV 출처·조회 시각·부분 결과·조회 실패를 구분하세요.'; },
    renderAiConnection() { return '학생 구현 대기: 모델 응답 점검과 실제 사건 설명을 구분하고 AI 오류·취소·수동 복구를 안내하세요.'; },
    renderExplanation() { return '학생 구현 대기: 선택한 사건의 근거·규칙·현재 상태와 AI 설명을 연결하세요. 제안은 자동 실행하지 않습니다.'; },
    renderAction() { return '학생 구현 대기: 현재 사건·조치·실제 대상·사람 확인·ACK와 원천 효과·unknown을 구분하세요.'; },
  };
}
