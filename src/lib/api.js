function getClientId() {
  if (typeof window === 'undefined') return 'server';
  let clientId = window.localStorage.getItem('couple-food-client-id');
  if (!clientId) {
    clientId = window.crypto?.randomUUID?.() || `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem('couple-food-client-id', clientId);
  }
  return clientId;
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

export async function fetchRemoteState(key) {
  return requestJson(`/api/state/${encodeURIComponent(key)}?clientId=${encodeURIComponent(getClientId())}`);
}

export async function upsertRemoteState(key, value) {
  return requestJson(`/api/state/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({
      clientId: getClientId(),
      value,
    }),
  });
}

export { getClientId };

export async function createCouple() {
  return requestJson('/api/couple/create', {
    method: 'POST',
    body: JSON.stringify({ clientId: getClientId() }),
  });
}

export async function joinCouple(code) {
  return requestJson('/api/couple/join', {
    method: 'POST',
    body: JSON.stringify({ code, clientId: getClientId() }),
  });
}

export async function getCoupleStatus() {
  return requestJson(`/api/couple/status?clientId=${encodeURIComponent(getClientId())}`);
}

export async function fetchCoupleState(coupleId, key, since) {
  const params = new URLSearchParams({ since: String(since || 0) });
  return requestJson(`/api/couple-state/${encodeURIComponent(coupleId)}/${encodeURIComponent(key)}?${params}`);
}

export async function upsertCoupleState(coupleId, key, value) {
  return requestJson(`/api/couple-state/${encodeURIComponent(coupleId)}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}
