document.addEventListener('DOMContentLoaded', async () => {
  const info = document.getElementById('meus-dados-info');
  const nomeInput = document.getElementById('meus-dados-nome');
  const telefoneInput = document.getElementById('meus-dados-telefone');
  const emailInput = document.getElementById('meus-dados-email');
  const nascimentoInput = document.getElementById('meus-dados-nascimento');

  if (!nomeInput || !telefoneInput || !emailInput || !nascimentoInput) {
    return;
  }

  function safeText(value, fallback = 'Nao informado') {
    const v = String(value || '').trim();
    return v || fallback;
  }

  function formatBirthDate(value) {
    if (!value) return 'Nao informado';

    const raw = String(value).trim();
    if (!raw) return 'Nao informado';

    const onlyDate = raw.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(onlyDate)) {
      return window.AppUtils.formatDate(onlyDate);
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('pt-BR');
    }

    return raw;
  }

  async function loadUsuarioExtra(usuarioId) {
    try {
      const { data, error } = await window.Api.scopeToFrontBarbearia(
        window.sb
          .from('usuarios')
          .select('nome, email, telefone, data_nascimento')
          .eq('id', usuarioId)
      ).maybeSingle();

      if (error) throw error;
      return data || null;
    } catch (_) {
      return null;
    }
  }

  try {
    const user = await window.Auth.requireAuth(['admin', 'barbeiro', 'cliente']);
    if (!user) return;

    await window.CommonUI.setupLayout(user);

    const session = await window.Auth.getSession();
    const usuarioExtra = await loadUsuarioExtra(user.id);
    const telefone = usuarioExtra?.telefone
      || session?.user?.user_metadata?.telefone
      || null;

    const nascimento = usuarioExtra?.data_nascimento
      || session?.user?.user_metadata?.data_nascimento
      || session?.user?.user_metadata?.dataNascimento
      || session?.user?.user_metadata?.nascimento
      || null;

    nomeInput.value = safeText(usuarioExtra?.nome || user.nome || session?.user?.user_metadata?.nome);
    telefoneInput.value = safeText(telefone);
    emailInput.value = safeText(usuarioExtra?.email || user.email || session?.user?.email);
    nascimentoInput.value = formatBirthDate(nascimento);

    if (!nascimento) {
      info.textContent = 'Data de nascimento ainda nao cadastrada para este usuario.';
    }
  } catch (err) {
    window.AppUtils.notify(info, err.message, true);
  }
});
