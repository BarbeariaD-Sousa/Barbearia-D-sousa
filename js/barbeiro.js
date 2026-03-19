document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.Auth.requireAuth(['barbeiro']);
  if (!user) return;

  await window.CommonUI.setupLayout(user);
  await window.Api.runAutoCompletion();

  const info = document.getElementById('barbeiro-info');
  const agendaDataInicioInput = document.getElementById('agenda-data-inicio-barbeiro');
  const agendaDataFimInput = document.getElementById('agenda-data-fim-barbeiro');
  const periodoSelect = document.getElementById('barbeiro-periodo');
  const inicioWrap = document.getElementById('barbeiro-data-inicio-wrap');
  const fimWrap = document.getElementById('barbeiro-data-fim-wrap');
  const aplicarFiltroBtn = document.getElementById('btn-aplicar-filtro-barbeiro');
  const toggleFiltroBtn = document.getElementById('btn-toggle-filtro-barbeiro');
  const filtrosPanel = document.getElementById('barbeiro-filtros-panel');
  const quickPeriodButtons = document.querySelectorAll('[data-barbeiro-quick-period]');
  const agendaBody = document.getElementById('lista-agenda-barbeiro');
  const modalRoot = document.getElementById('barbeiro-modal-root');
  const modalBackdrop = document.getElementById('barbeiro-modal-backdrop');
  const modalClose = document.getElementById('barbeiro-modal-close');
  const modalForm = document.getElementById('barbeiro-modal-form');
  const modalTitle = document.getElementById('barbeiro-modal-title');
  const modalMessage = document.getElementById('barbeiro-modal-message');
  const modalMotivo = document.getElementById('barbeiro-modal-motivo');
  const modalError = document.getElementById('barbeiro-modal-error');
  const modalCancel = document.getElementById('barbeiro-modal-cancel');
  const modalConfirm = document.getElementById('barbeiro-modal-confirm');

  if (!periodoSelect || !agendaDataInicioInput || !agendaDataFimInput || !aplicarFiltroBtn || !agendaBody || !modalRoot || !modalBackdrop || !modalClose || !modalForm || !modalTitle || !modalMessage || !modalMotivo || !modalError || !modalCancel || !modalConfirm) {
    window.AppUtils.notify(info, 'Elementos obrigatorios do painel nao foram encontrados.', true);
    return;
  }

  const hojeISO = window.AppUtils.todayISO();
  agendaDataInicioInput.value = hojeISO;
  agendaDataFimInput.value = hojeISO;
  let activeModalResolver = null;
  let agendaRowsCache = [];

  function toDateOnly(value) {
    return new Date(`${value}T00:00:00`);
  }

  function toISO(date) {
    return window.AppUtils.dateToISO(date);
  }

  function showDateFilters() {
    const periodo = periodoSelect.value || 'hoje';
    const custom = periodo === 'personalizado';

    if (inicioWrap) inicioWrap.hidden = !custom;
    if (fimWrap) fimWrap.hidden = !custom;
  }

  function setFilterPanelState(open) {
    if (!filtrosPanel) return;
    filtrosPanel.classList.toggle('is-open', open);
  }

  function closeActionModal(result = null) {
    if (!activeModalResolver) return;
    const resolve = activeModalResolver;
    activeModalResolver = null;
    modalRoot.hidden = true;
    modalRoot.setAttribute('aria-hidden', 'true');
    modalMotivo.value = '';
    modalError.hidden = true;
    modalError.textContent = '';
    resolve(result);
  }

  function openReasonModal({ title, message, confirmText, placeholder }) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalConfirm.textContent = confirmText;
    modalMotivo.placeholder = placeholder || 'Descreva o motivo';
    modalMotivo.value = '';
    modalError.hidden = true;
    modalError.textContent = '';
    modalRoot.hidden = false;
    modalRoot.setAttribute('aria-hidden', 'false');

    return new Promise((resolve) => {
      activeModalResolver = resolve;
      setTimeout(() => modalMotivo.focus(), 0);
    });
  }

  function syncQuickPeriodButtons() {
    const selected = periodoSelect.value === 'hoje' ? 'dia' : periodoSelect.value;
    quickPeriodButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.barbeiroQuickPeriod === selected);
    });
  }

  function periodRange(periodo) {
    const hoje = toDateOnly(window.AppUtils.todayISO());
    const inicio = new Date(hoje);
    const fim = new Date(hoje);

    if (periodo === 'ontem') {
      inicio.setDate(inicio.getDate() - 1);
      fim.setDate(fim.getDate() - 1);
    } else if (periodo === 'semana') {
      inicio.setDate(inicio.getDate() - inicio.getDay());
      fim.setDate(inicio.getDate() + 6);
    } else if (periodo === 'mes') {
      inicio.setDate(1);
      fim.setMonth(inicio.getMonth() + 1);
      fim.setDate(0);
    } else if (periodo === 'personalizado') {
      const inicioCustom = agendaDataInicioInput.value;
      const fimCustom = agendaDataFimInput.value;

      if (!inicioCustom || !fimCustom) {
        throw new Error('Informe data inicial e data final para o periodo personalizado.');
      }

      const inicioDate = toDateOnly(inicioCustom);
      const fimDate = toDateOnly(fimCustom);
      if (inicioDate > fimDate) {
        throw new Error('A data inicial nao pode ser maior que a data final.');
      }

      return {
        inicioISO: toISO(inicioDate),
        fimISO: toISO(fimDate)
      };
    }

    return {
      inicioISO: toISO(inicio),
      fimISO: toISO(fim)
    };
  }

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

  async function loadAgendamentosPeriodo(barbeiroId) {
    if (!barbeiroId) return [];

    const periodo = periodoSelect.value || 'hoje';
    const { inicioISO, fimISO } = periodRange(periodo);

    const { data, error } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('agendamentos')
        .select(`
          id,
          data,
          hora_inicio,
          hora_fim,
          status,
          pagamento_pendente,
          cliente_id,
          clientes!agendamentos_cliente_id_fkey(nome, telefone),
          servicos(nome),
          valor,
          motivo_cancelamento,
          cancelado_em
        `)
        .eq('barbeiro_id', barbeiroId)
        .gte('data', inicioISO)
        .lte('data', fimISO)
        .order('data', { ascending: false })
        .order('hora_inicio', { ascending: false })
    );

    if (error) throw error;
    return data || [];
  }

  function buildStatusActions(row) {
    if (row.status === 'concluido' || row.status === 'cancelado' || row.status === 'desistencia_cliente') {
      return '-';
    }

    const buttons = [];
    buttons.push(`<button class="btn-danger" data-action="cancelar" data-id="${row.id}">Cancelar</button>`);
    buttons.push(`<button class="btn-warning" data-action="desistencia" data-id="${row.id}">Desistencia</button>`);

    return `<div class="action-wrap">${buttons.join('')}</div>`;
  }

  function formatMotivo(row) {
    if (row.status !== 'cancelado' && row.status !== 'desistencia_cliente') {
      return '-';
    }

    const motivo = String(row.motivo_cancelamento || '').trim();
    if (!motivo) return '-';

    return motivo;
  }

  async function loadComissoesPeriodo(barbeiroId) {
    if (!barbeiroId) return [];

    const { inicioISO, fimISO } = periodRange(periodoSelect.value || 'hoje');
    const { data, error } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('comissoes')
        .select('valor_comissao, data')
        .eq('barbeiro_id', barbeiroId)
        .gte('data', inicioISO)
        .lte('data', fimISO)
    );

    if (error) throw error;
    return data || [];
  }

  async function loadProximosClientes(barbeiroId) {
    if (!barbeiroId) return [];

    const agora = new Date();
    const hoje = window.AppUtils.todayISO();
    const horaAtual = `${window.AppUtils.pad2(agora.getHours())}:${window.AppUtils.pad2(agora.getMinutes())}:00`;

    const { data, error } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('agendamentos')
        .select(`
          data,
          hora_inicio,
          clientes!agendamentos_cliente_id_fkey(nome, telefone)
        `)
        .eq('barbeiro_id', barbeiroId)
        .in('status', ['agendado', 'em_atendimento'])
        .or(`data.gt.${hoje},and(data.eq.${hoje},hora_inicio.gte.${horaAtual})`)
        .order('data', { ascending: true })
        .order('hora_inicio', { ascending: true })
        .limit(3)
    );

    if (error) throw error;
    return data || [];
  }

  function normalizePhone(value) {
    return window.AppUtils.normalizePhone(value);
  }

  function whatsappLink(cliente) {
    const phone = normalizePhone(cliente?.clientes?.telefone);
    if (!phone) return '';
    const nome = String(cliente?.clientes?.nome || 'cliente').trim();
    const data = window.AppUtils.formatDate(cliente?.data);
    const hora = String(cliente?.hora_inicio || '').slice(0, 5);
    const mensagem = `Ola, ${nome}. Aqui e da Barberia D'sousa. Confirma seu atendimento em ${data} as ${hora}?`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;
  }

  function telefoneCell(row) {
    const telefone = String(row?.clientes?.telefone || '').trim();
    const link = whatsappLink(row);
    if (!telefone || !link) return '-';
    return `<a class="btn-whatsapp" href="${window.AppUtils.escapeAttr(link)}" target="_blank" rel="noopener noreferrer">${window.AppUtils.escapeHtml(telefone)}</a>`;
  }

  function renderResumoPeriodo(rows, comRows, proximosClientes) {
    if (!barbeiroId) {
      document.getElementById('card-agendamentos-hoje').textContent = '0';
      document.getElementById('card-atendimentos-hoje').textContent = '0';
      document.getElementById('card-cancelados-hoje').textContent = '0';
      document.getElementById('card-faturado-hoje').textContent = window.AppUtils.formatMoney(0);
      document.getElementById('card-comissao-hoje').textContent = window.AppUtils.formatMoney(0);
      document.getElementById('card-proximos-clientes').textContent = 'Sem proximos clientes.';
      return;
    }

    const agendamentosAtivos = rows.filter((r) => ['agendado', 'em_atendimento'].includes(r.status)).length;
    const atendimentos = rows.filter((r) => r.status === 'concluido').length;
    const cancelados = rows.filter((r) => ['cancelado', 'desistencia_cliente'].includes(r.status)).length;
    const faturado = rows
      .filter((r) => r.status === 'concluido')
      .reduce((acc, r) => acc + Number(r.valor || 0), 0);
    const comissao = (comRows || []).reduce((acc, r) => acc + Number(r.valor_comissao || 0), 0);

    document.getElementById('card-agendamentos-hoje').textContent = String(agendamentosAtivos);
    document.getElementById('card-atendimentos-hoje').textContent = String(atendimentos);
    document.getElementById('card-cancelados-hoje').textContent = String(cancelados);
    document.getElementById('card-faturado-hoje').textContent = window.AppUtils.formatMoney(faturado);
    document.getElementById('card-comissao-hoje').textContent = window.AppUtils.formatMoney(comissao);
    document.getElementById('card-proximos-clientes').innerHTML = !proximosClientes?.length
      ? 'Sem proximos clientes.'
      : proximosClientes.map((cliente) => `
        <div class="section-space-top">
          <strong>${window.AppUtils.formatDate(cliente.data)} ${String(cliente.hora_inicio).slice(0, 5)}</strong> - ${cliente.clientes?.nome || '-'}
          ${whatsappLink(cliente)
            ? `<div class="section-space-top"><a class="btn-whatsapp" href="${window.AppUtils.escapeAttr(whatsappLink(cliente))}" target="_blank" rel="noopener noreferrer">WhatsApp</a></div>`
            : ''}
        </div>
      `).join('');
  }

  function renderAgendaPeriodo(rows) {
    if (!barbeiroId) {
      agendaBody.innerHTML = '<tr><td colspan="8">Nenhum agendamento.</td></tr>';
      return;
    }

    agendaBody.innerHTML = rows.length === 0
      ? '<tr><td colspan="9">Sem agendamentos para o periodo selecionado.</td></tr>'
      : rows.map((r) => `
        <tr>
          <td>${window.AppUtils.formatDate(r.data)}</td>
          <td>${String(r.hora_inicio).slice(0, 5)} - ${String(r.hora_fim).slice(0, 5)}</td>
          <td>${r.clientes?.nome || '-'}</td>
          <td>${telefoneCell(r)}</td>
          <td>${r.servicos?.nome || '-'}</td>
          <td><span class="badge ${r.status}">${r.status}</span></td>
          <td><span class="badge ${['cancelado', 'desistencia_cliente'].includes(r.status) ? 'cancelado' : (r.pagamento_pendente ? 'pendente' : 'pago')}">${['cancelado', 'desistencia_cliente'].includes(r.status) ? 'cancelado' : (r.pagamento_pendente ? 'pendente' : 'pago')}</span></td>
          <td>${formatMotivo(r)}</td>
          <td>${buildStatusActions(r)}</td>
        </tr>
      `).join('');
  }

  async function persistAgendamentoStatus(id, payload) {
    const { error } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('agendamentos')
        .update(payload)
        .eq('id', id)
    );

    if (!error) return;

    const message = String(error.message || '').toLowerCase();
    const hasCancelExtras = Object.prototype.hasOwnProperty.call(payload, 'motivo_cancelamento')
      || Object.prototype.hasOwnProperty.call(payload, 'cancelado_em')
      || Object.prototype.hasOwnProperty.call(payload, 'cancelado_por');

    if (hasCancelExtras && (message.includes('column') || message.includes('motivo_cancelamento') || message.includes('cancelado_'))) {
      const { error: fallbackError } = await window.Api.scopeToFrontBarbearia(
        window.sb
          .from('agendamentos')
          .update({ status: payload.status })
          .eq('id', id)
      );

      if (fallbackError) throw fallbackError;
      return;
    }

    throw error;
  }

  async function updateStatusWithValidation(id, nextStatus, motivo = null) {
    const { data: current, error: currentError } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('agendamentos')
        .select('id, status')
        .eq('id', id)
    ).maybeSingle();

    if (currentError) throw currentError;
    if (!current) throw new Error('Agendamento nao encontrado.');
    if (current.status === 'concluido') throw new Error('Nao e permitido alterar agendamento concluido.');

    const finais = ['cancelado', 'desistencia_cliente'];
    if (finais.includes(current.status) && nextStatus !== current.status) {
      throw new Error('Agendamento ja finalizado e nao pode ser alterado.');
    }

    const payload = { status: nextStatus };

    if (nextStatus === 'cancelado' || nextStatus === 'desistencia_cliente') {
      payload.motivo_cancelamento = motivo;
      payload.cancelado_em = new Date().toISOString();
      payload.cancelado_por = user.id;
    }

    await persistAgendamentoStatus(id, payload);
  }

  async function refreshAll(barbeiroId) {
    const [rows, comRows, proximosClientes] = await Promise.all([
      loadAgendamentosPeriodo(barbeiroId),
      loadComissoesPeriodo(barbeiroId),
      loadProximosClientes(barbeiroId)
    ]);

    agendaRowsCache = rows;
    renderResumoPeriodo(rows, comRows, proximosClientes);
    renderAgendaPeriodo(rows);
  }

  let barbeiroId = null;

  async function applyFilters() {
    try {
      await refreshAll(barbeiroId);
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  }

  periodoSelect.addEventListener('change', () => {
    showDateFilters();
    syncQuickPeriodButtons();
    if (periodoSelect.value === 'personalizado') {
      setFilterPanelState(true);
    }
  });

  aplicarFiltroBtn.addEventListener('click', applyFilters);

  if (toggleFiltroBtn) {
    toggleFiltroBtn.addEventListener('click', () => {
      setFilterPanelState(!filtrosPanel?.classList.contains('is-open'));
    });
  }

  quickPeriodButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const nextPeriod = button.dataset.barbeiroQuickPeriod === 'dia'
        ? 'hoje'
        : button.dataset.barbeiroQuickPeriod;

      periodoSelect.value = nextPeriod;
      showDateFilters();
      syncQuickPeriodButtons();
      setFilterPanelState(false);
      await applyFilters();
    });
  });

  modalBackdrop.addEventListener('click', () => closeActionModal(null));
  modalClose.addEventListener('click', () => closeActionModal(null));
  modalCancel.addEventListener('click', () => closeActionModal(null));
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !modalRoot.hidden) {
      closeActionModal(null);
    }
  });

  modalForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const motivo = String(modalMotivo.value || '').trim();
    if (!motivo) {
      modalError.textContent = 'Informe o motivo para continuar.';
      modalError.hidden = false;
      modalMotivo.focus();
      return;
    }
    closeActionModal(motivo);
  });

  agendaBody.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-action][data-id]');
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    try {
      const row = agendaRowsCache.find((item) => String(item.id) === String(id));
      let nextStatus = null;
      let motivo = '';

      if (action === 'cancelar') {
        motivo = await openReasonModal({
          title: 'Cancelar atendimento',
          message: 'Informe o motivo do cancelamento deste atendimento.',
          confirmText: 'Cancelar atendimento',
          placeholder: 'Ex.: cliente pediu cancelamento, imprevisto no horario...'
        });
        if (motivo === null) return;

        nextStatus = 'cancelado';
        await updateStatusWithValidation(id, nextStatus, motivo);
      } else if (action === 'desistencia') {
        motivo = await openReasonModal({
          title: 'Registrar desistencia',
          message: 'Informe o motivo da desistencia do cliente.',
          confirmText: 'Registrar desistencia',
          placeholder: 'Ex.: cliente nao compareceu, desistiu em cima da hora...'
        });
        if (motivo === null) return;

        nextStatus = 'desistencia_cliente';
        await updateStatusWithValidation(id, nextStatus, motivo);
      }

      await refreshAll(barbeiroId);
      if (row && nextStatus) {
        window.AppUtils.notifyCancelamentoWhatsapp(info, {
          status: nextStatus,
          destinoNome: row.clientes?.nome,
          destinoTipo: 'cliente',
          destinoTelefone: row.clientes?.telefone,
          servicoNome: row.servicos?.nome,
          data: row.data,
          hora: row.hora_inicio,
          autorNome: user.nome || 'Barbeiro',
          autorTipo: 'barbeiro',
          motivo
        });
      } else {
        window.AppUtils.notify(info, 'Agendamento atualizado com sucesso.');
      }
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  try {
    showDateFilters();
    syncQuickPeriodButtons();
    barbeiroId = await getMeuBarbeiroId();
    await refreshAll(barbeiroId);
    if (!barbeiroId) {
      window.AppUtils.notify(info, 'Nao foi possivel localizar barbeiro para este usuario.', true);
    }
  } catch (err) {
    window.AppUtils.notify(info, err.message, true);
  }
});
