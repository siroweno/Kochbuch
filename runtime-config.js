const existingConfig = window.__KOCHBUCH_CONFIG__ || {};

window.__KOCHBUCH_CONFIG__ = {
  backend: existingConfig.backend || 'supabase',
  supabaseUrl: existingConfig.supabaseUrl || 'https://pcpqtcumettprxqfyomc.supabase.co',
  supabaseAnonKey: existingConfig.supabaseAnonKey || 'sb_publishable_xvG14kD7J8moaCYkbLTVlA_1mCNmkbf',
  ...existingConfig,
};
