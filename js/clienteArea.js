document.addEventListener('DOMContentLoaded', async () => {
  const info = document.getElementById('cliente-area-info');
  const historyBody = document.getElementById('cliente-historico-tbody');

  async function getSessionOrRedirect() {
    const { data, error } = await window.sb.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      window.location.href = '../login.html';
      return null;
    }
    return data.session;
  }

  async function loadDashboard() {
    const { data, error } = await window.Api.rpcWithFrontBarbearia('listar_meus_agendamentos');
    if (error) throw error;

    const rows = data || [];
    const now = new Date();
    const futuros = rows
      .filter((r) => r.status === 'agendado' && new Date(`${r.data}T${r.hora_inicio}`) > now)
      .sort((a, b) => new Date(`${a.data}T${a.hora_inicio}`) - new Date(`${b.data}T${b.hora_inicio}`));

    const proximo = futuros[0];
    document.getElementById('cliente-proximo').textContent = proximo
      ? `${window.AppUtils.formatDate(proximo.data)} ${String(proximo.hora_inicio).slice(0, 5)} - ${proximo.servico} com ${proximo.barbeiro}`
      : 'Nenhum agendamento futuro.';

    const historico = rows.filter((r) => r.status === 'concluido');
    historico.sort((a, b) => new Date(`${b.data}T${b.hora_inicio}`) - new Date(`${a.data}T${a.hora_inicio}`));
    document.getElementById('cliente-total-servicos').textContent = String(historico.length);
    document.getElementById('cliente-total-agendados').textContent = String(
      rows.filter((r) => r.status === 'agendado' || r.status === 'em_atendimento').length
    );

    historyBody.innerHTML = historico.length === 0
      ? '<tr><td colspan="4">Sem historico.</td></tr>'
      : historico.map((h) => `
        <tr>
          <td>${window.AppUtils.formatDate(h.data)}</td>
          <td>${h.servico}</td>
          <td>${h.barbeiro}</td>
          <td>${window.AppUtils.formatMoney(h.valor)}</td>
        </tr>
      `).join('');
  }

  try {
    const session = await getSessionOrRedirect();
    if (!session) return;

    const profile = await window.Auth.getUserProfile();
    const displayName = profile?.nome || session.user.user_metadata?.nome || session.user.email?.split('@')[0] || 'Cliente';
    const telefone = session.user.user_metadata?.telefone || null;

    const { error: ensureError } = await window.Api.rpcWithFrontBarbearia('garantir_cliente_auth', {
      p_nome: displayName,
      p_telefone: telefone,
      p_email: session.user.email || null
    });
    if (ensureError) throw ensureError;

    await window.CommonUI.setupLayout({
      nome: displayName,
      email: profile?.email || session.user.email || '',
      perfil: profile?.perfil || 'cliente'
    });
    document.getElementById('cliente-nome-topo').textContent = displayName;
    await loadDashboard();
  } catch (err) {
    window.AppUtils.notify(info, err.message, true);
  }
});
