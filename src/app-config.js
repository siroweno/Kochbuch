const DEFAULT_BROWSER_TEST_BASE_PATH = '/api/browser-test';

function readRuntimeConfig() {
  return window.__KOCHBUCH_CONFIG__ && typeof window.__KOCHBUCH_CONFIG__ === 'object'
    ? window.__KOCHBUCH_CONFIG__
    : {};
}

export function getAppConfig() {
  const runtime = readRuntimeConfig();
  const allowBrowserTest = runtime.allowBrowserTest === true;
  const backend = allowBrowserTest && runtime.backend === 'browser-test'
    ? 'browser-test'
    : 'supabase';

  const redirectTo = runtime.redirectTo || `${window.location.origin}${window.location.pathname}`;
  const supabaseUrl = String(runtime.supabaseUrl || '').trim();
  const supabaseAnonKey = String(runtime.supabaseAnonKey || '').trim();
  const browserTestBasePath = runtime.browserTestBasePath || DEFAULT_BROWSER_TEST_BASE_PATH;

  return {
    backend,
    allowBrowserTest,
    redirectTo,
    supabaseUrl,
    supabaseAnonKey,
    browserTestBasePath,
    isSupabaseConfigured: backend !== 'supabase' || Boolean(supabaseUrl && supabaseAnonKey),
  };
}
