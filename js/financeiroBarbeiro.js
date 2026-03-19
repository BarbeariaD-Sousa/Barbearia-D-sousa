document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.Auth.requireAuth(['barbeiro']);
  if (!user) return;

  await window.CommonUI.setupLayout(user);
  await window.Api.runAutoCompletion();

  const info = document.getElementById('barbeiro-fin-info');
  const bfReceitaPaga = document.getElementById('bf-receita-paga');
  const bfContasReceber = document.getElementById('bf-contas-receber');
  const bfComissaoPaga = document.getElementById('bf-comissao-paga');
  const bfQtdPagos = document.getElementById('bf-qtd-pagos');
  const bfDataInicio = document.getElementById('bf-data-inicio');
  const bfDataFim = document.getElementById('bf-data-fim');
  const bfToggleFiltro = document.getElementById('btn-toggle-finbar-resumo-filtro');
  const bfFiltrosPanel = document.getElementById('finbar-resumo-filtros-panel');
  const bfQuickButtons = document.querySelectorAll('[data-finbar-resumo-quick-period]');
  const bfServicosPagos = document.getElementById('bf-servicos-pagos');
  const bfContasReceberBody = document.getElementById('bf-contas-receber-body');
  const ganhosPeriodo = document.getElementById('ganhos-periodo');
  const ganhosToggleFiltro = document.getElementById('btn-toggle-finbar-ganhos-filtro');
  const ganhosFiltrosPanel = document.getElementById('finbar-ganhos-filtros-panel');
  const ganhosQuickButtons = document.querySelectorAll('[data-finbar-ganhos-quick-period]');
  const ganhosExtratoBody = document.getElementById('ganhos-extrato-body');
  const tabButtons = document.querySelectorAll('[data-finbar-tab]');
  const panelResumo = document.getElementById('finbar-panel-resumo');
  const panelGanhos = document.getElementById('finbar-panel-ganhos');
  const panelContas = document.getElementById('finbar-panel-contas');
  const loadedTabs = new Set();

  function setTab(tab) {
    tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.finbarTab === tab));
    panelResumo.classList.toggle('active', tab === 'resumo');
    panelGanhos.classList.toggle('active', tab === 'ganhos');
    panelContas.classList.toggle('active', tab === 'contas');
  }

  function currentHashTab() {
    const tab = window.location.hash.replace('#', '').trim();
    return ['resumo', 'ganhos', 'contas'].includes(tab) ? tab : 'resumo';
  }

  async function applyHashTab(force = false) {
    const tab = currentHashTab();
    setTab(tab);
    await ensureTabLoaded(tab, barbeiroId, force);
  }

  async function ensureTabLoaded(tab, currentBarbeiroId, force = false) {
    if (!currentBarbeiroId) return;
    if (!force && loadedTabs.has(tab)) return;

    if (tab === 'ganhos') {
      await loadGanhos(currentBarbeiroId);
    } else {
      await loadFinanceiroBarbeiro(currentBarbeiroId);
    }

    loadedTabs.add(tab);
  }

  tabButtons.forEach((btn) => btn.addEventListener('click', async () => {
    window.location.hash = btn.dataset.finbarTab;
    try {
      await applyHashTab();
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  }));

  async function getMeuBarbeiroId() {
    const { data, error } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('barbeiros')
        .select('id')
        .eq('usuario_id', user.id)
    ).maybeSingle();

    if (error) throw error;
    return data?.id || null;
  }

  async function syncServicoPagamento(financeiroId, agendamentoId, statusPagamento) {
    const { error } = await window.Api.rpcWithFrontBarbearia('atualizar_status_pagamento_financeiro', {
      p_financeiro_id: financeiroId,
      p_agendamento_id: agendamentoId || null,
      p_status_pagamento: statusPagamento
    });
    if (error) throw error;
  }

  async function loadFinanceiroBarbeiro(barbeiroId) {
    if (!barbeiroId) {
      bfReceitaPaga.textContent = window.AppUtils.formatMoney(0);
      bfContasReceber.textContent = window.AppUtils.formatMoney(0);
      bfComissaoPaga.textContent = window.AppUtils.formatMoney(0);
      bfQtdPagos.textContent = '0';
      bfServicosPagos.innerHTML = '<tr><td colspan="5">Sem servicos.</td></tr>';
      bfContasReceberBody.innerHTML = '<tr><td colspan="6">Sem contas a receber.</td></tr>';
      return;
    }

    let query = window.Api.scopeToFrontBarbearia(
      window.sb
        .from('financeiro')
        .select('id, agendamento_id, data, valor_servico, comissao_barbeiro, status_pagamento, agendamentos(clientes(nome), servicos(nome))')
        .eq('barbeiro_id', barbeiroId)
        .order('data', { ascending: false })
    );
    if (bfDataInicio.value) query = query.gte('data', bfDataInicio.value);
    if (bfDataFim.value) query = query.lte('data', bfDataFim.value);

    const { data: rows, error } = await query;
    if (error) throw error;

    const allRows = rows || [];
    const pagos = allRows.filter((r) => r.status_pagamento === 'pago');
    const pendentes = allRows.filter((r) => r.status_pagamento === 'pendente');

    bfReceitaPaga.textContent = window.AppUtils.formatMoney(
      pagos.reduce((acc, r) => acc + Number(r.valor_servico || 0), 0)
    );
    bfContasReceber.textContent = window.AppUtils.formatMoney(
      pendentes.reduce((acc, r) => acc + Number(r.valor_servico || 0), 0)
    );
    bfComissaoPaga.textContent = window.AppUtils.formatMoney(
      pagos.reduce((acc, r) => acc + Number(r.comissao_barbeiro || 0), 0)
    );
    bfQtdPagos.textContent = String(pagos.length);

    bfServicosPagos.innerHTML = pagos.length
      ? pagos.map((r) => `
          <tr>
            <td>${window.AppUtils.formatDate(r.data)}</td>
            <td>${r.agendamentos?.clientes?.nome || '-'}</td>
            <td>${r.agendamentos?.servicos?.nome || '-'}</td>
            <td>${window.AppUtils.formatMoney(r.valor_servico)}</td>
            <td><button class="btn-danger" data-action="lancar-receber" data-id="${r.id}" data-agendamento-id="${r.agendamento_id || ''}">Lancar a receber</button></td>
          </tr>
        `).join('')
      : '<tr><td colspan="5">Sem servicos pagos para lancar.</td></tr>';

    bfContasReceberBody.innerHTML = pendentes.length
      ? pendentes.map((r) => `
          <tr>
            <td>${window.AppUtils.formatDate(r.data)}</td>
            <td>${r.agendamentos?.clientes?.nome || '-'}</td>
            <td>${r.agendamentos?.servicos?.nome || '-'}</td>
            <td>${window.AppUtils.formatMoney(r.valor_servico)}</td>
            <td><span class="badge pendente">pendente</span></td>
            <td><button class="btn-secondary" data-action="marcar-recebido" data-id="${r.id}" data-agendamento-id="${r.agendamento_id || ''}">Marcar recebido</button></td>
          </tr>
        `).join('')
      : '<tr><td colspan="6">Sem contas a receber.</td></tr>';
  }

  function periodRange(tipo) {
    const hoje = new Date();
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
    let inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);

    if (tipo === 'semana') {
      const dow = inicio.getDay();
      inicio.setDate(inicio.getDate() - dow);
    } else if (tipo === 'mes') {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1, 0, 0, 0);
    }

    return {
      inicio: window.AppUtils.dateToISO(inicio),
      fim: window.AppUtils.dateToISO(fim)
    };
  }

  function setPanelState(panel, open) {
    if (!panel) return;
    panel.classList.toggle('is-open', open);
  }

  function syncResumoQuickButtons() {
    const today = window.AppUtils.todayISO();
    const monthStart = `${today.slice(0, 8)}01`;
    let selected = '';

    if (bfDataInicio.value === today && bfDataFim.value === today) {
      selected = 'dia';
    } else if (bfDataInicio.value === monthStart && bfDataFim.value === today) {
      selected = 'mes';
    } else {
      const weekRange = periodRange('semana');
      if (bfDataInicio.value === weekRange.inicio && bfDataFim.value === weekRange.fim) {
        selected = 'semana';
      }
    }

    bfQuickButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.finbarResumoQuickPeriod === selected);
    });
  }

  function syncGanhosQuickButtons() {
    const selected = ganhosPeriodo.value === 'hoje' ? 'dia' : ganhosPeriodo.value;
    ganhosQuickButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.finbarGanhosQuickPeriod === selected);
    });
  }

  async function loadGanhos(barbeiroId) {
    if (!barbeiroId) {
      document.getElementById('ganhos-faturado').textContent = window.AppUtils.formatMoney(0);
      document.getElementById('ganhos-comissao').textContent = window.AppUtils.formatMoney(0);
      document.getElementById('ganhos-atendimentos').textContent = '0';
      ganhosExtratoBody.innerHTML = '<tr><td colspan="7">Sem servicos no periodo.</td></tr>';
      return;
    }
    const range = periodRange(ganhosPeriodo.value);
    const [agRes, comRes, finRes] = await Promise.all([
      window.Api.scopeToFrontBarbearia(
        window.sb
          .from('agendamentos')
          .select('id, valor, status, data, hora_inicio, hora_fim, clientes!agendamentos_cliente_id_fkey(nome), servicos(nome)')
          .eq('barbeiro_id', barbeiroId)
          .gte('data', range.inicio)
          .lte('data', range.fim)
      ),
      window.Api.scopeToFrontBarbearia(
        window.sb
          .from('comissoes')
          .select('valor_comissao, data')
          .eq('barbeiro_id', barbeiroId)
          .gte('data', range.inicio)
          .lte('data', range.fim)
      ),
      window.Api.scopeToFrontBarbearia(
        window.sb
          .from('financeiro')
          .select('agendamento_id, comissao_barbeiro, status_pagamento')
          .eq('barbeiro_id', barbeiroId)
          .gte('data', range.inicio)
          .lte('data', range.fim)
      )
    ]);
    if (agRes.error) throw agRes.error;
    if (comRes.error) throw comRes.error;
    if (finRes.error) throw finRes.error;

    const atendimentos = (agRes.data || []).filter((a) => a.status === 'concluido');
    const totalFaturado = atendimentos.reduce((acc, a) => acc + Number(a.valor || 0), 0);
    const totalComissao = (comRes.data || []).reduce((acc, c) => acc + Number(c.valor_comissao || 0), 0);
    const financeiroByAgendamento = new Map((finRes.data || []).map((row) => [row.agendamento_id, row]));

    document.getElementById('ganhos-faturado').textContent = window.AppUtils.formatMoney(totalFaturado);
    document.getElementById('ganhos-comissao').textContent = window.AppUtils.formatMoney(totalComissao);
    document.getElementById('ganhos-atendimentos').textContent = String(atendimentos.length);
    ganhosExtratoBody.innerHTML = atendimentos.length === 0
      ? '<tr><td colspan="7">Sem servicos no periodo.</td></tr>'
      : atendimentos.map((row) => {
        const financeiro = financeiroByAgendamento.get(row.id);
        const comissao = Number(financeiro?.comissao_barbeiro || 0);
        const statusPagamento = financeiro?.status_pagamento || 'pago';
        return `
          <tr>
            <td>${window.AppUtils.formatDate(row.data)}</td>
            <td>${String(row.hora_inicio || '').slice(0, 5)} - ${String(row.hora_fim || '').slice(0, 5)}</td>
            <td>${row.clientes?.nome || '-'}</td>
            <td>${row.servicos?.nome || '-'}</td>
            <td>${window.AppUtils.formatMoney(row.valor)}</td>
            <td>${window.AppUtils.formatMoney(comissao)}</td>
            <td><span class="badge ${statusPagamento}">${statusPagamento}</span></td>
          </tr>
        `;
      }).join('');
  }

  let barbeiroId = null;

  ganhosPeriodo.addEventListener('change', async () => {
    try {
      syncGanhosQuickButtons();
      await ensureTabLoaded('ganhos', barbeiroId, true);
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  document.getElementById('bf-btn-filtrar').addEventListener('click', async () => {
    try {
      syncResumoQuickButtons();
      await ensureTabLoaded('resumo', barbeiroId, true);
      window.AppUtils.notify(info, 'Financeiro atualizado.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  if (bfToggleFiltro) {
    bfToggleFiltro.addEventListener('click', () => {
      setPanelState(bfFiltrosPanel, !bfFiltrosPanel?.classList.contains('is-open'));
    });
  }

  if (ganhosToggleFiltro) {
    ganhosToggleFiltro.addEventListener('click', () => {
      setPanelState(ganhosFiltrosPanel, !ganhosFiltrosPanel?.classList.contains('is-open'));
    });
  }

  bfQuickButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const range = periodRange(button.dataset.finbarResumoQuickPeriod);
      bfDataInicio.value = range.inicio;
      bfDataFim.value = range.fim;
      syncResumoQuickButtons();
      setPanelState(bfFiltrosPanel, false);

      try {
        await ensureTabLoaded('resumo', barbeiroId, true);
      } catch (err) {
        window.AppUtils.notify(info, err.message, true);
      }
    });
  });

  ganhosQuickButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      ganhosPeriodo.value = button.dataset.finbarGanhosQuickPeriod === 'dia'
        ? 'hoje'
        : button.dataset.finbarGanhosQuickPeriod;
      syncGanhosQuickButtons();
      setPanelState(ganhosFiltrosPanel, false);

      try {
        await ensureTabLoaded('ganhos', barbeiroId, true);
      } catch (err) {
        window.AppUtils.notify(info, err.message, true);
      }
    });
  });

  bfServicosPagos.addEventListener('click', async (ev) => {
    if (!barbeiroId) return;
    const btn = ev.target.closest('button[data-action="lancar-receber"]');
    if (!btn) return;
    const id = btn.dataset.id;
    const agendamentoId = btn.dataset.agendamentoId || null;

    try {
      await syncServicoPagamento(id, agendamentoId, 'pendente');

      loadedTabs.delete('resumo');
      loadedTabs.delete('contas');
      await ensureTabLoaded('resumo', barbeiroId, true);
      window.AppUtils.notify(info, 'Servico lancado em contas a receber.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  bfContasReceberBody.addEventListener('click', async (ev) => {
    if (!barbeiroId) return;
    const btn = ev.target.closest('button[data-action="marcar-recebido"]');
    if (!btn) return;
    const id = btn.dataset.id;
    const agendamentoId = btn.dataset.agendamentoId || null;

    try {
      await syncServicoPagamento(id, agendamentoId, 'pago');

      loadedTabs.delete('resumo');
      loadedTabs.delete('contas');
      await ensureTabLoaded('resumo', barbeiroId, true);
      window.AppUtils.notify(info, 'Conta marcada como recebida.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  window.addEventListener('hashchange', () => {
    applyHashTab().catch((err) => window.AppUtils.notify(info, err.message, true));
  });

  try {
    barbeiroId = await getMeuBarbeiroId();
    const hoje = window.AppUtils.todayISO();
    bfDataInicio.value = hoje;
    bfDataFim.value = hoje;
    syncResumoQuickButtons();
    syncGanhosQuickButtons();
    if (!window.location.hash) {
      window.location.hash = 'resumo';
    }
    await applyHashTab(true);
    if (!barbeiroId) {
      window.AppUtils.notify(info, 'Nao foi possivel localizar barbeiro para este usuario.', true);
    }
  } catch (err) {
    window.AppUtils.notify(info, err.message, true);
  }
});
