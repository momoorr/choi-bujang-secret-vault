import { stampResponse } from '../src/request-stamp.mjs';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createLoginVerifier } from '../src/verify-login.mjs';
import {
  beginDeviceRegistration,
  finishDeviceRegistration,
} from '../src/device-registration.mjs';
import {
  beginDeviceAuthentication,
  finishDeviceAuthentication,
} from '../src/device-authentication.mjs';
import {
  verifyDevice,
  deviceTokenHash,
} from '../src/verify-device.mjs';

const config = JSON.parse(
  readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8')
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
    new URL(url).origin + '/auth/v1' !== config.identityProvider?.issuer
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

const actions = {
  registration_options: beginDeviceRegistration,
  registration_verify: finishDeviceRegistration,
  authentication_options: beginDeviceAuthentication,
  authentication_verify: finishDeviceAuthentication,
};

const messages = {
  approved_device_required:
    '승인된 기기가 없습니다. 승인 요청 후 관리자 확인이 필요합니다.',
  device_bound_authenticator_required:
    '동기화되지 않는 이 기기의 인증 수단이 필요합니다.',
  device_requests_limited:
    '진행 중인 요청이 많습니다. 5분 뒤 다시 시도하세요.',
  device_registration_limit:
    '기기 등록 한도에 도달했습니다. 관리자에게 문의하세요.',
  invalid_device_challenge:
    '인증 요청이 만료됐거나 이미 사용됐습니다. 다시 시도하세요.',
  device_state_changed:
    '기기 상태가 바뀌었습니다. 다시 확인하세요.',
};

export default async function handler(req, res) {
  stampResponse(res);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'POST 요청이 필요합니다.',
    });
  }

  if (req.headers.origin !== new URL(config.publicAppUrl).origin) {
    return res.status(403).json({
      error: '허용되지 않은 출처입니다.',
    });
  }

  if (!req.headers.authorization) {
    return res.status(401).json({
      error: '로그인이 필요합니다.',
    });
  }

  if (
    !/^application\/json(?:\s*;|$)/i.test(
      req.headers['content-type'] ?? ''
    )
  ) {
    return res.status(415).json({
      error: 'JSON 요청이 필요합니다.',
    });
  }

  let body;

  try {
    const raw = typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body);

    if (typeof raw !== 'string' || Buffer.byteLength(raw) > 65536) {
      throw new Error('invalid_body');
    }

    body = JSON.parse(raw);

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (key) => !['action', 'requestId', 'response'].includes(key)
      ) ||
      !(
        Object.hasOwn(actions, body.action) ||
        body.action === 'status' ||
        body.action === 'logout'
      )
    ) {
      throw new Error('invalid_body');
    }
  } catch {
    return res.status(400).json({
      error: '기기 인증 요청 형식을 확인하세요.',
    });
  }

  let identity;

  try {
    initialize();
    identity = await verifyLogin(req.headers.authorization);
  } catch {
    return res.status(503).json({
      error: '기기 인증 서버에 연결하지 못했습니다.',
    });
  }

  if (!identity) {
    return res.status(401).json({
      error: '유효한 로그인이 필요합니다.',
    });
  }

  // 기기 등록은 실제 앱 계정으로만 진행합니다.
  if (identity.kind !== 'student') {
    return res.status(403).json({
      error: '앱 계정으로 로그인해야 합니다.',
    });
  }

  try {
    const token = req.headers['x-vault-device'];

    if (body.action === 'status') {
      const verified = await verifyDevice({
        database,
        userId: identity.userId,
        token,
      });

      return res.status(200).json({
        status: verified ? 'approved' : 'verification_required',
      });
    }

    if (body.action === 'logout') {
      const hash = deviceTokenHash(token);

      if (hash) {
        const { error } = await database
          .from('vault_device_sessions')
          .delete()
          .eq('token_hash', hash)
          .eq('owner_id', identity.userId);

        if (error) throw new Error('device_database_error');
      }

      return res.status(200).json({ signedOut: true });
    }

    const result = await actions[body.action]({
      database,
      userId: identity.userId,
      appUrl: config.publicAppUrl,
      requestId: body.requestId,
      response: body.response,
    });

    return res.status(200).json(result);
  } catch (error) {
    const unavailable = error.message === 'device_database_error';

    return res.status(unavailable ? 503 : 403).json({
      error: unavailable
        ? '기기 인증 저장소에 연결하지 못했습니다.'
        : messages[error.message] ??
          '기기 인증을 확인하지 못했습니다. 다시 시도하세요.',
    });
  }
}