import { createHash } from 'node:crypto';

// 원본 접속 증표는 DB에 저장하지 않습니다.
export function deviceTokenHash(token) {
  if (
    typeof token !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  ) {
    return null;
  }

  return createHash('sha256').update(token).digest('hex');
}

// userId에는 로그인 검증기가 확인한 사용자 ID만 전달합니다.
export async function verifyDevice({
  database,
  userId,
  token,
}) {
  const tokenHash = deviceTokenHash(token);

  if (!tokenHash || typeof userId !== 'string' || !userId) {
    return null;
  }

  const { data: session, error: sessionError } = await database
    .from('vault_device_sessions')
    .select('credential_id, owner_id, expires_at')
    .eq('token_hash', tokenHash)
    .eq('owner_id', userId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (sessionError) {
    throw new Error('device_verification_unavailable');
  }

  if (!session || session.owner_id !== userId) {
    return null;
  }

  // 승인 철회가 반영되도록 매 요청마다 현재 상태를 확인합니다.
  const { data: device, error: deviceError } = await database
    .from('vault_devices')
    .select('credential_id, owner_id, status')
    .eq('credential_id', session.credential_id)
    .eq('owner_id', userId)
    .eq('status', 'approved')
    .maybeSingle();

  if (deviceError) {
    throw new Error('device_verification_unavailable');
  }

  const expiresAt = Date.parse(session.expires_at);

  if (
    !device ||
    device.status !== 'approved' ||
    device.owner_id !== userId ||
    device.credential_id !== session.credential_id ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= Date.now()
  ) {
    return null;
  }

  return Object.freeze({
    credentialId: device.credential_id,
    userId,
  });
}
