function authenticationLibrary() {
  const library = window.SimpleWebAuthnBrowser;

  if (
    !window.isSecureContext ||
    !window.PublicKeyCredential ||
    typeof library?.startRegistration !== 'function' ||
    typeof library?.startAuthentication !== 'function'
  ) {
    throw new Error(
      '이 환경에서는 기기 인증을 사용할 수 없습니다. HTTPS 주소와 지원 브라우저를 확인하세요.'
    );
  }

  return library;
}

export async function deviceRequest(
  action,
  session,
  fields = {},
  deviceToken
) {
  if (!navigator.onLine) {
    throw new Error('인터넷 연결 후 다시 시도하세요.');
  }

  if (!session?.access_token) {
    throw new Error('다시 로그인하세요.');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };

  if (deviceToken) {
    headers['X-Vault-Device'] = deviceToken;
  }

  const response = await fetch('/api/device', {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...fields, action }),
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      result?.error || '기기 인증 요청에 실패했습니다.'
    );
    error.status = response.status;
    throw error;
  }

  if (!result || typeof result !== 'object') {
    throw new Error('기기 인증 응답을 확인하지 못했습니다.');
  }

  return result;
}

function explainAuthenticationError(error) {
  if (
    error?.name === 'NotAllowedError' ||
    error?.name === 'AbortError'
  ) {
    return new Error(
      '기기 인증이 취소됐거나 시간이 지났습니다. 다시 시도하세요.'
    );
  }

  if (error?.name === 'InvalidStateError') {
    return new Error(
      '이미 등록된 인증 수단일 수 있습니다. 승인 상태 다시 확인을 눌러 주세요.'
    );
  }

  return error;
}

export async function registerDevice(session) {
  const library = authenticationLibrary();

  const request = await deviceRequest(
    'registration_options',
    session
  );

  let response;

  try {
    response = await library.startRegistration({
      optionsJSON: request.options,
    });
  } catch (error) {
    throw explainAuthenticationError(error);
  }

  return deviceRequest(
    'registration_verify',
    session,
    {
      requestId: request.requestId,
      response,
    }
  );
}

export async function authenticateDevice(session) {
  const library = authenticationLibrary();

  const request = await deviceRequest(
    'authentication_options',
    session
  );

  let response;

  try {
    response = await library.startAuthentication({
      optionsJSON: request.options,
    });
  } catch (error) {
    throw explainAuthenticationError(error);
  }

  return deviceRequest(
    'authentication_verify',
    session,
    {
      requestId: request.requestId,
      response,
    }
  );
}