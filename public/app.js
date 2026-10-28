import { createOperationsView } from './operations-view.js';
import {
  registerDevice,
  authenticateDevice,
  deviceRequest,
} from './device-client.js';

const $ = (selector) => document.querySelector(selector);
const authForm = $('#auth-form');
const noteForm = $('#note-form');
const account = $('#account');
const message = $('#message');
const list = $('#notes');
const email = $('#email');
const password = $('#password');
const titleInput = $('#note-title');
const contentInput = $('#note-content');
const logout = $('#logout');
const deviceStatus = $('#device-status');
const deviceRequestButton = $('#device-request');
const deviceRefreshButton = $('#device-refresh');
const networkStatus = $('#network-status');

const storageKey = 'vault-session-v1';

let session = null;
let editingId = null;
let generation = 0;
let busy = false;
let refreshing = null;
let deviceApproved = false;
let deviceSession = null;
let expiryTimer = null;

const operationsPanel = $('#operations-panel');
const operationsView = createOperationsView({
  root: $('#operations-root'),
  load: loadOperations,
  loadChecks: loadOperationChecks,
  runTask: task,
});

// 로그인 정보와 기기 접속 증표는 메모리에만 유지합니다.
function saveSession(next) {
  session = next;
}

function resetEditor() {
  editingId = null;
  noteForm.reset();
  $('#editor-title').textContent = '새 메모';
}

function syncButtons() {
  const disabled = busy || !navigator.onLine;

  for (const button of document.querySelectorAll('button')) {
    button.disabled = disabled;
  }

  deviceRequestButton.disabled = disabled || !session;
  deviceRefreshButton.disabled = disabled || !session;
}

function setBusy(value) {
  busy = value;
  syncButtons();
}

function lockDevice(text) {
  clearTimeout(expiryTimer);
  expiryTimer = null;
  deviceApproved = false;
  deviceSession = null;
  ++generation;
  operationsPanel.hidden = true;
  operationsView.clear();

  resetEditor();
  list.replaceChildren();
  noteForm.hidden = true;
  deviceStatus.textContent = text;
  syncButtons();
}

function hasDeviceSession() {
  return (
    deviceApproved &&
    deviceSession &&
    deviceSession.expiresAt > Date.now() &&
    navigator.onLine
  );
}

function assertCurrent(expectedGeneration, userId) {
  if (
    generation !== expectedGeneration ||
    session?.user.id !== userId ||
    !navigator.onLine
  ) {
    throw new Error('접속 상태가 바뀌었습니다. 다시 시도하세요.');
  }
}

async function task(action) {
  if (busy) return;
  setBusy(true);

  try {
    await action();
  } catch (error) {
    message.textContent = error.message || '처리하지 못했습니다.';
  } finally {
    password.value = '';
    setBusy(false);
  }
}

async function authRequest(action, fields = {}, token) {
  if (!navigator.onLine) {
    throw new Error('인터넷 연결 후 다시 시도하세요.');
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch('/api/auth', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...fields, action }),
    cache: 'no-store',
    credentials: 'same-origin',
    signal: AbortSignal.timeout(20000),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      result?.error || '인증 요청에 실패했습니다.'
    );
    error.status = response.status;
    throw error;
  }

  return result;
}

function validSession(value) {
  return (
    typeof value?.access_token === 'string' &&
    typeof value?.refresh_token === 'string' &&
    Number.isFinite(value?.expires_at) &&
    typeof value?.user?.id === 'string'
  );
}

async function currentSession() {
  if (!session) throw new Error('다시 로그인하세요.');

  if (session.expires_at > Date.now() / 1000 + 60) {
    return session;
  }

  if (!refreshing) {
    const previous = session;

    refreshing = (async () => {
      try {
        const result = await authRequest('refresh', {
          refresh_token: previous.refresh_token,
        });

        if (
          !validSession(result.session) ||
          result.session.user.id !== previous.user.id
        ) {
          throw new Error('다시 로그인하세요.');
        }

        if (session !== previous) {
          throw new Error('로그인 상태가 바뀌었습니다.');
        }

        saveSession(result.session);
        return session;
      } catch (error) {
        if (session === previous && error.status === 401) {
          saveSession(null);
          await showSession(null);
        }

        throw error;
      } finally {
        refreshing = null;
      }
    })();
  }

  return refreshing;
}

async function api(method, id, body) {
  if (!hasDeviceSession()) {
    lockDevice('기기 인증이 필요하거나 만료됐습니다.');
    throw new Error('승인 상태 다시 확인을 눌러 주세요.');
  }

  const expectedUser = session?.user.id;
  const expectedDeviceSession = deviceSession;
  const current = await currentSession();

  if (
    !expectedUser ||
    current.user.id !== expectedUser ||
    deviceSession !== expectedDeviceSession ||
    !hasDeviceSession()
  ) {
    throw new Error('로그인 또는 기기 상태가 바뀌었습니다.');
  }

  const url = id == null
    ? '/api/notes'
    : `/api/notes?id=${encodeURIComponent(id)}`;

  const headers = {
    Authorization: `Bearer ${current.access_token}`,
    'X-Vault-Device': expectedDeviceSession.token,
  };

  if (body) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });

  const result = await response.json().catch(() => null);

  if (response.status === 401) {
    saveSession(null);
    await showSession(null);
    throw new Error('로그인이 만료됐습니다. 다시 로그인하세요.');
  }

  if (response.status === 403) {
    lockDevice('서버가 기기의 접근을 허용하지 않았습니다.');
    throw new Error(result?.error || '기기 인증을 다시 확인하세요.');
  }

  if (!response.ok) {
    throw new Error(result?.error || '메모 요청에 실패했습니다.');
  }

  return result;
}

async function operationsRequest(path, method = 'GET') {
  if (!hasDeviceSession()) {
    throw new Error('\uAE30\uAE30 \uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.');
  }

  const expectedGeneration = generation;
  const expectedDevice = deviceSession;
  const current = await currentSession();

  assertCurrent(expectedGeneration, current.user.id);

  if (
    deviceSession !== expectedDevice ||
    !hasDeviceSession()
  ) {
    throw new Error('\uAE30\uAE30 \uC0C1\uD0DC\uAC00 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4.');
  }

  const headers = {
    Authorization: 'Bearer ' + current.access_token,
    'X-Vault-Device': expectedDevice.token,
  };

  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, {
    method,
    headers,
    body: method === 'POST'
      ? JSON.stringify({ action: 'run' })
      : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(
      method === 'POST' ? 200000 : 20000
    ),
  });

  const data = await response.json().catch(() => null);

  assertCurrent(expectedGeneration, current.user.id);

  if (deviceSession !== expectedDevice) {
    throw new Error('\uAE30\uAE30 \uC0C1\uD0DC\uAC00 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4.');
  }

  if (response.status === 401) {
    await showSession(null);
    throw new Error('\uB2E4\uC2DC \uB85C\uADF8\uC778\uD558\uC138\uC694.');
  }

  if (response.status === 403) {
    lockDevice(
      data?.error ||
      '\uAE30\uAE30 \uC778\uC99D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.'
    );
    throw new Error(deviceStatus.textContent);
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      '\uC791\uC804\uC2E4 \uC870\uD68C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.'
    );
  }

  return {
    data,
    httpStatus: response.status,
    requestId: response.headers.get('x-request-id'),
  };
}

async function loadOperations() {
  return operationsRequest('/api/operations');
}

async function loadOperationChecks(run = false) {
  return operationsRequest(
    '/api/operations-checks',
    run === true ? 'POST' : 'GET'
  );
}

function renderNote(note) {
  const item = document.createElement('li');
  const title = document.createElement('strong');
  const content = document.createElement('span');

  title.textContent = note.title;
  content.textContent = note.body ?? note.content;
  item.append(title, content);

  if (note.owner_id === session?.user.id) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = '수정';
    edit.disabled = busy;

    edit.addEventListener('click', () => {
      if (!hasDeviceSession()) {
        lockDevice('기기 인증이 만료됐습니다.');
        return;
      }

      editingId = note.id;
      titleInput.value = note.title;
      contentInput.value = note.body ?? note.content;
      $('#editor-title').textContent = '메모 수정';
      titleInput.focus();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '삭제';
    remove.disabled = busy;

    remove.addEventListener('click', () => {
      if (!confirm('이 메모를 삭제할까요?')) return;

      void task(async () => {
        await api('DELETE', note.id);
        if (String(editingId) === String(note.id)) resetEditor();
        await loadNotes();
        message.textContent = '메모를 삭제했습니다.';
      });
    });

    item.append(edit, remove);
  }

  return item;
}

async function loadNotes() {
  const currentGeneration = generation;
  const result = await api('GET');

  if (
    currentGeneration !== generation ||
    !hasDeviceSession()
  ) {
    return;
  }

  if (!Array.isArray(result?.notes)) {
    throw new Error('자료 형식이 올바르지 않습니다.');
  }

  list.replaceChildren(...result.notes.map(renderNote));

  message.textContent = result.notes.length
    ? '자료를 불러왔습니다.'
    : '저장된 메모가 없습니다.';
}

async function showSession(next) {
  saveSession(next);

  lockDevice(
    next
      ? '로그인했습니다. 기기 인증과 서버의 승인 확인이 필요합니다.'
      : '로그인한 뒤 기기 승인을 요청하세요.'
  );

  authForm.hidden = Boolean(next);
  logout.hidden = !next;

  account.textContent = next
    ? `로그인됨: ${next.user.email ?? '계정'}`
    : '로그인하지 않은 상태입니다.';

  message.textContent = next
    ? '처음 등록하는 기기는 승인 요청을, 이미 승인된 기기는 승인 상태 다시 확인을 눌러 주세요.'
    : '자료를 보려면 로그인과 기기 인증이 필요합니다.';

  syncButtons();
}

async function authenticate(isSignup) {
  if (!authForm.reportValidity()) return;

  await task(async () => {
    const result = await authRequest(
      isSignup ? 'signup' : 'login',
      {
        email: email.value.trim(),
        password: password.value,
      }
    );

    if (isSignup && result.confirmationRequired) {
      message.textContent =
        '이메일로 온 인증 링크를 확인한 뒤 로그인하세요.';
      return;
    }

    if (!validSession(result.session)) {
      throw new Error('로그인 정보를 확인하지 못했습니다.');
    }

    await showSession(result.session);
  });
}

authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void authenticate(false);
});

$('#signup').addEventListener('click', () => {
  void authenticate(true);
});

deviceRequestButton.addEventListener('click', () => {
  void task(async () => {
    lockDevice('인증 장치에 기기 등록을 요청하는 중입니다.');

    const expectedGeneration = generation;
    const current = await currentSession();

    assertCurrent(expectedGeneration, current.user.id);

    const result = await registerDevice(current);

    assertCurrent(expectedGeneration, current.user.id);

    if (
      result.status !== 'pending' ||
      typeof result.credentialId !== 'string'
    ) {
      throw new Error('기기 등록 결과를 확인하지 못했습니다.');
    }

    deviceStatus.textContent =
      `관리자 승인 대기 중입니다. 요청 식별자: ${result.credentialId}`;

    message.textContent =
      '등록 요청을 보냈습니다. 관리자 승인 후 승인 상태 다시 확인을 눌러 주세요. 자료는 아직 열리지 않습니다.';
  });
});

deviceRefreshButton.addEventListener('click', () => {
  void task(async () => {
    lockDevice('인증 장치와 서버에서 기기를 확인하는 중입니다.');

    const expectedGeneration = generation;
    const current = await currentSession();

    assertCurrent(expectedGeneration, current.user.id);

    const result = await authenticateDevice(current);

    assertCurrent(expectedGeneration, current.user.id);

    const expiresAt = Date.parse(result.expiresAt);

    if (
      result.status !== 'approved' ||
      typeof result.token !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(result.token) ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() ||
      expiresAt > Date.now() + 901000
    ) {
      throw new Error('기기 인증 결과를 확인하지 못했습니다.');
    }

    const checked = await deviceRequest(
      'status',
      current,
      {},
      result.token
    );

    assertCurrent(expectedGeneration, current.user.id);

    if (checked.status !== 'approved') {
      throw new Error('서버에서 기기 승인을 확인하지 못했습니다.');
    }

    deviceSession = {
      token: result.token,
      expiresAt,
    };
    deviceApproved = true;

    deviceStatus.textContent =
      '서버에서 승인된 인증 수단과 유효한 기기 접속 증표를 확인했습니다.';
    noteForm.hidden = false;

    expiryTimer = setTimeout(() => {
      lockDevice('기기 인증이 만료됐습니다.');
      message.textContent = '승인 상태 다시 확인을 눌러 주세요.';
    }, Math.max(0, expiresAt - Date.now()));

    operationsPanel.hidden = false;
    await loadNotes();
    await operationsView.refresh();
  });
});

logout.addEventListener('click', () => {
  void task(async () => {
    let failed = false;

    try {
      const current = await currentSession();

      if (deviceSession) {
        try {
          await deviceRequest(
            'logout',
            current,
            {},
            deviceSession.token
          );
        } catch {
          failed = true;
        }
      }

      try {
        await authRequest('logout', {}, current.access_token);
      } catch {
        failed = true;
      }
    } catch {
      failed = true;
    } finally {
      await showSession(null);
    }

    message.textContent = failed
      ? '이 화면의 로그인 정보는 지웠습니다. 서버의 로그아웃 완료는 확인하지 못했습니다.'
      : '로그아웃했습니다.';
  });
});

$('#cancel-edit').addEventListener('click', resetEditor);

noteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!noteForm.reportValidity()) return;

  void task(async () => {
    const id = editingId;

    await api(id == null ? 'POST' : 'PUT', id, {
      title: titleInput.value,
      body: contentInput.value,
    });

    resetEditor();
    await loadNotes();

    message.textContent = id == null
      ? '메모를 추가했습니다.'
      : '메모를 수정했습니다.';
  });
});

function updateNetworkStatus() {
  networkStatus.textContent = navigator.onLine
    ? '온라인 상태입니다. 실제 서버 연결은 각 요청에서 확인합니다.'
    : '오프라인입니다. 로그인·기기 인증·자료 조회를 할 수 없습니다. 인터넷 연결 후 다시 시도하세요.';

  syncButtons();
}

window.addEventListener('offline', () => {
  lockDevice('인터넷 연결이 끊겨 자료를 숨겼습니다.');
  message.textContent =
    '인터넷 연결 후 승인 상태 다시 확인을 눌러 주세요.';
  updateNetworkStatus();
});

window.addEventListener('online', updateNetworkStatus);

let storageCleanupFailed = false;

for (const storageName of ['localStorage', 'sessionStorage']) {
  try {
    const storage = window[storageName];
    storage.removeItem(storageKey);
    storage.removeItem('sb-qcqmmniyvysvhlbrdhln-auth-token');
  } catch {
    storageCleanupFailed = true;
  }
}

await showSession(null);
updateNetworkStatus();

if (storageCleanupFailed) {
  message.textContent =
    '이전 로그인 정보 정리를 확인하지 못했습니다. 브라우저의 이 사이트 데이터를 삭제한 뒤 다시 접속하세요.';
}