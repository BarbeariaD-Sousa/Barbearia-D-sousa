document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.Auth.requireAuth(['admin']);
  if (!user) return;

  await window.CommonUI.setupLayout(user);
  await window.Api.runAutoCompletion();

  const info = document.getElementById('financeiro-info');
  const tabButtons = document.querySelectorAll('[data-financeiro-tab]');

  const panelByTab = {
    geral: document.getElementById('financeiro-panel-geral'),
    receitas: document.getElementById('financeiro-panel-receitas'),
    despesas: document.getElementById('financeiro-panel-despesas'),
    contas: document.getElementById('financeiro-panel-contas'),
    repasse: document.getElementById('financeiro-panel-repasse'),
    liquido: document.getElementById('financeiro-panel-liquido')
  };

  const listFinanceiro = document.getElementById('lista-financeiro');
  const listReceitasHistorico = document.getElementById('lista-receitas-historico');
  const listDespesas = document.getElementById('lista-despesas-financeiro');
  const listContasReceber = document.getElementById('lista-contas-receber');
  const listServicosParaReceber = document.getElementById('lista-servicos-para-receber');
  const listRepasseBarbeiros = document.getElementById('lista-repasse-barbeiros');
  const listLiquido = document.getElementById('lista-liquido');

  const totalDia = document.getElementById('fat-diario');
  const totalSemana = document.getElementById('fat-semanal');
  const totalMes = document.getElementById('fat-mensal');
  const totalComissoes = document.getElementById('total-comissoes');
  const totalContasReceber = document.getElementById('total-contas-receber');
  const lucroLiquidoAdmin = document.getElementById('lucro-liquido-admin');

  const rsTotal = document.getElementById('rs-total');
  const rsPago = document.getElementById('rs-pago');
  const rsQtd = document.getElementById('rs-qtd');
  const repasseTotal = document.getElementById('repasse-total');
  const repasseQtdBarbeiros = document.getElementById('repasse-qtd-barbeiros');
  const repasseQtdAtendimentos = document.getElementById('repasse-qtd-atendimentos');
  const liquidoReceita = document.getElementById('lq-receita');
  const liquidoDespesas = document.getElementById('lq-despesas');
  const liquidoComissoes = document.getElementById('lq-comissoes');
  const liquidoResultado = document.getElementById('lq-liquido');

  const despesasTotal = document.getElementById('despesas-total');
  const despesasHoje = document.getElementById('despesas-hoje');
  const despesasSemana = document.getElementById('despesas-semana');
  const despesasMes = document.getElementById('despesas-mes');

  const fInicio = document.getElementById('f-data-inicio');
  const fFim = document.getElementById('f-data-fim');
  const fBarbeiro = document.getElementById('f-barbeiro');
  const fServico = document.getElementById('f-servico');

  const rsInicio = document.getElementById('rs-data-inicio');
  const rsFim = document.getElementById('rs-data-fim');
  const rsBarbeiro = document.getElementById('rs-barbeiro');
  const rpInicio = document.getElementById('rp-data-inicio');
  const rpFim = document.getElementById('rp-data-fim');
  const rpBarbeiro = document.getElementById('rp-barbeiro');
  const lqInicio = document.getElementById('lq-data-inicio');
  const lqFim = document.getElementById('lq-data-fim');
  const lqBarbeiro = document.getElementById('lq-barbeiro');

  const dInicio = document.getElementById('d-data-inicio');
  const dFim = document.getElementById('d-data-fim');
  const dCategoria = document.getElementById('d-categoria');

  const formDespesaManual = document.getElementById('form-despesa-manual');
  const fdCategoria = document.getElementById('fd-categoria');
  const fdValor = document.getElementById('fd-valor');
  const fdData = document.getElementById('fd-data');
  const fdObservacao = document.getElementById('fd-observacao');

  const formContaReceberManual = document.getElementById('form-conta-receber-manual');
  const crDescricao = document.getElementById('cr-descricao');
  const crCategoria = document.getElementById('cr-categoria');
  const crValor = document.getElementById('cr-valor');
  const crData = document.getElementById('cr-data');
  const crObservacao = document.getElementById('cr-observacao');
  const loadedTabs = new Set();
  const quickFilterButtons = document.querySelectorAll('[data-financeiro-quick-target][data-financeiro-quick-period]');

  const filterSections = {
    geral: {
      panel: document.getElementById('financeiro-geral-filtros-panel'),
      toggle: document.getElementById('btn-toggle-filtro-financeiro-geral'),
      inicio: fInicio,
      fim: fFim,
      apply: document.getElementById('btn-filtrar-financeiro')
    },
    receitas: {
      panel: document.getElementById('financeiro-receitas-filtros-panel'),
      toggle: document.getElementById('btn-toggle-filtro-financeiro-receitas'),
      inicio: rsInicio,
      fim: rsFim,
      apply: document.getElementById('btn-filtrar-receitas-servicos')
    },
    despesas: {
      panel: document.getElementById('financeiro-despesas-filtros-panel'),
      toggle: document.getElementById('btn-toggle-filtro-financeiro-despesas'),
      inicio: dInicio,
      fim: dFim,
      apply: document.getElementById('btn-filtrar-despesas')
    },
    repasse: {
      panel: document.getElementById('financeiro-repasse-filtros-panel'),
      toggle: document.getElementById('btn-toggle-filtro-financeiro-repasse'),
      inicio: rpInicio,
      fim: rpFim,
      apply: document.getElementById('btn-filtrar-repasse')
    },
    liquido: {
      panel: document.getElementById('financeiro-liquido-filtros-panel'),
      toggle: document.getElementById('btn-toggle-filtro-financeiro-liquido'),
      inicio: lqInicio,
      fim: lqFim,
      apply: document.getElementById('btn-filtrar-liquido')
    }
  };

  function parseMoney(value) {
    return Number(String(value || '').replace(',', '.'));
  }

  function startOfWeek(dateObj) {
    const d = new Date(dateObj);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  function startOfMonth(dateObj) {
    return new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
  }

  function asDate(dateStr) {
    return new Date(`${dateStr}T00:00:00`);
  }

  function quickDateRange(periodo) {
    const hoje = asDate(window.AppUtils.todayISO());
    const inicio = new Date(hoje);
    const fim = new Date(hoje);

    if (periodo === 'semana') {
      inicio.setDate(inicio.getDate() - inicio.getDay());
      fim.setDate(inicio.getDate() + 6);
    } else if (periodo === 'mes') {
      inicio.setDate(1);
      fim.setMonth(inicio.getMonth() + 1);
      fim.setDate(0);
    }

    return {
      inicio: window.AppUtils.dateToISO(inicio),
      fim: window.AppUtils.dateToISO(fim)
    };
  }

  function setFilterPanelState(panel, open) {
    if (!panel) return;
    panel.classList.toggle('is-open', open);
  }

  function syncQuickButtons(tab) {
    const section = filterSections[tab];
    if (!section?.inicio || !section?.fim) return;

    const selected = ['dia', 'semana', 'mes'].find((periodo) => {
      const range = quickDateRange(periodo);
      return section.inicio.value === range.inicio && section.fim.value === range.fim;
    }) || '';

    quickFilterButtons.forEach((button) => {
      if (button.dataset.financeiroQuickTarget !== tab) return;
      button.classList.toggle('active', button.dataset.financeiroQuickPeriod === selected);
    });
  }

  function sumBy(rows, getValue) {
    return rows.reduce((acc, row) => acc + Number(getValue(row) || 0), 0);
  }

  async function syncServicoPagamento(financeiroId, agendamentoId, statusPagamento) {
    const isPendente = statusPagamento === 'pendente';

    if (agendamentoId) {
      const { data: agRows, error: agError } = await window.Api.scopeToFrontBarbearia(
        window.sb
          .from('agendamentos')
          .update({
            pagamento_status: statusPagamento,
            pagamento_pendente: isPendente
          })
          .eq('id', agendamentoId)
          .select('id')
          .limit(1)
      );

      if (agError) throw agError;
      if (!agRows?.length) throw new Error('Agendamento vinculado nao foi encontrado para atualizar o pagamento.');
    }

    const { data: finRows, error: finError } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('financeiro')
        .update({ status_pagamento: statusPagamento })
        .eq('id', financeiroId)
        .select('id, status_pagamento')
        .limit(1)
    );

    if (finError) throw finError;
    if (!finRows?.length) throw new Error('Lancamento financeiro nao foi encontrado.');
    if (finRows[0].status_pagamento !== statusPagamento) {
      throw new Error('Nao foi possivel confirmar a atualizacao do contas a receber.');
    }
  }

  function setTab(tab) {
    tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.financeiroTab === tab));
    Object.entries(panelByTab).forEach(([name, panel]) => {
      if (!panel) return;
      panel.classList.toggle('active', name === tab);
    });
  }

  function currentHashTab() {
    const tab = window.location.hash.replace('#', '').trim();
    return panelByTab[tab] ? tab : 'geral';
  }

  async function applyHashTab(force = false) {
    const tab = currentHashTab();
    setTab(tab);
    await ensureTabLoaded(tab, force);
  }

  async function ensureTabLoaded(tab, force = false) {
    if (!force && loadedTabs.has(tab)) return;

    if (tab === 'geral') {
      await loadGeral();
    } else if (tab === 'receitas') {
      await loadReceitasHistorico();
    } else if (tab === 'despesas') {
      await loadDespesas();
    } else if (tab === 'contas') {
      await Promise.all([loadContasReceber(), loadServicosParaReceber()]);
    } else if (tab === 'repasse') {
      await loadRepasseBarbeiros();
    } else if (tab === 'liquido') {
      await loadLiquidoEmpresa();
    }

    loadedTabs.add(tab);
  }

  async function loadBarbeiros() {
    const { data, error } = await window.Api.rpcWithFrontBarbearia('listar_barbeiros_publico');
    if (error) throw error;

    const options = '<option value="">Todos</option>' + (data || []).map((b) => `<option value="${b.id}">${b.nome}</option>`).join('');
    fBarbeiro.innerHTML = options;
    rsBarbeiro.innerHTML = options;
    rpBarbeiro.innerHTML = options;
    lqBarbeiro.innerHTML = options;
  }

  async function loadCategoriasDespesa() {
    const { data, error } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('categorias_despesa')
        .select('id, nome')
        .order('nome', { ascending: true })
    );

    if (error) throw error;

    const rows = data || [];
    dCategoria.innerHTML = '<option value="">Todas</option>' + rows.map((c) => `<option value="${c.nome}">${c.nome}</option>`).join('');
    fdCategoria.innerHTML = rows.length
      ? rows.map((c) => `<option value="${c.nome}">${c.nome}</option>`).join('')
      : '<option value="">Sem categorias cadastradas</option>';
  }

  async function fetchFinanceiroServicos(filters = {}) {
    let query = window.Api.scopeToFrontBarbearia(
      window.sb
        .from('financeiro')
        .select('id, agendamento_id, data, valor_servico, comissao_barbeiro, status_pagamento, forma_pagamento, barbeiro_id, barbeiros(nome), agendamentos(servicos(nome), clientes(nome))')
        .order('data', { ascending: false })
    );

    if (filters.dataInicio) query = query.gte('data', filters.dataInicio);
    if (filters.dataFim) query = query.lte('data', filters.dataFim);
    if (filters.barbeiroId) query = query.eq('barbeiro_id', filters.barbeiroId);

    const { data, error } = await query;
    if (error) throw error;

    const servicoFiltro = String(filters.servicoNome || '').trim().toLowerCase();
    if (!servicoFiltro) return data || [];

    return (data || []).filter((row) => String(row.agendamentos?.servicos?.nome || '').toLowerCase().includes(servicoFiltro));
  }

  async function fetchDespesas(filters = {}) {
    let query = window.Api.scopeToFrontBarbearia(
      window.sb
        .from('despesas')
        .select('id, data, descricao, categoria, valor, observacao')
        .order('data', { ascending: false })
    );

    if (filters.dataInicio) query = query.gte('data', filters.dataInicio);
    if (filters.dataFim) query = query.lte('data', filters.dataFim);

    const { data, error } = await query;
    if (error) throw error;

    const categoriaFiltro = String(filters.categoria || '').trim();
    if (!categoriaFiltro) return data || [];
    return (data || []).filter((row) => String(row.categoria || '') === categoriaFiltro);
  }

  function renderMovimentacoesGerais(servicosRows, despesasRows) {
    const receitas = servicosRows.map((row) => ({
      data: row.data,
      tipo: 'Entrada',
      origem: 'Servico',
      descricao: row.agendamentos?.servicos?.nome || '-',
      detalhe: `${row.agendamentos?.clientes?.nome || '-'} / ${row.barbeiros?.nome || '-'}`,
      valor: Number(row.valor_servico || 0),
      status: row.status_pagamento || 'pago'
    }));

    const despesas = despesasRows.map((row) => ({
      data: row.data,
      tipo: 'Saida',
      origem: 'Despesa',
      descricao: row.descricao || row.categoria || '-',
      detalhe: row.categoria || '-',
      valor: Number(row.valor || 0),
      status: 'lancado'
    }));

    const rows = [...receitas, ...despesas]
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));

    listFinanceiro.innerHTML = rows.length
      ? rows.map((row) => `
          <tr>
            <td>${window.AppUtils.formatDate(row.data)}</td>
            <td>${row.tipo}</td>
            <td>${row.origem}</td>
            <td>${row.descricao}</td>
            <td>${row.detalhe}</td>
            <td>${window.AppUtils.formatMoney(row.valor)}</td>
            <td><span class="badge ${row.status === 'lancado' ? 'agendado' : row.status}">${row.status}</span></td>
          </tr>
        `).join('')
      : '<tr><td colspan="7">Sem movimentacoes para os filtros informados.</td></tr>';
  }

  async function loadGeral() {
    const filters = {
      dataInicio: fInicio.value || null,
      dataFim: fFim.value || null,
      barbeiroId: fBarbeiro.value || null,
      servicoNome: fServico.value || null
    };

    const [servicosRows, despesasRows] = await Promise.all([
      fetchFinanceiroServicos(filters),
      fetchDespesas({ dataInicio: filters.dataInicio, dataFim: filters.dataFim })
    ]);

    const today = asDate(window.AppUtils.todayISO());
    const weekStart = startOfWeek(today);
    const monthStart = startOfMonth(today);
    const servicosPagos = servicosRows.filter((r) => r.status_pagamento === 'pago');

    const receitasDia = sumBy(servicosPagos.filter((r) => r.data === window.AppUtils.todayISO()), (r) => r.valor_servico);
    const receitasSemana = sumBy(servicosPagos.filter((r) => asDate(r.data) >= weekStart), (r) => r.valor_servico);
    const receitasMes = sumBy(servicosPagos.filter((r) => asDate(r.data) >= monthStart), (r) => r.valor_servico);

    const despesasDiaVal = sumBy(despesasRows.filter((r) => r.data === window.AppUtils.todayISO()), (r) => r.valor);
    const despesasSemanaVal = sumBy(despesasRows.filter((r) => asDate(r.data) >= weekStart), (r) => r.valor);
    const despesasMesVal = sumBy(despesasRows.filter((r) => asDate(r.data) >= monthStart), (r) => r.valor);

    totalDia.textContent = window.AppUtils.formatMoney(receitasDia - despesasDiaVal);
    totalSemana.textContent = window.AppUtils.formatMoney(receitasSemana - despesasSemanaVal);
    totalMes.textContent = window.AppUtils.formatMoney(receitasMes - despesasMesVal);
    totalComissoes.textContent = window.AppUtils.formatMoney(sumBy(servicosPagos, (r) => r.comissao_barbeiro));
    totalContasReceber.textContent = window.AppUtils.formatMoney(
      sumBy(servicosRows.filter((r) => r.status_pagamento === 'pendente'), (r) => r.valor_servico)
    );

    try {
      const { data: contasPendentes, error: contasErr } = await window.Api.scopeToFrontBarbearia(
        window.sb
          .from('contas_receber_manuais')
          .select('valor')
          .eq('status', 'pendente')
      );
      if (!contasErr) {
        const atual = sumBy(servicosRows.filter((r) => r.status_pagamento === 'pendente'), (r) => r.valor_servico);
        totalContasReceber.textContent = window.AppUtils.formatMoney(atual + sumBy(contasPendentes || [], (r) => r.valor));
      }
    } catch (_) {}

    const receitaTotalPagos = sumBy(servicosPagos, (r) => r.valor_servico);
    const despesaTotal = sumBy(despesasRows, (r) => r.valor);
    const comissaoTotal = sumBy(servicosPagos, (r) => r.comissao_barbeiro);
    lucroLiquidoAdmin.textContent = window.AppUtils.formatMoney(receitaTotalPagos - despesaTotal - comissaoTotal);

    renderMovimentacoesGerais(servicosRows, despesasRows);
  }

  async function loadReceitasHistorico() {
    const rows = await fetchFinanceiroServicos({
      dataInicio: rsInicio.value || null,
      dataFim: rsFim.value || null,
      barbeiroId: rsBarbeiro.value || null
    });

    rsTotal.textContent = window.AppUtils.formatMoney(sumBy(rows, (r) => r.valor_servico));
    rsPago.textContent = window.AppUtils.formatMoney(sumBy(rows.filter((r) => r.status_pagamento === 'pago'), (r) => r.valor_servico));
    rsQtd.textContent = String(rows.length);

    listReceitasHistorico.innerHTML = rows.length
      ? rows.map((row) => `
          <tr>
            <td>${window.AppUtils.formatDate(row.data)}</td>
            <td>${row.barbeiros?.nome || '-'}</td>
            <td>${row.agendamentos?.clientes?.nome || '-'}</td>
            <td>${row.agendamentos?.servicos?.nome || '-'}</td>
            <td>${window.AppUtils.formatMoney(row.valor_servico)}</td>
            <td><span class="badge ${row.status_pagamento || 'pendente'}">${row.status_pagamento || 'pendente'}</span></td>
            <td>${row.forma_pagamento || '-'}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="7">Sem receitas de servicos para os filtros informados.</td></tr>';
  }

  async function loadDespesas() {
    const rows = await fetchDespesas({
      dataInicio: dInicio.value || null,
      dataFim: dFim.value || null,
      categoria: dCategoria.value || null
    });

    const today = asDate(window.AppUtils.todayISO());
    const weekStart = startOfWeek(today);
    const monthStart = startOfMonth(today);

    despesasTotal.textContent = window.AppUtils.formatMoney(sumBy(rows, (r) => r.valor));
    despesasHoje.textContent = window.AppUtils.formatMoney(sumBy(rows.filter((r) => r.data === window.AppUtils.todayISO()), (r) => r.valor));
    despesasSemana.textContent = window.AppUtils.formatMoney(sumBy(rows.filter((r) => asDate(r.data) >= weekStart), (r) => r.valor));
    despesasMes.textContent = window.AppUtils.formatMoney(sumBy(rows.filter((r) => asDate(r.data) >= monthStart), (r) => r.valor));

    listDespesas.innerHTML = rows.length
      ? rows.map((row) => `
          <tr>
            <td>${window.AppUtils.formatDate(row.data)}</td>
            <td>${row.descricao || '-'}</td>
            <td>${row.categoria || '-'}</td>
            <td>${window.AppUtils.formatMoney(row.valor)}</td>
            <td>${row.observacao || '-'}</td>
            <td><button type="button" class="btn-danger" data-action="excluir-despesa" data-id="${row.id}">Excluir</button></td>
          </tr>
        `).join('')
      : '<tr><td colspan="6">Sem despesas para os filtros informados.</td></tr>';
  }

  async function loadContasReceber() {
    const [pendentesServicosRes, contasManuaisRes] = await Promise.all([
      window.Api.scopeToFrontBarbearia(
        window.sb
          .from('financeiro')
          .select('id, agendamento_id, data, valor_servico, status_pagamento, barbeiros(nome), agendamentos(clientes(nome), servicos(nome))')
          .eq('status_pagamento', 'pendente')
          .order('data', { ascending: false })
      ),
      window.Api.scopeToFrontBarbearia(
        window.sb
          .from('contas_receber_manuais')
          .select('id, data, descricao, categoria, valor, status, observacao')
          .order('data', { ascending: false })
      )
    ]);

    if (pendentesServicosRes.error) throw pendentesServicosRes.error;
    if (contasManuaisRes.error) throw contasManuaisRes.error;

    const servicos = (pendentesServicosRes.data || []).map((row) => ({
      id: row.id,
      agendamentoId: row.agendamento_id || '',
      tipo: 'servico',
      data: row.data,
      origem: 'Servico',
      clienteOuDescricao: row.agendamentos?.clientes?.nome || '-',
      barbeiroOuCategoria: row.barbeiros?.nome || '-',
      valor: Number(row.valor_servico || 0),
      status: row.status_pagamento || 'pendente'
    }));

    const manuais = (contasManuaisRes.data || []).map((row) => ({
      id: row.id,
      tipo: 'manual',
      data: row.data,
      origem: 'Manual',
      clienteOuDescricao: row.descricao || '-',
      barbeiroOuCategoria: row.categoria || '-',
      valor: Number(row.valor || 0),
      status: row.status || 'pendente'
    }));

    const rows = [...servicos, ...manuais]
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));

    listContasReceber.innerHTML = rows.length
      ? rows.map((row) => `
          <tr>
            <td>${window.AppUtils.formatDate(row.data)}</td>
            <td>${row.origem}</td>
            <td>${row.clienteOuDescricao}</td>
            <td>${row.barbeiroOuCategoria}</td>
            <td>${window.AppUtils.formatMoney(row.valor)}</td>
            <td><span class="badge ${row.status === 'recebido' ? 'concluido' : 'pendente'}">${row.status}</span></td>
            <td>
              ${row.status === 'pendente'
                ? `<button type="button" class="btn-secondary" data-action="receber-conta" data-tipo="${row.tipo}" data-id="${row.id}" data-agendamento-id="${window.AppUtils.escapeAttr(row.agendamentoId || '')}">Marcar recebido</button>`
                : '<span class="muted">Concluido</span>'}
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="7">Sem contas a receber.</td></tr>';
  }

  async function loadServicosParaReceber() {
    const { data, error } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('financeiro')
        .select('id, agendamento_id, data, valor_servico, status_pagamento, barbeiros(nome), agendamentos(clientes(nome), servicos(nome))')
        .eq('status_pagamento', 'pago')
        .order('data', { ascending: false })
        .limit(120)
    );

    if (error) throw error;

    const rows = data || [];
    listServicosParaReceber.innerHTML = rows.length
      ? rows.map((row) => `
          <tr>
            <td>${window.AppUtils.formatDate(row.data)}</td>
            <td>${row.agendamentos?.clientes?.nome || '-'}</td>
            <td>${row.barbeiros?.nome || '-'}</td>
            <td>${row.agendamentos?.servicos?.nome || '-'}</td>
            <td>${window.AppUtils.formatMoney(row.valor_servico)}</td>
            <td>
              <button type="button" class="btn-danger" data-action="lancar-servico-receber" data-id="${row.id}" data-agendamento-id="${row.agendamento_id || ''}">
                Lancar a receber
              </button>
            </td>
          </tr>
        `).join('')
      : '<tr><td colspan="6">Sem servicos pagos para lancar.</td></tr>';
  }

  async function loadRepasseBarbeiros() {
    let query = window.Api.scopeToFrontBarbearia(
      window.sb
        .from('financeiro')
        .select('id, data, barbeiro_id, valor_servico, comissao_barbeiro, status_pagamento, barbeiros(nome)')
        .eq('status_pagamento', 'pago')
        .order('data', { ascending: false })
    );

    if (rpInicio.value) query = query.gte('data', rpInicio.value);
    if (rpFim.value) query = query.lte('data', rpFim.value);
    if (rpBarbeiro.value) query = query.eq('barbeiro_id', rpBarbeiro.value);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data || [];
    const map = new Map();

    rows.forEach((row) => {
      const key = row.barbeiro_id || 'sem-barbeiro';
      if (!map.has(key)) {
        map.set(key, {
          barbeiro: row.barbeiros?.nome || 'Sem barbeiro',
          atendimentos: 0,
          faturamentoBase: 0,
          comissao: 0
        });
      }
      const agg = map.get(key);
      agg.atendimentos += 1;
      agg.faturamentoBase += Number(row.valor_servico || 0);
      agg.comissao += Number(row.comissao_barbeiro || 0);
    });

    const grouped = Array.from(map.values()).sort((a, b) => b.comissao - a.comissao);
    repasseTotal.textContent = window.AppUtils.formatMoney(sumBy(grouped, (r) => r.comissao));
    repasseQtdBarbeiros.textContent = String(grouped.length);
    repasseQtdAtendimentos.textContent = String(rows.length);

    listRepasseBarbeiros.innerHTML = grouped.length
      ? grouped.map((row) => `
          <tr>
            <td>${row.barbeiro}</td>
            <td>${row.atendimentos}</td>
            <td>${window.AppUtils.formatMoney(row.faturamentoBase)}</td>
            <td>${window.AppUtils.formatMoney(row.comissao)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="4">Sem valores de repasse para os filtros informados.</td></tr>';
  }

  async function loadLiquidoEmpresa() {
    const servicosRows = await fetchFinanceiroServicos({
      dataInicio: lqInicio.value || null,
      dataFim: lqFim.value || null,
      barbeiroId: lqBarbeiro.value || null
    });
    const despesasRows = await fetchDespesas({
      dataInicio: lqInicio.value || null,
      dataFim: lqFim.value || null
    });

    const servicosPagos = servicosRows.filter((r) => r.status_pagamento === 'pago');
    const totalReceita = sumBy(servicosPagos, (r) => r.valor_servico);
    const totalDespesas = sumBy(despesasRows, (r) => r.valor);
    const totalComissoesPagas = sumBy(servicosPagos, (r) => r.comissao_barbeiro);
    const totalLiquido = totalReceita - totalDespesas - totalComissoesPagas;

    liquidoReceita.textContent = window.AppUtils.formatMoney(totalReceita);
    liquidoDespesas.textContent = window.AppUtils.formatMoney(totalDespesas);
    liquidoComissoes.textContent = window.AppUtils.formatMoney(totalComissoesPagas);
    liquidoResultado.textContent = window.AppUtils.formatMoney(totalLiquido);

    const byDate = new Map();
    servicosPagos.forEach((row) => {
      const key = String(row.data || '');
      if (!byDate.has(key)) byDate.set(key, { data: key, receita: 0, despesas: 0, comissoes: 0 });
      const item = byDate.get(key);
      item.receita += Number(row.valor_servico || 0);
      item.comissoes += Number(row.comissao_barbeiro || 0);
    });
    despesasRows.forEach((row) => {
      const key = String(row.data || '');
      if (!byDate.has(key)) byDate.set(key, { data: key, receita: 0, despesas: 0, comissoes: 0 });
      const item = byDate.get(key);
      item.despesas += Number(row.valor || 0);
    });

    const rows = Array.from(byDate.values())
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));

    listLiquido.innerHTML = rows.length
      ? rows.map((row) => `
          <tr>
            <td>${window.AppUtils.formatDate(row.data)}</td>
            <td>${window.AppUtils.formatMoney(row.receita)}</td>
            <td>${window.AppUtils.formatMoney(row.despesas)}</td>
            <td>${window.AppUtils.formatMoney(row.comissoes)}</td>
            <td>${window.AppUtils.formatMoney(row.receita - row.despesas - row.comissoes)}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5">Sem dados para os filtros informados.</td></tr>';
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      window.location.hash = btn.dataset.financeiroTab;
      try {
        await applyHashTab();
      } catch (err) {
        window.AppUtils.notify(info, err.message, true);
      }
    });
  });

  Object.entries(filterSections).forEach(([tab, section]) => {
    if (section.toggle) {
      section.toggle.addEventListener('click', () => {
        setFilterPanelState(section.panel, !section.panel?.classList.contains('is-open'));
      });
    }

    if (section.inicio) {
      section.inicio.addEventListener('change', () => syncQuickButtons(tab));
    }

    if (section.fim) {
      section.fim.addEventListener('change', () => syncQuickButtons(tab));
    }
  });

  quickFilterButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const tab = button.dataset.financeiroQuickTarget;
      const periodo = button.dataset.financeiroQuickPeriod;
      const section = filterSections[tab];
      if (!section?.inicio || !section?.fim || !section.apply) return;

      const range = quickDateRange(periodo);
      section.inicio.value = range.inicio;
      section.fim.value = range.fim;
      syncQuickButtons(tab);
      setFilterPanelState(section.panel, false);

      try {
        await ensureTabLoaded(tab, true);
      } catch (err) {
        window.AppUtils.notify(info, err.message, true);
      }
    });
  });

  formDespesaManual.addEventListener('submit', async (event) => {
    event.preventDefault();

    const categoria = String(fdCategoria.value || '').trim();
    const valor = parseMoney(fdValor.value);
    const data = fdData.value;
    const observacao = String(fdObservacao.value || '').trim();

    if (!categoria || !data || !Number.isFinite(valor) || valor < 0) {
      window.AppUtils.notify(info, 'Preencha os dados obrigatorios da despesa.', true);
      return;
    }

    try {
      const { error } = await window.sb.from('despesas').insert(
        window.Api.withFrontBarbearia({
          descricao: categoria,
          categoria,
          valor,
          data,
          observacao: observacao || null
        })
      );

      if (error) throw error;

      formDespesaManual.reset();
      fdData.value = window.AppUtils.todayISO();

      loadedTabs.delete('despesas');
      loadedTabs.delete('geral');
      await Promise.all([ensureTabLoaded('despesas', true), ensureTabLoaded('geral', true)]);
      window.AppUtils.notify(info, 'Despesa cadastrada com sucesso.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  listDespesas.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action="excluir-despesa"]');
    if (!btn) return;

    const ok = window.confirm('Deseja excluir esta despesa?');
    if (!ok) return;

    try {
      const { error } = await window.Api.scopeToFrontBarbearia(
        window.sb
          .from('despesas')
          .delete()
          .eq('id', btn.dataset.id)
      );
      if (error) throw error;

      loadedTabs.delete('despesas');
      loadedTabs.delete('geral');
      loadedTabs.delete('liquido');
      await Promise.all([
        ensureTabLoaded('despesas', true),
        ensureTabLoaded('geral', true),
        ensureTabLoaded('liquido', true)
      ]);
      window.AppUtils.notify(info, 'Despesa excluida com sucesso.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  formContaReceberManual.addEventListener('submit', async (event) => {
    event.preventDefault();

    const descricao = String(crDescricao.value || '').trim();
    const categoria = String(crCategoria.value || '').trim();
    const valor = parseMoney(crValor.value);
    const data = crData.value;
    const observacao = String(crObservacao.value || '').trim();

    if (!descricao || !data || !Number.isFinite(valor) || valor < 0) {
      window.AppUtils.notify(info, 'Preencha os dados obrigatorios da conta a receber.', true);
      return;
    }

    try {
      const { error } = await window.sb.from('contas_receber_manuais').insert(
        window.Api.withFrontBarbearia({
          descricao,
          categoria: categoria || null,
          valor,
          data,
          status: 'pendente',
          observacao: observacao || null
        })
      );

      if (error) throw error;

      formContaReceberManual.reset();
      crData.value = window.AppUtils.todayISO();

      loadedTabs.delete('contas');
      await ensureTabLoaded('contas', true);
      window.AppUtils.notify(info, 'Conta a receber cadastrada com sucesso.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  listContasReceber.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action="receber-conta"]');
    if (!btn) return;

    const tipo = btn.dataset.tipo;
    const id = btn.dataset.id;
    const agendamentoId = btn.dataset.agendamentoId || null;

    try {
      if (tipo === 'servico') {
        await syncServicoPagamento(id, agendamentoId, 'pago');
      } else {
        const { error } = await window.Api.scopeToFrontBarbearia(
          window.sb
            .from('contas_receber_manuais')
            .update({ status: 'recebido', data_recebimento: window.AppUtils.todayISO() })
            .eq('id', id)
        );

        if (error) throw error;
      }

      loadedTabs.delete('contas');
      loadedTabs.delete('receitas');
      loadedTabs.delete('geral');
      loadedTabs.delete('repasse');
      loadedTabs.delete('liquido');
      await Promise.all([
        ensureTabLoaded('contas', true),
        ensureTabLoaded('receitas', true),
        ensureTabLoaded('geral', true),
        ensureTabLoaded('repasse', true),
        ensureTabLoaded('liquido', true)
      ]);
      window.AppUtils.notify(info, 'Conta atualizada com sucesso.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  listServicosParaReceber.addEventListener('click', async (event) => {
    const btn = event.target.closest('button[data-action="lancar-servico-receber"]');
    if (!btn) return;

    const financeiroId = btn.dataset.id;
    const agendamentoId = btn.dataset.agendamentoId || null;

    try {
      await syncServicoPagamento(financeiroId, agendamentoId, 'pendente');

      loadedTabs.delete('contas');
      loadedTabs.delete('receitas');
      loadedTabs.delete('geral');
      loadedTabs.delete('repasse');
      loadedTabs.delete('liquido');
      await Promise.all([
        ensureTabLoaded('contas', true),
        ensureTabLoaded('receitas', true),
        ensureTabLoaded('geral', true),
        ensureTabLoaded('repasse', true),
        ensureTabLoaded('liquido', true)
      ]);
      window.AppUtils.notify(info, 'Movimentacao criada em contas a receber.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  document.getElementById('btn-filtrar-financeiro').addEventListener('click', async () => {
    try {
      syncQuickButtons('geral');
      await ensureTabLoaded('geral', true);
      window.AppUtils.notify(info, 'Visao geral atualizada.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  document.getElementById('btn-filtrar-receitas-servicos').addEventListener('click', async () => {
    try {
      syncQuickButtons('receitas');
      await ensureTabLoaded('receitas', true);
      window.AppUtils.notify(info, 'Receitas atualizadas.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  document.getElementById('btn-filtrar-despesas').addEventListener('click', async () => {
    try {
      syncQuickButtons('despesas');
      await ensureTabLoaded('despesas', true);
      window.AppUtils.notify(info, 'Despesas atualizadas.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  document.getElementById('btn-filtrar-repasse').addEventListener('click', async () => {
    try {
      syncQuickButtons('repasse');
      await ensureTabLoaded('repasse', true);
      window.AppUtils.notify(info, 'Repasse atualizado.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  document.getElementById('btn-filtrar-liquido').addEventListener('click', async () => {
    try {
      syncQuickButtons('liquido');
      await ensureTabLoaded('liquido', true);
      window.AppUtils.notify(info, 'Liquido da empresa atualizado.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  window.addEventListener('hashchange', () => {
    applyHashTab().catch((err) => window.AppUtils.notify(info, err.message, true));
  });

  try {
    const today = window.AppUtils.todayISO();

    fdData.value = today;
    crData.value = today;
    fInicio.value = today;
    fFim.value = today;
    rsInicio.value = today;
    rsFim.value = today;
    dInicio.value = today;
    dFim.value = today;
    rpInicio.value = today;
    rpFim.value = today;
    lqInicio.value = today;
    lqFim.value = today;

    syncQuickButtons('geral');
    syncQuickButtons('receitas');
    syncQuickButtons('despesas');
    syncQuickButtons('repasse');
    syncQuickButtons('liquido');

    await Promise.all([
      loadBarbeiros(),
      loadCategoriasDespesa()
    ]);

    if (!window.location.hash) {
      window.location.hash = 'geral';
    }
    await applyHashTab(true);
  } catch (err) {
    window.AppUtils.notify(info, err.message, true);
  }
});
