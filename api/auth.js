import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const config = JSON.parse(
  readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8')
);

function publicSession(session) {
  if (!session) return null;

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: {
      id: session.user.id,
      email: session.user.email,
    },
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: '허용되지 않은 요청입니다.',
    });
  }

  if (req.headers.origin !== new URL(config.publicAppUrl).origin) {
    return res.status(403).json({
      error: '허용되지 않은 출처입니다.',
    });
  }

  if (
    !req.headers['content-type']
      ?.toLowerCase()
      .startsWith('application/json')
  ) {
    return res.status(415).json({
      error: 'JSON 요청이 필요합니다.',
    });
  }

  let body;

  try {
    body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('invalid_body');
    }

    if (!['login', 'signup', 'refresh', 'logout'].includes(body.action)) {
      throw new Error('invalid_action');
    }
  } catch {
    return res.status(400).json({
      error: '인증 요청 형식을 확인하세요.',
    });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  try {
    if (
      !url ||
      !key ||
      new URL(url).origin + '/auth/v1' !== config.identityProvider?.issuer
    ) {
      throw new Error('invalid_configuration');
    }
  } catch {
    return res.status(503).json({
      error: '서버 인증 설정을 확인하세요.',
    });
  }

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, options = {}) =>
        fetch(input, {
          ...options,
          signal: AbortSignal.timeout(15000),
        }),
    },
  });

  try {
    if (body.action === 'logout') {
      const authorization = req.headers.authorization;
      const match = typeof authorization === 'string'
        ? /^Bearer ([A-Za-z0-9._-]{1,8192})$/.exec(authorization)
        : null;

      if (!match) {
        return res.status(401).json({
          error: '로그인이 필요합니다.',
        });
      }

      const token = match[1];
      const { data, error } = await client.auth.getUser(token);

      if (error || !data?.user) {
        return res.status(401).json({
          error: '유효한 로그인이 필요합니다.',
        });
      }

      const result = await client.auth.admin.signOut(token, 'local');
      if (result.error) {
        return res.status(502).json({
          error: '로그아웃하지 못했습니다. 다시 시도하세요.',
        });
      }

      return res.status(200).json({ signedOut: true });
    }

    let result;

    if (body.action === 'refresh') {
      if (
        typeof body.refresh_token !== 'string' ||
        !body.refresh_token ||
        body.refresh_token.length > 8192
      ) {
        return res.status(400).json({
          error: '세션 갱신 정보가 필요합니다.',
        });
      }

      result = await client.auth.refreshSession({
        refresh_token: body.refresh_token,
      });
    } else {
      if (
        typeof body.email !== 'string' ||
        !body.email.trim() ||
        body.email.length > 254 ||
        typeof body.password !== 'string' ||
        body.password.length < 8 ||
        body.password.length > 1024
      ) {
        return res.status(400).json({
          error: '이메일과 비밀번호를 확인하세요.',
        });
      }

      const credentials = {
        email: body.email.trim(),
        password: body.password,
      };

      result = body.action === 'signup'
        ? await client.auth.signUp(credentials)
        : await client.auth.signInWithPassword(credentials);
    }

    if (result.error) {
      const status = result.error.status === 429 ? 429 : 401;

      return res.status(status).json({
        error: status === 429
          ? '요청이 많습니다. 잠시 뒤 다시 시도하세요.'
          : '인증하지 못했습니다. 다시 로그인하거나 이메일 인증 여부를 확인하세요.',
      });
    }

    return res.status(200).json({
      session: publicSession(result.data.session),
      confirmationRequired:
        body.action === 'signup' && !result.data.session,
    });
  } catch {
    return res.status(502).json({
      error: '인증 서버에 연결하지 못했습니다. 다시 시도하세요.',
    });
  }
}