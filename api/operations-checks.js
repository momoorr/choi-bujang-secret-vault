import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';
import { verifyDevice } from '../src/verify-device.mjs';
import { stampResponse } from '../src/request-stamp.mjs';
import {
  runOperationChecks,
  readLatestOperationChecks,
} from '../src/operations-checks.mjs';

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

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({
      error: '허용되지 않은 요청입니다.',
    });
  }

  if (!req.headers.authorization) {
    return res.status(401).json({
      error: '로그인이 필요합니다.',
    });
  }

  if (
    req.method === 'POST' &&
    req.headers.origin !== new URL(config.publicAppUrl).origin
  ) {
    return res.status(403).json({
      error: '허용되지 않은 출처입니다.',
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

  if (identity.kind !== 'student') {
    return res.status(403).json({
      error: '앱 계정으로 로그인해야 합니다.',
    });
  }

  if (req.method === 'POST') {
    try {
      if (
        !/^application\/json(?:\s*;|$)/i.test(
          req.headers['content-type'] ?? ''
        )
      ) {
        return res.status(415).json({
          error: 'JSON 요청이 필요합니다.',
        });
      }

      const raw = typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);

      if (
        typeof raw !== 'string' ||
        Buffer.byteLength(raw) > 1024
      ) {
        throw new Error('invalid_body');
      }

      const body = JSON.parse(raw);

      if (
        !body ||
        Array.isArray(body) ||
        Object.keys(body).length !== 1 ||
        body.action !== 'run'
      ) {
        throw new Error('invalid_body');
      }
    } catch {
      return res.status(400).json({
        error: '점검 실행 요청 형식을 확인하세요.',
      });
    }
  }

  try {
    let report;

    if (req.method === 'POST') {
      const { data: recent, error } = await database
        .from('vault_operation_checks')
        .select('id')
        .eq('owner_id', identity.userId)
        .gt(
          'recorded_at',
          new Date(Date.now() - 30000).toISOString()
        )
        .limit(1);

      if (error) throw error;

      if (recent.length > 0) {
        res.setHeader('Retry-After', '30');
        return res.status(429).json({
          error: '방금 점검했습니다. 30초 뒤 다시 실행하세요.',
        });
      }

      report = await runOperationChecks({
        database,
        userId: identity.userId,
        config,
        authorization: req.headers.authorization,
        deviceToken: req.headers['x-vault-device'],
      });
    } else {
      report = await readLatestOperationChecks({
        database,
        userId: identity.userId,
      });
    }

    return res.status(200).json({
      ...report,
      requestId: stamp.requestId,
      requestAt: stamp.requestAt,
    });
  } catch {
    return res.status(503).json({
      error: '점검 실행 또는 저장 기록 조회에 실패했습니다.',
    });
  }
}