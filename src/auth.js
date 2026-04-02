const BROWSER_TEST_SESSION_KEY = 'kochbuch_browser_test_session_token';

function cloneSnapshot(snapshot) {
  return {
    backend: snapshot.backend,
    isConfigured: snapshot.isConfigured,
    accessState: snapshot.accessState,
    sessionUser: snapshot.sessionUser ? { ...snapshot.sessionUser } : null,
    profile: snapshot.profile ? { ...snapshot.profile } : null,
    canAdmin: snapshot.canAdmin,
    message: snapshot.message || '',
  };
}

function createBaseSnapshot(config) {
  return {
    backend: config.backend,
    isConfigured: config.isSupabaseConfigured,
    accessState: config.isSupabaseConfigured || config.backend === 'browser-test' ? 'loading' : 'config_missing',
    sessionUser: null,
    profile: null,
    canAdmin: false,
    message: '',
  };
}

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

function cleanAuthCallbackUrl() {
  const url = new URL(window.location.href);
  const params = ['token_hash', 'type', 'access_token', 'refresh_token', 'expires_in', 'expires_at'];
  let mutated = false;

  params.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      mutated = true;
    }
  });

  if (window.location.hash.includes('access_token')) {
    url.hash = '';
    mutated = true;
  }

  if (mutated) {
    window.history.replaceState({}, document.title, url.toString());
  }
}

export function createAuthService(config) {
  const listeners = new Set();
  let snapshot = createBaseSnapshot(config);
  let supabase = null;
  let unsubscribe = null;
  let sessionToken = window.localStorage.getItem(BROWSER_TEST_SESSION_KEY) || '';
  let browserTestRequestVersion = 0;

  function notify() {
    const value = cloneSnapshot(snapshot);
    listeners.forEach((listener) => listener(value));
  }

  function setSnapshot(nextPartial) {
    snapshot = {
      ...snapshot,
      ...nextPartial,
      canAdmin: nextPartial.profile
        ? nextPartial.profile.role === 'admin' && nextPartial.profile.isActive !== false
        : nextPartial.canAdmin ?? snapshot.canAdmin,
    };
    notify();
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

  function beginBrowserTestRequest() {
    browserTestRequestVersion += 1;
    return browserTestRequestVersion;
  }

  function isLatestBrowserTestRequest(requestVersion) {
    return requestVersion === browserTestRequestVersion;
  }

  async function fetchProfileForCurrentUser(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,role,is_active')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return normalizeProfile(data);
  }

  async function syncProfileViaRpc() {
    if (config.backend !== 'supabase' || !supabase) return { attempted: false, available: false, synced: false };

    try {
      const { error } = await supabase.rpc('sync_profile_for_current_user');
      if (!error) {
        return { attempted: true, available: true, synced: true };
      }

      const fallback = await supabase.rpc('sync_profile_from_allowlist');
      if (fallback.error) {
        return { attempted: true, available: false, synced: false, error: fallback.error };
      }
      return { attempted: true, available: true, synced: true };
    } catch (error) {
      return { attempted: true, available: false, synced: false, error };
    }
  }

  async function handleSupabaseSession(user, baseMessage = '') {
    if (!user) {
      setSnapshot({
        accessState: 'signed_out',
        sessionUser: null,
        profile: null,
        canAdmin: false,
        message: baseMessage,
      });
      return;
    }

    const syncResult = await syncProfileViaRpc();
    let profile = null;

    try {
      profile = await fetchProfileForCurrentUser(user.id);
    } catch (error) {
      setSnapshot({
        accessState: 'no_access',
        sessionUser: { id: user.id, email: user.email || '' },
        profile: null,
        canAdmin: false,
        message: 'Profil konnte nicht geladen werden.',
      });
      return;
    }

    if (!profile || !profile.isActive) {
      setSnapshot({
        accessState: 'no_access',
        sessionUser: { id: user.id, email: user.email || '' },
        profile: null,
        canAdmin: false,
        message: syncResult.available
          ? 'Dein Profil konnte nicht vorbereitet werden.'
          : 'Kein aktives Profil gefunden. Falls die Rollen-Migration gerade noch nicht aktiv ist, versuche es gleich noch einmal.',
      });
      return;
    }

    setSnapshot({
      accessState: 'signed_in',
      sessionUser: { id: user.id, email: user.email || '' },
      profile,
      canAdmin: profile.role === 'admin',
      message: baseMessage,
    });
  }

  async function initializeSupabase() {
    if (!window.supabase?.createClient) {
      throw new Error('Supabase SDK wurde nicht geladen.');
    }

    supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    const url = new URL(window.location.href);
    if (url.searchParams.has('token_hash') && url.searchParams.has('type')) {
      try {
        await supabase.auth.verifyOtp({
          token_hash: url.searchParams.get('token_hash'),
          type: url.searchParams.get('type'),
        });
        cleanAuthCallbackUrl();
      } catch (error) {
        setSnapshot({
          accessState: 'signed_out',
          message: 'Magic Link konnte nicht verifiziert werden.',
        });
      }
    }

    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setSnapshot({
        accessState: 'signed_out',
        message: 'Session konnte nicht geladen werden.',
      });
    } else {
      await handleSupabaseSession(data.session?.user || null);
    }

    const listener = supabase.auth.onAuthStateChange(async (_event, session) => {
      await handleSupabaseSession(session?.user || null);
    });

    unsubscribe = () => listener.data.subscription.unsubscribe();
  }

  function getBrowserTestHeaders() {
    return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
  }

  async function initializeBrowserTest() {
    const requestVersion = beginBrowserTestRequest();

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
      setSnapshot({
        accessState: payload.accessState || (profile ? 'signed_in' : payload.sessionUser ? 'no_access' : 'signed_out'),
        sessionUser: payload.sessionUser || null,
        profile,
        canAdmin: profile?.role === 'admin',
        message: payload.message || '',
      });
    } catch (error) {
      if (!isLatestBrowserTestRequest(requestVersion)) {
        return;
      }
      setSnapshot({
        accessState: 'signed_out',
        sessionUser: null,
        profile: null,
        canAdmin: false,
        message: 'Browser-Test-Backend konnte nicht erreicht werden.',
      });
    }
  }

  return {
    async initialize() {
      if (config.backend === 'supabase' && !config.isSupabaseConfigured) {
        setSnapshot({
          isConfigured: false,
          accessState: 'config_missing',
          message: 'Supabase-Konfiguration fehlt.',
        });
        return cloneSnapshot(snapshot);
      }

      if (config.backend === 'browser-test') {
        await initializeBrowserTest();
        return cloneSnapshot(snapshot);
      }

      await initializeSupabase();
      return cloneSnapshot(snapshot);
    },

    async signInForBrowserTest(email) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error('Bitte gib eine E-Mail-Adresse ein.');
      }

      if (config.backend !== 'browser-test') {
        throw new Error('Test-Login ist nur im Browser-Test-Modus verfügbar.');
      }

      const requestVersion = beginBrowserTestRequest();
      const response = await fetch(`${config.browserTestBasePath}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = await parseJsonResponse(response);
      if (!isLatestBrowserTestRequest(requestVersion)) {
        return cloneSnapshot(snapshot);
      }
      sessionToken = payload.sessionToken || '';
      if (sessionToken) {
        window.localStorage.setItem(BROWSER_TEST_SESSION_KEY, sessionToken);
      }
      const profile = normalizeProfile(payload.profile);
      setSnapshot({
        accessState: payload.accessState || (profile ? 'signed_in' : 'no_access'),
        sessionUser: payload.sessionUser || null,
        profile,
        canAdmin: profile?.role === 'admin',
        message: payload.message || 'Im Browser-Test-Backend wurdest du direkt angemeldet.',
      });
      return cloneSnapshot(snapshot);
    },

    async signInWithGoogle() {
      if (config.backend === 'browser-test') {
        throw new Error('Google-Login ist im Browser-Test-Modus nicht verfügbar.');
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: config.redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        throw error;
      }

      setSnapshot({
        accessState: 'loading',
        message: 'Google-Login wird vorbereitet...',
      });
      return cloneSnapshot(snapshot);
    },

    async requestMagicLink(email) {
      if (config.backend === 'browser-test') {
        return this.signInForBrowserTest(email);
      }
      setSnapshot({
        accessState: 'signed_out',
        message: 'Magic Link ist in diesem Build nicht mehr aktiv. Bitte nutze Google-Login.',
      });
      return cloneSnapshot(snapshot);
    },

    async signInWithPassword(email, password) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const normalizedPassword = String(password || '');

      if (!normalizedEmail) {
        throw new Error('Bitte gib eine E-Mail-Adresse ein.');
      }

      if (!normalizedPassword) {
        throw new Error('Bitte gib dein Passwort ein.');
      }

      if (config.backend === 'browser-test') {
        return this.signInForBrowserTest(normalizedEmail);
      }
      throw new Error('Passwort-Login ist in diesem Build nicht aktiv. Bitte nutze Google-Login.');
    },

    async requestPasswordReset(email) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error('Bitte gib eine E-Mail-Adresse ein.');
      }

      setSnapshot({
        accessState: 'signed_out',
        message: 'Passwort-Reset ist in diesem Build nicht aktiv. Bitte nutze Google-Login.',
      });
      return cloneSnapshot(snapshot);
    },

    async updatePassword(password) {
      const normalizedPassword = String(password || '');
      if (normalizedPassword.length < 6) {
        throw new Error('Das Passwort muss mindestens 6 Zeichen lang sein.');
      }

      setSnapshot({
        message: 'Passwort-Aenderung ist in diesem Build nicht aktiv. Bitte nutze Google-Login.',
      });
      return cloneSnapshot(snapshot);
    },

    async signOut() {
      if (config.backend === 'browser-test') {
        const requestVersion = beginBrowserTestRequest();
        try {
          await fetch(`${config.browserTestBasePath}/logout`, {
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
          return cloneSnapshot(snapshot);
        }

        sessionToken = '';
        window.localStorage.removeItem(BROWSER_TEST_SESSION_KEY);
        setSnapshot({
          accessState: 'signed_out',
          sessionUser: null,
          profile: null,
          canAdmin: false,
          message: '',
        });
        return cloneSnapshot(snapshot);
      }

      if (supabase) {
        await supabase.auth.signOut({ scope: 'local' });
      }

      setSnapshot({
        accessState: 'signed_out',
        sessionUser: null,
        profile: null,
        canAdmin: false,
        message: '',
      });
      return cloneSnapshot(snapshot);
    },

    async syncProfileFromAllowlist() {
      if (config.backend !== 'supabase' || !supabase) {
        return { attempted: false, available: false, synced: false };
      }

      return syncProfileViaRpc();
    },

    getSnapshot() {
      return cloneSnapshot(snapshot);
    },

    onAuthStateChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSupabaseClient() {
      return supabase;
    },

    getBrowserTestHeaders() {
      return getBrowserTestHeaders();
    },

    dispose() {
      if (unsubscribe) unsubscribe();
      listeners.clear();
    },
  };
}
