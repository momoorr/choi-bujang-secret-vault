import { readFileSync } from 'node:fs';
import { createLoginVerifier } from '../../src/verify-login.mjs';

const config = JSON.parse(
  readFileSync(new URL('../../aleph.config.json', import.meta.url), 'utf8')
);

let verifyLogin;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'notice_read_only',
    });
  }

  if (!req.headers.authorization) {
    return res.status(401).json({
      error: 'login_required',
    });
  }

  let identity;
  try {
    if (!verifyLogin) {
      const secretKey = process.env.SUPABASE_SECRET_KEY;
      if (!secretKey) throw new Error('missing_server_configuration');

      verifyLogin = createLoginVerifier({
        config,
        supabaseSecretKey: secretKey,
      });
    }

    identity = await verifyLogin(req.headers.authorization);
  } catch {
    return res.status(503).json({
      error: 'authentication_unavailable',
    });
  }

  if (!identity) {
    return res.status(401).json({
      error: 'invalid_login',
    });
  }

  if (req.query?.id !== 'class-welcome') {
    return res.status(404).json({
      error: 'notice_not_found',
    });
  }

  return res.status(200).json({
    id: 'class-welcome',
    title: '학습용 반 공지',
    body: '이 공지는 권한 분리 실습을 위한 가상 자료입니다.',
  });
}