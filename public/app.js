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

const storageKey = 'vault-session-v1';
let session = null;
let editingId = null;
let generation = 0;
let busy = false;
let refreshing = null;

function saveSession(next) {
  if (next) {
    sessionStorage.setItem(storageKey, JSON.stringify(next));
  } else {
    sessionStorage.removeItem(storageKey);
  }
  session = next;
}

function resetEditor() {
  editingId = null;
  noteForm.reset();
  $('#editor-title').textContent = '새 메모';
}

function setBusy(value) {
  busy = value;
  for (const button of document.querySelectorAll('button')) {
    button.disabled = value;
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
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch('/api/auth', {
    method: 'POST',
    headers,
    body: JSON.stringify({ action, ...fields }),
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
  const expectedUser = session?.user.id;
  const current = await currentSession();

  if (!expectedUser || current.user.id !== expectedUser) {
    throw new Error('로그인 상태가 바뀌었습니다. 다시 로그인하세요.');
  }

  const url = id == null
    ? '/api/notes'
    : `/api/notes?id=${encodeURIComponent(id)}`;

  const headers = {
    Authorization: `Bearer ${current.access_token}`,
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

  if (!response.ok) {
    throw new Error(result?.error || '메모 요청에 실패했습니다.');
  }

  return result;
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

  if (currentGeneration !== generation) return;
  if (!Array.isArray(result?.notes)) {
    throw new Error('자료 형식이 올바르지 않습니다.');
  }

  list.replaceChildren(...result.notes.map(renderNote));
  message.textContent = result.notes.length
    ? '자료를 불러왔습니다.'
    : '저장된 메모가 없습니다.';
}

async function showSession(next) {
  const changedUser = session?.user.id !== next?.user.id;
  session = next;
  const currentGeneration = ++generation;

  if (changedUser || !next) resetEditor();
  list.replaceChildren();
  authForm.hidden = Boolean(next);
  noteForm.hidden = !next;
  logout.hidden = !next;
  account.textContent = next
    ? `로그인됨: ${next.user.email ?? '계정'}`
    : '로그인하지 않은 상태입니다.';

  if (!next) {
    message.textContent = '로그인하면 자료를 볼 수 있습니다.';
    return;
  }

  message.textContent = '자료를 불러오는 중입니다.';
  try {
    await loadNotes();
  } catch (error) {
    if (currentGeneration === generation) {
      message.textContent = error.message;
    }
  }
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
      message.textContent = '이메일로 온 인증 링크를 확인한 뒤 로그인하세요.';
      return;
    }

    if (!validSession(result.session)) {
      throw new Error('로그인 정보를 확인하지 못했습니다.');
    }

    resetEditor();
    saveSession(result.session);
    await showSession(session);
  });
}

authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void authenticate(false);
});

$('#signup').addEventListener('click', () => {
  void authenticate(true);
});

logout.addEventListener('click', () => {
  void task(async () => {
    const current = await currentSession();
    await authRequest('logout', {}, current.access_token);
    saveSession(null);
    await showSession(null);
    message.textContent = '로그아웃했습니다.';
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

try {
  // 이전 브라우저 SDK가 저장한 로그인 복사본을 정리합니다.
  localStorage.removeItem('sb-qcqmmniyvysvhlbrdhln-auth-token');

  const stored = JSON.parse(
    sessionStorage.getItem(storageKey) || 'null'
  );

  if (validSession(stored)) {
    session = stored;
    await currentSession();
    await showSession(session);
  } else {
    saveSession(null);
    await showSession(null);
  }
} catch {
  saveSession(null);
  await showSession(null);
  message.textContent = '로그인 상태를 복원하지 못했습니다. 다시 로그인하세요.';
}