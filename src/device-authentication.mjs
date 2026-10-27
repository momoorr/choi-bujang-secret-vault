import { randomBytes } from 'node:crypto';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import {
  issueDeviceChallenge,
  consumeDeviceChallenge,
} from './device-registration.mjs';
import { deviceTokenHash } from './verify-device.mjs';

export async function beginDeviceAuthentication({
  database, userId, appUrl,
}) {
  const { data: devices, error } = await database
    .from('vault_devices')
    .select('credential_id, transports')
    .eq('owner_id', userId)
    .eq('status', 'approved');

  if (error) throw new Error('device_database_error');

  if (!devices.length) {
    throw new Error('approved_device_required');
  }

  const options = await generateAuthenticationOptions({
    rpID: new URL(appUrl).hostname,
    userVerification: 'required',
    allowCredentials: devices.map((device) => ({
      id: device.credential_id,
      transports: device.transports,
    })),
  });

  const requestId = await issueDeviceChallenge(
    database, userId, 'authentication', options.challenge
  );

  return { requestId, options };
}

export async function finishDeviceAuthentication({
  database, userId, appUrl, requestId, response,
}) {
  const challenge = await consumeDeviceChallenge(
    database, userId, 'authentication', requestId
  );

  if (
    typeof response?.id !== 'string' ||
    response.id.length > 2048
  ) {
    throw new Error('invalid_device_response');
  }

  const { data: device, error: readError } = await database
    .from('vault_devices')
    .select('credential_id, public_key, counter, transports')
    .eq('credential_id', response.id)
    .eq('owner_id', userId)
    .eq('status', 'approved')
    .maybeSingle();

  if (readError) throw new Error('device_database_error');
  if (!device) throw new Error('approved_device_required');

  const app = new URL(appUrl);

  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: app.origin,
    expectedRPID: app.hostname,
    requireUserVerification: true,
    credential: {
      id: device.credential_id,
      publicKey: new Uint8Array(
        Buffer.from(device.public_key, 'base64url')
      ),
      counter: Number(device.counter),
      transports: device.transports,
    },
  });

  if (!result.verified) {
    throw new Error('device_authentication_failed');
  }

  const info = result.authenticationInfo;

  if (
    info.credentialDeviceType !== 'singleDevice' ||
    info.credentialBackedUp !== false
  ) {
    throw new Error('device_bound_authenticator_required');
  }

  // 동시 처리 중 상태가 바뀌거나 승인이 철회되면 발급하지 않습니다.
  // 同時実行中の変更や承認取消があれば発行しません。
  const { data: updated, error: updateError } = await database
    .from('vault_devices')
    .update({ counter: info.newCounter })
    .eq('credential_id', device.credential_id)
    .eq('owner_id', userId)
    .eq('status', 'approved')
    .eq('counter', device.counter)
    .select('credential_id')
    .maybeSingle();

  if (updateError) throw new Error('device_database_error');
  if (!updated) throw new Error('device_state_changed');

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 900000).toISOString();

  const { error: sessionError } = await database
    .from('vault_device_sessions')
    .insert({
      token_hash: deviceTokenHash(token),
      credential_id: device.credential_id,
      owner_id: userId,
      expires_at: expiresAt,
    });

  if (sessionError) throw new Error('device_database_error');

  return {
    status: 'approved',
    token,
    expiresAt,
  };
}