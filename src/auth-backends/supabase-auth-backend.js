import { createClient } from '@supabase/supabase-js';

function normalizeProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    isActive: profile.is_active ?? profile.isActive ?? true,
  };
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

export function createSupabaseAuthBackend() {
  let context = null;
  let supabase = null;
  let unsubscribe = null;

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
    if (!supabase) return { attempted: false, available: false, synced: false };

    try {
      const { error } = await supabase.rpc('sync_profile_for_current_user');
      if (error) {
        return { attempted: true, available: false, synced: false, error };
      }
      return { attempted: true, available: true, synced: true };
    } catch (error) {
      return { attempted: true, available: false, synced: false, error };
    }
  }

  async function handleSupabaseSession(user, baseMessage = '') {
    if (!user) {
      context.setSnapshot({
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
    } catch (_error) {
      context.setSnapshot({
        accessState: 'no_access',
        sessionUser: { id: user.id, email: user.email || '' },
        profile: null,
        canAdmin: false,
        message: 'Profil konnte nicht geladen werden.',
      });
      return;
    }

    if (!profile || !profile.isActive) {
      context.setSnapshot({
        accessState: 'no_access',
        sessionUser: { id: user.id, email: user.email || '' },
        profile: null,
        canAdmin: false,
        message: syncResult.available
          ? 'Dein Profil konnte nicht vorbereitet werden.'
          : 'Kein aktives Profil gefunden.',
      });
      return;
    }

    context.setSnapshot({
      accessState: 'signed_in',
      sessionUser: { id: user.id, email: user.email || '' },
      profile,
      canAdmin: profile.role === 'admin',
      message: baseMessage,
    });
  }

  return {
    attach(nextContext) {
      context = nextContext;
    },

    async initialize() {
      const { config } = context;

      supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
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
        } catch (_error) {
          context.setSnapshot({
            accessState: 'signed_out',
            message: 'Magic Link konnte nicht verifiziert werden.',
          });
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        context.setSnapshot({
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
    },

    async signInForBrowserTest() {
      throw new Error('Test-Login ist in diesem Build nicht verfügbar.');
    },

    async signInWithGoogle() {
      const { config } = context;
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

      context.setSnapshot({
        accessState: 'loading',
        message: 'Google-Login wird vorbereitet...',
      });
    },

    async requestMagicLink() {
      context.setSnapshot({
        accessState: 'signed_out',
        message: 'Magic Link ist in diesem Build nicht mehr aktiv. Bitte nutze Google-Login.',
      });
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

      throw new Error('Passwort-Login ist in diesem Build nicht aktiv. Bitte nutze Google-Login.');
    },

    async requestPasswordReset(email) {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        throw new Error('Bitte gib eine E-Mail-Adresse ein.');
      }

      context.setSnapshot({
        accessState: 'signed_out',
        message: 'Passwort-Reset ist in diesem Build nicht aktiv. Bitte nutze Google-Login.',
      });
    },

    async updatePassword(password) {
      const normalizedPassword = String(password || '');
      if (normalizedPassword.length < 6) {
        throw new Error('Das Passwort muss mindestens 6 Zeichen lang sein.');
      }

      context.setSnapshot({
        message: 'Passwort-Aenderung ist in diesem Build nicht aktiv. Bitte nutze Google-Login.',
      });
    },

    async signOut() {
      if (supabase) {
        await supabase.auth.signOut({ scope: 'local' });
      }

      context.setSnapshot({
        accessState: 'signed_out',
        sessionUser: null,
        profile: null,
        canAdmin: false,
        message: '',
      });
    },

    async syncProfileForCurrentUser() {
      if (!supabase) {
        return { attempted: false, available: false, synced: false };
      }

      return syncProfileViaRpc();
    },

    getSupabaseClient() {
      return supabase;
    },

    getBrowserTestHeaders() {
      return {};
    },

    dispose() {
      if (unsubscribe) unsubscribe();
    },
  };
}
