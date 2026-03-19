document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.Auth.requireAuth(['admin']);
  if (!user) return;

  await window.CommonUI.setupLayout(user);
  await window.Api.runAutoCompletion();

  const info = document.getElementById('agenda-info');
  const tbody = document.getElementById('lista-agendamentos');
  const filtroBarbeiro = document.getElementById('filtro-barbeiro');
  const periodoSelect = document.getElementById('agenda-periodo-admin');
  const dataInicioInput = document.getElementById('agenda-data-inicio-admin');
  const dataFimInput = document.getElementById('agenda-data-fim-admin');
  const inicioWrap = document.getElementById('agenda-admin-inicio-wrap');
  const fimWrap = document.getElementById('agenda-admin-fim-wrap');
  const aplicarFiltroBtn = document.getElementById('btn-aplicar-filtro-agenda-admin');
  const toggleFiltroBtn = document.getElementById('btn-toggle-filtro-agenda-admin');
  const filtrosPanel = document.getElementById('agenda-filtros-panel');
  const dataLabel = document.getElementById('agenda-data-label');
  const quickPeriodButtons = document.querySelectorAll('[data-quick-period]');

  if (!tbody || !filtroBarbeiro || !periodoSelect || !dataInicioInput || !dataFimInput || !aplicarFiltroBtn || !toggleFiltroBtn || !filtrosPanel || !dataLabel || quickPeriodButtons.length === 0) {
    window.AppUtils.notify(info, 'Elementos da agenda nao foram encontrados.', true);
    return;
  }

  const hojeISO = window.AppUtils.todayISO();
  dataInicioInput.value = hojeISO;
  dataFimInput.value = hojeISO;

  function toDateOnly(value) {
    return new Date(`${value}T00:00:00`);
  }

  function showDateFilters() {
    const isCustom = (periodoSelect.value || 'dia') === 'personalizado';
    if (inicioWrap) inicioWrap.hidden = !isCustom;
    if (fimWrap) fimWrap.hidden = !isCustom;
  }

  function syncQuickPeriodButtons() {
    quickPeriodButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.quickPeriod === (periodoSelect.value || 'dia'));
    });
  }

  function setFilterPanelState(open) {
    filtrosPanel.classList.toggle('is-open', open);
    toggleFiltroBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggleFiltroBtn.textContent = open ? 'Fechar filtro' : 'Filtro';
  }

  function periodRange(periodo) {
    if (periodo === 'personalizado') {
      const inicioCustom = dataInicioInput.value;
      const fimCustom = dataFimInput.value;

      if (!inicioCustom || !fimCustom) {
        throw new Error('Informe data inicial e data final para o periodo personalizado.');
      }

      const inicioDate = toDateOnly(inicioCustom);
      const fimDate = toDateOnly(fimCustom);
      if (inicioDate > fimDate) {
        throw new Error('A data inicial nao pode ser maior que a data final.');
      }

      return {
        inicioISO: window.AppUtils.dateToISO(inicioDate),
        fimISO: window.AppUtils.dateToISO(fimDate)
      };
    }

    const ref = toDateOnly(hojeISO);
    const inicio = new Date(ref);
    const fim = new Date(ref);

    if (periodo === 'semana') {
      inicio.setDate(inicio.getDate() - inicio.getDay());
      fim.setDate(inicio.getDate() + 6);
    } else if (periodo === 'mes') {
      inicio.setDate(1);
      fim.setMonth(inicio.getMonth() + 1);
      fim.setDate(0);
    }

    return {
      inicioISO: window.AppUtils.dateToISO(inicio),
      fimISO: window.AppUtils.dateToISO(fim)
    };
  }

  function updatePeriodLabel(inicioISO, fimISO) {
    if (inicioISO === fimISO) {
      dataLabel.textContent = window.AppUtils.formatDate(inicioISO);
      return;
    }

    dataLabel.textContent = `${window.AppUtils.formatDate(inicioISO)} ate ${window.AppUtils.formatDate(fimISO)}`;
  }

  async function loadBarbeirosFilter() {
    const { data, error } = await window.Api.rpcWithFrontBarbearia('listar_barbeiros_publico');
    if (error) throw error;

    const rows = data || [];
    if (rows.length === 0) {
      filtroBarbeiro.innerHTML = '<option value="">Sem barbeiros cadastrados</option>';
      return;
    }

    const options = ['<option value="">Todos os barbeiros</option>']
      .concat(rows.map((b) => `<option value="${b.id}">${b.nome}</option>`));
    filtroBarbeiro.innerHTML = options.join('');
  }

  function actionsForRow(row) {
    const locked = ['concluido', 'cancelado', 'desistencia_cliente'].includes(row.status);
    if (locked) {
      return '<span class="muted">Sem acoes</span>';
    }

    return `
      <div class="action-wrap">
        <button class="btn-danger" data-action="cancelar" data-id="${row.id}">Cancelar</button>
        <button class="btn-warning" data-action="desistencia" data-id="${row.id}">Desistencia</button>
      </div>
    `;
  }

  async function loadAgendamentos() {
    try {
      await window.Api.runAutoCompletion();
      const { inicioISO, fimISO } = periodRange(periodoSelect.value || 'dia');
      updatePeriodLabel(inicioISO, fimISO);

      let query = window.Api.scopeToFrontBarbearia(
        window.sb
          .from('agendamentos')
          .select(`
            id,
            data,
            hora_inicio,
            hora_fim,
            status,
            pagamento_status,
            valor,
            clientes(nome),
            barbeiros(nome),
            servicos(nome)
          `)
          .gte('data', inicioISO)
          .lte('data', fimISO)
          .order('data', { ascending: false })
          .order('hora_inicio', { ascending: false })
      );

      if (filtroBarbeiro.value) {
        query = query.eq('barbeiro_id', filtroBarbeiro.value);
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      tbody.innerHTML = (rows || []).length === 0
        ? '<tr><td colspan="8">Sem agendamentos para o periodo selecionado.</td></tr>'
        : rows.map((r) => `
          <tr>
            <td>${r.clientes?.nome || '-'}</td>
            <td>${r.barbeiros?.nome || '-'}</td>
            <td>${r.servicos?.nome || '-'}</td>
            <td>${window.AppUtils.formatDate(r.data)} | ${String(r.hora_inicio).slice(0, 5)} - ${String(r.hora_fim).slice(0, 5)}</td>
            <td><span class="badge ${r.status}">${r.status}</span></td>
            <td><span class="badge ${r.pagamento_status}">${r.pagamento_status}</span></td>
            <td>${window.AppUtils.formatMoney(r.valor)}</td>
            <td>${actionsForRow(r)}</td>
          </tr>
        `).join('');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  }

  async function updateStatus(id, nextStatus) {
    const { data, error } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('agendamentos')
        .select('status')
        .eq('id', id)
    ).maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Agendamento nao encontrado.');
    if (data.status === 'concluido') throw new Error('Nao e permitido alterar agendamento concluido.');

    const finais = ['cancelado', 'desistencia_cliente'];
    if (finais.includes(data.status) && data.status !== nextStatus) {
      throw new Error('Agendamento finalizado nao pode ser alterado.');
    }

    await window.Api.updateAgendamento(id, { status: nextStatus });
  }

  periodoSelect.addEventListener('change', () => {
    showDateFilters();
    syncQuickPeriodButtons();
  });
  aplicarFiltroBtn.addEventListener('click', loadAgendamentos);
  toggleFiltroBtn.addEventListener('click', () => {
    setFilterPanelState(!filtrosPanel.classList.contains('is-open'));
  });
  quickPeriodButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      periodoSelect.value = btn.dataset.quickPeriod;
      showDateFilters();
      syncQuickPeriodButtons();
      loadAgendamentos().catch((err) => window.AppUtils.notify(info, err.message, true));
    });
  });

  tbody.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    try {
      if (action === 'cancelar') {
        const ok = window.confirm('Confirma o cancelamento deste agendamento?');
        if (!ok) return;
        await updateStatus(id, 'cancelado');
      }
      if (action === 'desistencia') {
        const ok = window.confirm('Confirma marcar como desistencia do cliente?');
        if (!ok) return;
        await updateStatus(id, 'desistencia_cliente');
      }

      await loadAgendamentos();
      window.AppUtils.notify(info, 'Agendamento atualizado.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  try {
    setFilterPanelState(false);
    showDateFilters();
    syncQuickPeriodButtons();
    await loadBarbeirosFilter();
    await loadAgendamentos();
  } catch (err) {
    window.AppUtils.notify(info, err.message, true);
  }
});
