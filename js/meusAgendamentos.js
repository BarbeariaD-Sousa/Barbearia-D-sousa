document.addEventListener('DOMContentLoaded', async () => {
  const info = document.getElementById('meus-agendamentos-info');
  const tbody = document.getElementById('meus-agendamentos-tbody');
  const tabs = document.querySelectorAll('[data-status-tab]');
  let activeStatus = 'agendado';
  let cache = [];
  let clienteNome = 'Cliente';

  async function requireSession() {
    const { data, error } = await window.sb.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      window.location.href = '../login.html';
      return null;
    }
    return data.session;
  }

  function timeLabel(v) {
    return String(v).slice(0, 5);
  }

  function normalizePhone(value) {
    return window.AppUtils.normalizePhone(value);
  }

  function whatsappLink(row) {
    const phone = normalizePhone(row.barbeiro_telefone);
    if (!phone) return '';

    const mensagem = `Ola, ${row.barbeiro}. Confirmando meu agendamento de ${row.servico} para o dia ${window.AppUtils.formatDate(row.data)} as ${timeLabel(row.hora_inicio)}.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;
  }

  function actionCell(row) {
    const actions = [];

    if (row.status === 'agendado' && row.barbeiro_telefone) {
      actions.push(`<a class="btn-whatsapp" href="${window.AppUtils.escapeAttr(whatsappLink(row))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`);
    }

    if (row.status === 'agendado' && row.pode_cancelar) {
      actions.push(`<button type="button" class="btn-danger" data-cancel-id="${row.id}">Cancelar</button>`);
    }

    return actions.length ? `<div class="action-wrap">${actions.join('')}</div>` : '-';
  }

  function renderRows() {
    const rows = cache.filter((r) => {
      if (activeStatus === 'cancelado') {
        return r.status === 'cancelado' || r.status === 'desistencia_cliente';
      }
      return r.status === activeStatus;
    });
    rows.sort((a, b) => new Date(`${b.data}T${b.hora_inicio}`) - new Date(`${a.data}T${a.hora_inicio}`));

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6">Sem agendamentos nesse status.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${r.barbeiro}</td>
        <td>${r.servico}</td>
        <td>${window.AppUtils.formatDate(r.data)}</td>
        <td>${timeLabel(r.hora_inicio)} - ${timeLabel(r.hora_fim)}</td>
        <td><span class="badge ${r.status}">${r.status}</span></td>
        <td>${actionCell(r)}</td>
      </tr>
    `).join('');
  }

  async function loadData() {
    const { data, error } = await window.Api.rpcWithFrontBarbearia('listar_meus_agendamentos');
    if (error) throw error;
    cache = data || [];
    renderRows();
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activeStatus = tab.dataset.statusTab;
      tabs.forEach((t) => t.classList.toggle('active', t === tab));
      renderRows();
    });
  });

  tbody.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-cancel-id]');
    if (!btn) return;

    try {
      const row = cache.find((item) => String(item.id) === String(btn.dataset.cancelId));
      const { error } = await window.Api.rpcWithFrontBarbearia('cancelar_agendamento_cliente', {
        p_agendamento_id: btn.dataset.cancelId
      });
      if (error) throw error;
      if (row) {
        window.AppUtils.notifyCancelamentoWhatsapp(info, {
          status: 'cancelado',
          destinoNome: row.barbeiro,
          destinoTipo: 'barbeiro',
          destinoTelefone: row.barbeiro_telefone,
          servicoNome: row.servico,
          data: row.data,
          hora: row.hora_inicio,
          autorNome: clienteNome,
          autorTipo: 'cliente',
          motivo: 'Cancelado pelo cliente'
        });
      } else {
        window.AppUtils.notify(info, 'Agendamento cancelado com sucesso.');
      }
      await loadData();
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  try {
    const session = await requireSession();
    if (!session) return;

    const profile = await window.Auth.getUserProfile();
    clienteNome = profile?.nome || session.user.user_metadata?.nome || session.user.email?.split('@')[0] || 'Cliente';

    await window.CommonUI.setupLayout({
      nome: clienteNome,
      email: profile?.email || session.user.email || '',
      perfil: profile?.perfil || 'cliente'
    });
    await loadData();
  } catch (err) {
    window.AppUtils.notify(info, err.message, true);
  }
});
