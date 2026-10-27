import { verifyDevice } from '../src/verify-device.mjs';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';

const config = JSON.parse(
  readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8')
);

const columns = 'id, owner_id, title, content';
let database;
let verifyLogin;

function initialize() {
  if (database && verifyLogin) return;

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (
    !url ||
    !secretKey ||
    new URL(url).origin + '/auth/v1' !== config.identityProvider?.issuer
  ) {
    throw new Error('invalid_server_configuration');
  }

  const nextDatabase = createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const nextVerifier = createLoginVerifier({
    config,
    supabaseSecretKey: secretKey,
  });

  database = nextDatabase;
  verifyLogin = nextVerifier;
}

function parseBody(value) {
  const body = typeof value === 'string' ? JSON.parse(value) : value;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('invalid_body');
  }
  return body;
}

function parseId(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new Error('invalid_id');
  }

  const id = String(value);
  if (
    !/^[1-9][0-9]{0,18}$/.test(id) ||
    BigInt(id) > 9223372036854775807n
  ) {
    throw new Error('invalid_id');
  }
  return id;
}

function noteFields(body) {
  const content = body.body ?? body.content;

  if (
    typeof body.title !== 'string' ||
    !body.title.trim() ||
    body.title.length > 200 ||
    typeof content !== 'string' ||
    !content.trim() ||
    content.length > 20000
  ) {
    throw new Error('invalid_fields');
  }

  return { title: body.title.trim(), content };
}

function present(note) {
  return {
    id: note.id,
    title: note.title,
    body: note.content,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const methods = ['GET', 'POST', 'PUT', 'DELETE'];
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    return res.status(405).json({
      error: '허용되지 않은 요청입니다.',
    });
  }

  if (!req.headers.authorization) {
    return res.status(401).json({
      error: '로그인이 필요합니다.',
    });
  }

  try {
    initialize();
  } catch {
    return res.status(503).json({
      error: '서버의 로그인 연결 설정이 필요합니다.',
    });
  }

  const identity = await verifyLogin(req.headers.authorization);
  if (!identity) {
    return res.status(401).json({
      error: '유효한 로그인 토큰이 필요합니다.',
    });
  }

  try {
    const device = await verifyDevice({
      database,
      userId: identity.userId,
      token: req.headers['x-vault-device'],
    });

    if (!device) {
      return res.status(403).json({
        error: '승인된 기기의 인증이 필요합니다.',
      });
    }
  } catch {
    return res.status(503).json({
      error: '기기 승인 상태를 확인하지 못했습니다.',
    });
  }

  const userId = identity.userId;
  let id;
  let fields;

  try {
    // URL에서 소유자를 지정하는 요청은 받지 않습니다.
    if (Object.hasOwn(req.query ?? {}, 'owner_id')) {
      return res.status(403).json({
        error: '요청에서 소유자를 지정할 수 없습니다.',
      });
    }

    let body;
    if (req.method === 'POST' || req.method === 'PUT') {
      body = parseBody(req.body);

      // 새 소유자는 서버가 지정하며 소유자 변경은 허용하지 않습니다.
      if (Object.hasOwn(body, 'owner_id')) {
        return res.status(403).json({
          error: '요청에서 소유자를 지정하거나 변경할 수 없습니다.',
        });
      }

      fields = noteFields(body);
    }

    const queryId = req.query?.id;
    const bodyId = body?.id;

    if (
      queryId !== undefined &&
      bodyId !== undefined &&
      String(queryId) !== String(bodyId)
    ) {
      throw new Error('conflicting_id');
    }

    if (queryId !== undefined || req.method === 'PUT') {
      id = parseId(queryId ?? bodyId);
    }

    if (req.method === 'DELETE') {
      id = parseId(queryId);
    }
  } catch {
    return res.status(400).json({
      error: '메모 ID 또는 제목·내용을 확인하세요.',
    });
  }

  try {
    if (req.method === 'GET') {
      if (id) {
        const { data, error } = await database
          .from('notes')
          .select(columns)
          .eq('id', id)
          .eq('owner_id', userId)
          .maybeSingle();

        if (error) throw error;
        if (!data) {
          return res.status(404).json({
            error: '메모를 찾을 수 없습니다.',
          });
        }

        return res.status(200).json(present(data));
      }

      const { data, error } = await database
        .from('notes')
        .select(columns)
        .eq('owner_id', userId)
        .order('id', { ascending: true });

      if (error) throw error;

      return res.status(200).json({
        sampleMarker: config.sampleMarker,
        // 기존 화면의 내용 표시와 수정·삭제 버튼을 유지합니다.
        notes: data.map((note) => ({
          ...present(note),
          content: note.content,
          owner_id: note.owner_id,
        })),
      });
    }

    if (req.method === 'POST') {
      const { data, error } = await database
        .from('notes')
        .insert({
          ...fields,
          owner_id: userId,
        })
        .select(columns)
        .single();

      if (error) throw error;
      return res.status(201).json(present(data));
    }

    if (req.method === 'PUT') {
      const { data, error } = await database
        .from('notes')
        .update({
          ...fields,
          owner_id: userId,
        })
        .eq('id', id)
        .eq('owner_id', userId)
        .select(columns)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return res.status(404).json({
          error: '수정할 메모를 찾을 수 없습니다.',
        });
      }

      return res.status(200).json(present(data));
    }

    const { data, error } = await database
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('owner_id', userId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({
        error: '삭제할 메모를 찾을 수 없습니다.',
      });
    }

    return res.status(200).json({
      id: data.id,
      deleted: true,
    });
  } catch {
    return res.status(502).json({
      error: '메모 처리에 실패했습니다.',
    });
  }
}