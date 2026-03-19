(function initSupabase() {
  const cfg = window.APP_CONFIG || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.error('Defina SUPABASE_URL e SUPABASE_ANON_KEY em js/config.js');
    return;
  }

  const frontBarbeariaId = String(cfg.FRONT_BARBEARIA_ID || '').trim();
  const frontBarbeariaSlug = String(cfg.FRONT_BARBEARIA_SLUG || '').trim();

  window.sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        'x-barbearia-id': frontBarbeariaId,
        'x-barbearia-slug': frontBarbeariaSlug
      }
    }
  });
})();
