import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';
import { verifyDevice } from '../src/verify-device.mjs';
import { stampResponse } from '../src/request-stamp.mjs';
import {
  createOperationsSummary,
} from '../src/operations-summary.mjs';

const config = JSON.parse(
  readFileSync(
    new URL('../aleph.config.json', import.meta.url),
    'utf8'
  )
);

let database;
let verifyLogin;

function initialize() {
  if (database && verifyLogin) return;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (
    !url ||
    !key ||
    new URL(url).origin + '/auth/v1' !==
      config.identityProvider?.issuer
  ) {
    throw new Error('invalid_server_configuration');
  }

  const client = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, options = {}) => fetch(input, {
        ...options,
        signal: AbortSignal.timeout(15000),
      }),
    },
  });

  const verifier = createLoginVerifier({
    config,
    supabaseSecretKey: key,
    supabaseClient: client,
  });

  database = client;
  verifyLogin = verifier;
}

export default async function handler(req, res) {
  const stamp = stampResponse(res);

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Vary', 'Authorization, X-Vault-Device');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');

    return res.status(405).json({
      error: '작전실은 조회 요청만 허용합니다.',
    });
  }

  if (!req.headers.authorization) {
    return res.status(401).json({
      error: '로그인이 필요합니다.',
    });
  }

  let identity;

  try {
    initialize();
    identity = await verifyLogin(req.headers.authorization);
  } catch {
    return res.status(503).json({
      error: '로그인 확인 서버에 연결하지 못했습니다.',
    });
  }

  if (!identity) {
    return res.status(401).json({
      error: '유효한 로그인이 필요합니다.',
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

  try {
    const summary = await createOperationsSummary({
      database,
      userId: identity.userId,
    });

    return res.status(200).json({
      ...summary,
      requestId: stamp.requestId,
      requestAt: stamp.requestAt,
      checkedAt: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({
      error: '작전실 요약을 생성하지 못했습니다.',
    });
  }
}