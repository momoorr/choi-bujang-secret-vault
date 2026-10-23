import { createClient } from
  'https://esm.sh/@supabase/supabase-js@2.117.2';
import {
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
} from './supabase-config.js';

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

let client;
let session = null;
let editingId = null;
let generation = 0;
let busy = false;

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

async function api(method, id, body) {
  const expectedUser = session?.user.id;
  const { data, error } = await client.auth.getSession();
  const current = data?.session;

  if (
    error ||
    !current ||
    !expectedUser ||
    current.user.id !== expectedUser
  ) {
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
  content.textContent = note.content ?? note.body;
  item.append(title, content);

  if (note.owner_id === session?.user.id) {
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = '수정';
    edit.disabled = busy;
    edit.addEventListener('click', () => {
      editingId = note.id;
      titleInput.value = note.title;
      contentInput.value = note.content ?? note.body;
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
    const credentials = {
      email: email.value.trim(),
      password: password.value,
    };
    const { data, error } = isSignup
      ? await client.auth.signUp(credentials)
      : await client.auth.signInWithPassword(credentials);

    if (error) {
      throw new Error(
        '인증하지 못했습니다. 입력값과 이메일 인증 여부를 확인하세요.'
      );
    }

    if (isSignup && !data.session) {
      message.textContent =
        '이메일로 온 인증 링크를 확인한 뒤 로그인하세요.';
      return;
    }

    await showSession(data.session);
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
    const { error } = await client.auth.signOut();
    if (error) throw new Error('로그아웃하지 못했습니다.');
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
      content: contentInput.value,
    });

    resetEditor();
    await loadNotes();
    message.textContent = id == null
      ? '메모를 추가했습니다.'
      : '메모를 수정했습니다.';
  });
});

try {
  if (!SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_')) {
    throw new Error('invalid_public_key');
  }

  client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  client.auth.onAuthStateChange((_event, next) => {
    setTimeout(() => { void showSession(next); }, 0);
  });

  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  await showSession(data.session);
} catch {
  authForm.hidden = true;
  noteForm.hidden = true;
  logout.hidden = true;
  account.textContent = '로그인 연결을 초기화하지 못했습니다.';
  message.textContent = 'Supabase URL과 공개용 키 설정을 확인하세요.';
}