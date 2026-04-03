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
    accessState: config.isSupabaseConfigured ? 'loading' : 'config_missing',
    sessionUser: null,
    profile: null,
    canAdmin: false,
    message: '',
  };
}

export function createAuthService({ config, backend }) {
  const listeners = new Set();
  let snapshot = createBaseSnapshot(config);

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

  const service = {
    async initialize() {
      if (config.backend === 'supabase' && !config.isSupabaseConfigured) {
        setSnapshot({
          isConfigured: false,
          accessState: 'config_missing',
          message: 'Supabase-Konfiguration fehlt.',
        });
        return cloneSnapshot(snapshot);
      }

      await backend.initialize();
      return cloneSnapshot(snapshot);
    },

    async signInForBrowserTest(email) {
      await backend.signInForBrowserTest(email);
      return cloneSnapshot(snapshot);
    },

    async signInWithGoogle() {
      await backend.signInWithGoogle();
      return cloneSnapshot(snapshot);
    },

    async requestMagicLink(email) {
      await backend.requestMagicLink(email);
      return cloneSnapshot(snapshot);
    },

    async signInWithPassword(email, password) {
      await backend.signInWithPassword(email, password);
      return cloneSnapshot(snapshot);
    },

    async requestPasswordReset(email) {
      await backend.requestPasswordReset(email);
      return cloneSnapshot(snapshot);
    },

    async updatePassword(password) {
      await backend.updatePassword(password);
      return cloneSnapshot(snapshot);
    },

    async signOut() {
      await backend.signOut();
      return cloneSnapshot(snapshot);
    },

    async syncProfileForCurrentUser() {
      return backend.syncProfileForCurrentUser();
    },

    getSnapshot() {
      return cloneSnapshot(snapshot);
    },

    onAuthStateChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSupabaseClient() {
      return backend.getSupabaseClient();
    },

    getBrowserTestHeaders() {
      return backend.getBrowserTestHeaders();
    },

    dispose() {
      backend.dispose();
      listeners.clear();
    },
  };

  backend.attach({
    config,
    getSnapshot: () => cloneSnapshot(snapshot),
    setSnapshot,
  });

  return service;
}
