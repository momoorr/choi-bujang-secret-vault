import { stampResponse } from '../../src/request-stamp.mjs';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../../src/verify-login.mjs';
import { verifyDevice } from '../../src/verify-device.mjs';

const config = JSON.parse(
  readFileSync(new URL('../../aleph.config.json', import.meta.url), 'utf8')
);

let verifyLogin;
let database;

export default async function handler(req, res) {
  stampResponse(res);
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
    if (!verifyLogin || !database) {
      const url = process.env.SUPABASE_URL;
      const secretKey = process.env.SUPABASE_SECRET_KEY;

      if (
        !url ||
        !secretKey ||
        new URL(url).origin + '/auth/v1' !==
          config.identityProvider?.issuer
      ) {
        throw new Error('missing_server_configuration');
      }

      const client = createClient(url, secretKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const verifier = createLoginVerifier({
        config,
        supabaseSecretKey: secretKey,
        supabaseClient: client,
      });

      database = client;
      verifyLogin = verifier;
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

  try {
    const device = await verifyDevice({
      database,
      userId: identity.userId,
      token: req.headers['x-vault-device'],
    });

    if (!device) {
      return res.status(403).json({
        error: 'approved_device_required',
      });
    }
  } catch {
    return res.status(503).json({
      error: 'device_verification_unavailable',
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