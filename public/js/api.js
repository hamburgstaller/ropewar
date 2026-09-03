/**
 * API client - fetch wrappers.
 * Session cookie is attached automatically (same-origin).
 */

async function request(method, path, body) {
  const opts = {
    method,
    credentials: 'same-origin',
    headers: {}
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  // Auth
  register: (email, username, password) =>
    request('POST', '/api/auth/register', { email, username, password }),
  login: (email, password) =>
    request('POST', '/api/auth/login', { email, password }),
  logout: () => request('POST', '/api/auth/logout'),
  me: () => request('GET', '/api/auth/me'),

  // Profile
  profile: () => request('GET', '/api/profile'),
  matchHistory: (limit = 20) => request('GET', `/api/profile/matches?limit=${limit}`),

  // Leaderboard
  leaderboard: (mode = 'overall', limit = 100) =>
    request('GET', `/api/leaderboard?mode=${mode}&limit=${limit}`),

  // Match
  createBotMatch: (mode, socketId) =>
    request('POST', '/api/match/bot', { mode, socketId })
};
