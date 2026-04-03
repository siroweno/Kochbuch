const BROWSER_TEST_SESSION_KEY = 'kochbuch_browser_test_session_token';

async function parseJsonResponse(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(payload.error || payload.message || `Request failed with ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function normalizeProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    isActive: profile.is_active ?? profile.isActive ?? true,
  };
}

export function createBrowserTestAuthBackend() {
  let context = null;
  let sessionToken = window.localStorage.getItem(BROWSER_TEST_SESSION_KEY) || '';
  let browserTestRequestVersion = 0;

  function beginBrowserTestRequest() {
    browserTestRequestVersion += 1;
    return browserTestRequestVersion;
  }

  function isLatestBrowserTestRequest(requestVersion) {
    return requestVersion === browserTestRequestVersion;
  }

  function getBrowserTestHeaders() {
    return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
  }

  async function initializeBrowserTest() {
    const requestVersion = beginBrowserTestRequest();
    const { config } = context;

    try {
      const response = await fetch(`${config.browserTestBasePath}/session`, {
        headers: {
          'Content-Type': 'application/json',
          ...getBrowserTestHeaders(),
        },
      });
      const payload = await parseJsonResponse(response);
      if (!isLatestBrowserTestRequest(requestVersion)) {
        return;
      }
      const profile = normalizeProfile(payload.profile);
      context.setSnapshot({
        accessState: payload.accessState || (profile ? 'signed_in' : payload.sessionUser ? 'no_access' : 'signed_out'),
        sessionUser: payload.sessionUser || null,
        profile,
        canAdmin: profile?.role === 'admin',
        message: payload.message || '',
      });
    } catch (_error) {
      if (!isLatestBrowserTestRequest(requestVersion)) {
        return;
      }
      context.setSnapshot({
        accessState: 'signed_out',
        sessionUser: null,
        profile: null,
        canAdmin: false,
        message: 'Browser-Test-Backend konnte nicht erreicht werden.',
      });
    }
  }

  return {
    attach(nextContext) {
      context = nextContext;
    },

    async initialize() {
      await initializeBrowserTest();
    },

    async signInForBrowserTest(email) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error('Bitte gib eine E-Mail-Adresse ein.');
      }

      const requestVersion = beginBrowserTestRequest();
      const response = await fetch(`${context.config.browserTestBasePath}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = await parseJsonResponse(response);
      if (!isLatestBrowserTestRequest(requestVersion)) {
        return;
      }
      sessionToken = payload.sessionToken || '';
      if (sessionToken) {
        window.localStorage.setItem(BROWSER_TEST_SESSION_KEY, sessionToken);
      }
      const profile = normalizeProfile(payload.profile);
      context.setSnapshot({
        accessState: payload.accessState || (profile ? 'signed_in' : 'no_access'),
        sessionUser: payload.sessionUser || null,
        profile,
        canAdmin: profile?.role === 'admin',
        message: payload.message || 'Im Browser-Test-Backend wurdest du direkt angemeldet.',
      });
    },

    async signInWithGoogle() {
      throw new Error('Google-Login ist im Browser-Test-Modus nicht verfügbar.');
    },

    async requestMagicLink(email) {
      await this.signInForBrowserTest(email);
    },

    async signInWithPassword(email) {
      await this.signInForBrowserTest(email);
    },

    async requestPasswordReset(email) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error('Bitte gib eine E-Mail-Adresse ein.');
      }

      context.setSnapshot({
        accessState: 'signed_out',
        message: 'Passwort-Reset ist in diesem Build nicht aktiv. Bitte nutze den Test-Login.',
      });
    },

    async updatePassword(password) {
      const normalizedPassword = String(password || '');
      if (normalizedPassword.length < 6) {
        throw new Error('Das Passwort muss mindestens 6 Zeichen lang sein.');
      }

      context.setSnapshot({
        message: 'Passwort-Aenderung ist in diesem Build nicht aktiv. Bitte nutze den Test-Login.',
      });
    },

    async signOut() {
      const requestVersion = beginBrowserTestRequest();
      try {
        await fetch(`${context.config.browserTestBasePath}/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getBrowserTestHeaders(),
          },
        });
      } catch (_error) {
        // local cleanup is enough for browser-test mode
      }

      if (!isLatestBrowserTestRequest(requestVersion)) {
        return;
      }

      sessionToken = '';
      window.localStorage.removeItem(BROWSER_TEST_SESSION_KEY);
      context.setSnapshot({
        accessState: 'signed_out',
        sessionUser: null,
        profile: null,
        canAdmin: false,
        message: '',
      });
    },

    async syncProfileForCurrentUser() {
      return { attempted: false, available: false, synced: false };
    },

    getSupabaseClient() {
      return null;
    },

    getBrowserTestHeaders() {
      return getBrowserTestHeaders();
    },

    dispose() {},
  };
}
