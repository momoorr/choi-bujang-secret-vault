import { createHash, randomUUID } from 'node:crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';

export async function issueDeviceChallenge(
  database, userId, purpose, challenge
) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + 300000).toISOString();

  const { count, error: countError } = await database
    .from('vault_device_challenges')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
    .gt('expires_at', new Date().toISOString());

  if (countError) throw new Error('device_database_error');
  if (count >= 5) throw new Error('device_requests_limited');

  const { error } = await database
    .from('vault_device_challenges')
    .insert({
      id,
      owner_id: userId,
      purpose,
      challenge,
      expires_at: expiresAt,
    });

  if (error) throw new Error('device_database_error');
  return id;
}

export async function consumeDeviceChallenge(
  database, userId, purpose, id
) {
  if (
    typeof id !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(id)
  ) {
    throw new Error('invalid_device_challenge');
  }

  // 삭제와 조회를 한 번에 처리해 같은 요청의 재사용을 막습니다.
  // 削除と取得を一度に行い、同じ要求の再利用を防ぎます。
  const { data, error } = await database
    .from('vault_device_challenges')
    .delete()
    .eq('id', id)
    .eq('owner_id', userId)
    .eq('purpose', purpose)
    .gt('expires_at', new Date().toISOString())
    .select('challenge')
    .maybeSingle();

  if (error) throw new Error('device_database_error');
  if (!data) throw new Error('invalid_device_challenge');
  return data.challenge;
}

export async function beginDeviceRegistration({
  database, userId, appUrl,
}) {
  const app = new URL(appUrl);

  const { data: devices, error } = await database
    .from('vault_devices')
    .select('credential_id')
    .eq('owner_id', userId);

  if (error) throw new Error('device_database_error');
  if (devices.length >= 10) {
    throw new Error('device_registration_limit');
  }

  const userHandle = createHash('sha256')
    .update(`vault-webauthn:${userId}`)
    .digest();

  const options = await generateRegistrationOptions({
    rpName: 'BYTE BACK',
    rpID: app.hostname,
    userID: new Uint8Array(userHandle),
    userName: userHandle.toString('hex'),
    attestationType: 'none',
    supportedAlgorithmIDs: [-7, -257],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'required',
      userVerification: 'required',
    },
    excludeCredentials: devices.map((device) => ({
      id: device.credential_id,
    })),
  });

  const requestId = await issueDeviceChallenge(
    database, userId, 'registration', options.challenge
  );

  return { requestId, options };
}

export async function finishDeviceRegistration({
  database, userId, appUrl, requestId, response,
}) {
  const challenge = await consumeDeviceChallenge(
    database, userId, 'registration', requestId
  );
  const app = new URL(appUrl);

  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: app.origin,
    expectedRPID: app.hostname,
    requireUserVerification: true,
  });

  if (!result.verified || !result.registrationInfo) {
    throw new Error('device_registration_failed');
  }

  const info = result.registrationInfo;

  // 다른 기기로 동기화되는 인증 수단은 등록하지 않습니다.
  if (
    info.credentialDeviceType !== 'singleDevice' ||
    info.credentialBackedUp !== false
  ) {
    throw new Error('device_bound_authenticator_required');
  }

  const credential = info.credential;

  const { error } = await database
    .from('vault_devices')
    .insert({
      credential_id: credential.id,
      owner_id: userId,
      public_key: Buffer.from(credential.publicKey)
        .toString('base64url'),
      counter: credential.counter,
      transports: credential.transports ?? [],
      status: 'pending',
    });

  if (error) throw new Error('device_registration_save_failed');

  return {
    status: 'pending',
    credentialId: credential.id,
  };
}