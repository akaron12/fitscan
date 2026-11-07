'use strict';
/* Google sign-in for Drive (Google Identity Services, token model, no backend).
   - The access token lives in memory only (never localStorage). It lasts about an hour.
   - signIn() must be called from a tap/click (browsers block popups otherwise).
   - renew() tries without any prompt; it can fail, in which case the UI shows "tap to sign in".
   Tested manually (spike/auth-v2.html showed the flow works in Safari and in the iPhone home-screen app). */
const DriveAuth = (() => {
  const CLIENT_ID = '806305125271-jqii8egsi0ifs1e1di3bkhnta4ram8bj.apps.googleusercontent.com';   // public, not a secret
  const SCOPE = 'https://www.googleapis.com/auth/drive';
  const SKEW_MS = 60e3;   // treat the token as expired a minute early
  let token = null, expiresAt = 0, client = null, pending = null, loading = null;
  const listeners = new Set();

  const state = () => token && Date.now() < expiresAt - SKEW_MS ? 'ok' : token ? 'expired' : 'signed-out';
  const emit = () => listeners.forEach(f => { try { f(state()); } catch {} });
  const getToken = () => state() === 'ok' ? token : null;

  function loadGis() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    return loading ||= new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = res; s.onerror = () => { loading = null; rej(Object.assign(new Error('Could not load Google sign-in (offline?)'), { kind: 'network' })); };
      document.head.appendChild(s);
    });
  }
  function init() {
    client ||= google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID, scope: SCOPE,
      callback: r => {
        const p = pending; pending = null;
        if (r.error) { p?.rej(Object.assign(new Error(r.error_description || r.error), { kind: r.error })); return; }
        token = r.access_token; expiresAt = Date.now() + (+r.expires_in || 3600) * 1000; emit(); p?.res(token);
      },
      error_callback: e => { const p = pending; pending = null; p?.rej(Object.assign(new Error(e.message || e.type || 'sign-in failed'), { kind: e.type || 'popup' })); },
    });
    return client;
  }
  async function request(prompt) {
    await loadGis();
    if (pending) pending.rej(Object.assign(new Error('superseded'), { kind: 'superseded' }));
    return new Promise((res, rej) => { pending = { res, rej }; init().requestAccessToken({ prompt }); });
  }
  /** Interactive sign-in (call from a click). Resolves with the token. */
  const signIn = () => request('');
  /** Quiet renewal; may reject (user has to tap sign in). */
  const renew = () => request('none');
  function signOut() {
    const t = token; token = null; expiresAt = 0; emit();
    try { if (t && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t, () => {}); } catch {}
  }
  /** Called with 'ok' | 'expired' | 'signed-out' whenever it changes (expiry is also checked every 30 s). */
  const onChange = cb => { listeners.add(cb); return () => listeners.delete(cb); };
  let last = state();
  setInterval(() => { const s = state(); if (s !== last) { last = s; emit(); } }, 30e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { const s = state(); if (s !== last) { last = s; emit(); } } });
  return { signIn, renew, signOut, getToken, state, onChange, CLIENT_ID, SCOPE };
})();
