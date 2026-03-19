document.addEventListener('DOMContentLoaded', async () => {
  const loginInfo = document.getElementById('login-info');
  const registerInfo = document.getElementById('register-info');
  const agendarInfo = document.getElementById('agendar-info');
  const today = window.AppUtils.todayISO();

  const tabButtons = document.querySelectorAll('.auth-tab-btn');
  const panelLogin = document.getElementById('panel-login');
  const panelRegistrar = document.getElementById('panel-registrar');
  const panelAgendar = document.getElementById('panel-agendar');

  const srBarbeiro = document.getElementById('sr-barbeiro');
  const srServico = document.getElementById('sr-servico');
  const srDataInput = document.getElementById('sr-data');
  const srHoraInput = document.getElementById('sr-hora');
  const srDataLabel = document.getElementById('sr-data-label');
  const srSlots = document.getElementById('sr-slots');
  const srHorarioSelecionado = document.getElementById('sr-horario-selecionado');
  const srCalTitle = document.getElementById('sr-cal-title');
  const srCalGrid = document.getElementById('sr-calendar-grid');

  let srSelectedDate = new Date();
  let srViewMonth = new Date(srSelectedDate.getFullYear(), srSelectedDate.getMonth(), 1);
  let quickSlotsRequestId = 0;
  let barbeirosCache = [];
  let agendaConfig = {
    whatsapp_confirmacao_obrigatoria: true
  };

  function isoDate(date) {
    return window.AppUtils.dateToISO(date);
  }

  function normalizeDate(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function formatMonth(date) {
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }

  function normalizePhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.startsWith('55')) return digits;
    return `55${digits}`;
  }

  function buildWhatsappLink(agendamento) {
    const barbeiro = barbeirosCache.find((item) => item.id === agendamento.barbeiroId);
    const phone = normalizePhone(barbeiro?.telefone);
    if (!phone || !agendamento.data || !agendamento.hora) return '';

    const barbeiroNome = String(barbeiro?.nome || 'barbeiro').trim();
    const servicoNome = String(agendamento.servicoNome || 'servico').trim();
    const mensagem = `Ola, ${barbeiroNome}. Acabei de agendar ${servicoNome} para o dia ${window.AppUtils.formatDate(agendamento.data)} as ${agendamento.hora}. Meu nome e ${agendamento.clienteNome}.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;
  }

  function showWhatsappCallout(agendamento) {
    const link = buildWhatsappLink(agendamento);
    const barbeiro = barbeirosCache.find((item) => item.id === agendamento.barbeiroId);
    const obrigatorio = agendaConfig.whatsapp_confirmacao_obrigatoria !== false;

    if (!link) {
      window.AppUtils.notify(agendarInfo, 'Agendamento criado, mas o barbeiro esta sem telefone para WhatsApp cadastrado.', true);
      return;
    }

    agendarInfo.className = 'muted auth-status';
    agendarInfo.textContent = '';

    window.AppUtils.notify(
      null,
      obrigatorio
        ? `Horario agendado com sucesso. E obrigatorio enviar a mensagem para ${barbeiro?.nome || 'o barbeiro'} no WhatsApp para confirmar o atendimento.`
        : `Horario agendado com sucesso. Se quiser, voce pode avisar ${barbeiro?.nome || 'o barbeiro'} no WhatsApp para agilizar a confirmacao do atendimento.`,
      false,
      {
        title: 'Horario agendado com sucesso',
        action: {
          label: obrigatorio ? 'Mensagem obrigatoria no WhatsApp' : 'Avisar no WhatsApp',
          href: link
        }
      }
    );
  }

  async function loadAgendaConfig() {
    const { data, error } = await window.sb.rpc('obter_configuracao_agenda_publica');
    if (error) throw error;

    agendaConfig = data?.[0] || {
      whatsapp_confirmacao_obrigatoria: true
    };
  }

  function renderAgendarCalendar() {
    srCalTitle.textContent = formatMonth(srViewMonth);
    srCalGrid.innerHTML = '';

    const firstDay = new Date(srViewMonth.getFullYear(), srViewMonth.getMonth(), 1);
    const lastDay = new Date(srViewMonth.getFullYear(), srViewMonth.getMonth() + 1, 0);
    const startWeekDay = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const todayOnly = normalizeDate(new Date());

    for (let i = 0; i < startWeekDay; i += 1) {
      srCalGrid.insertAdjacentHTML('beforeend', '<span class="calendar-day muted"> </span>');
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const current = new Date(srViewMonth.getFullYear(), srViewMonth.getMonth(), day);
      const disabled = normalizeDate(current) < todayOnly;
      const isSelected = isoDate(current) === srDataInput.value;
      srCalGrid.insertAdjacentHTML(
        'beforeend',
        `<button type="button" class="calendar-day-btn ${isSelected ? 'active' : ''}" data-date="${isoDate(current)}" ${disabled ? 'disabled' : ''}>${day}</button>`
      );
    }
  }

  async function loadQuickSlots() {
    const requestId = ++quickSlotsRequestId;
    srHoraInput.value = '';
    srHorarioSelecionado.textContent = 'Selecione um horario para confirmar.';

    const barbeiroId = srBarbeiro.value;
    const servicoId = srServico.value;
    const data = srDataInput.value;
    if (!barbeiroId || !servicoId || !data) {
      srSlots.innerHTML = '<p class="muted">Selecione servico, barbeiro e data para ver horarios.</p>';
      return;
    }

    try {
      const { data: slots, error } = await window.sb.rpc('horarios_disponiveis_cliente', {
        p_data: data,
        p_barbeiro_id: barbeiroId,
        p_servico_id: servicoId
      });
      if (error) throw error;
      if (requestId !== quickSlotsRequestId) return;

      const rows = slots || [];
      if (rows.length === 0) {
        srSlots.innerHTML = '<p class="muted">Nao ha horarios disponiveis para este dia.</p>';
        return;
      }

      srSlots.innerHTML = rows.map((slot) => {
        const value = String(slot.hora_inicio).slice(0, 5);
        const safeValue = window.AppUtils.escapeAttr(value);
        return `<button type="button" class="slot-btn" data-hora="${safeValue}">${window.AppUtils.escapeHtml(value)}</button>`;
      }).join('');
    } catch (err) {
      if (requestId !== quickSlotsRequestId) return;
      window.AppUtils.notify(agendarInfo, err.message, true);
    }
  }

  function setTab(tab) {
    tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.authTab === tab));
    panelLogin.classList.toggle('active', tab === 'login');
    panelRegistrar.classList.toggle('active', tab === 'registrar');
    panelAgendar.classList.toggle('active', tab === 'agendar');
  }

  tabButtons.forEach((btn) => btn.addEventListener('click', () => setTab(btn.dataset.authTab)));
  document.getElementById('sr-btn-cal-prev').addEventListener('click', () => {
    srViewMonth = new Date(srViewMonth.getFullYear(), srViewMonth.getMonth() - 1, 1);
    renderAgendarCalendar();
  });
  document.getElementById('sr-btn-cal-next').addEventListener('click', () => {
    srViewMonth = new Date(srViewMonth.getFullYear(), srViewMonth.getMonth() + 1, 1);
    renderAgendarCalendar();
  });
  srCalGrid.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('.calendar-day-btn[data-date]');
    if (!btn) return;
    srSelectedDate = new Date(`${btn.dataset.date}T00:00:00`);
    srDataInput.value = btn.dataset.date;
    srDataLabel.textContent = window.AppUtils.formatDate(srDataInput.value);
    renderAgendarCalendar();
    await loadQuickSlots();
  });
  srSlots.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.slot-btn[data-hora]');
    if (!btn) return;
    srSlots.querySelectorAll('.slot-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    srHoraInput.value = btn.dataset.hora;
    srHorarioSelecionado.textContent = `Horario selecionado: ${srHoraInput.value}`;
  });

  function renderOptions(selectEl, list, labelBuilder) {
    if (!list || list.length === 0) {
      selectEl.innerHTML = '<option value="">Sem opcoes disponiveis</option>';
      return;
    }
    selectEl.innerHTML = list.map((item) => (
      `<option value="${window.AppUtils.escapeAttr(item.id)}">${window.AppUtils.escapeHtml(labelBuilder(item))}</option>`
    )).join('');
  }

  async function loadAgendamentoOptions() {
    const [barbeirosRes, servicosRes] = await Promise.all([
      window.sb.rpc('listar_barbeiros_publico'),
      window.sb.rpc('listar_servicos_publico')
    ]);
    if (barbeirosRes.error) throw barbeirosRes.error;
    if (servicosRes.error) throw servicosRes.error;

    barbeirosCache = barbeirosRes.data || [];
    renderOptions(srBarbeiro, barbeirosCache, (b) => b.nome);
    renderOptions(srServico, servicosRes.data || [], (s) => `${s.nome} - ${window.AppUtils.formatMoney(s.preco)} (${s.duracao_minutos}m)`);
    await loadQuickSlots();
  }

  async function redirectByRole() {
    const userInfo = await window.Auth.getCurrentUserRole();

    if (userInfo?.perfil === 'admin') {
      window.location.href = window.Auth.paths().dashboard;
      return true;
    }
    if (userInfo?.perfil === 'barbeiro') {
      window.location.href = window.Auth.paths().barbeiro;
      return true;
    }

    const { data: clienteData, error: clienteError } = await window.sb.rpc('obter_cliente_auth');
    if (clienteError) throw clienteError;
    if (clienteData && clienteData.length > 0) {
      window.location.href = './pages/cliente.html';
      return true;
    }

    return false;
  }

  try {
    const session = await window.Auth.getSession();
    if (session) {
      const redirected = await redirectByRole();
      if (!redirected) {
        await window.Auth.logout();
      }
      return;
    }
  } catch (err) {
    console.error(err);
  }

  document.getElementById('form-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      await window.Auth.login(email, password);
      const redirected = await redirectByRole();
      if (!redirected) {
        await window.Auth.logout();
        throw new Error('Este usuario nao pertence a esta barbearia.');
      }
    } catch (err) {
      window.AppUtils.notify(loginInfo, err.message, true);
    }
  });

  document.getElementById('form-register').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nome = document.getElementById('reg-nome').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const telefone = document.getElementById('reg-telefone').value.trim();
    const nomePadrao = nome || email.split('@')[0] || 'Cliente';

    if (!nome) {
      window.AppUtils.notify(registerInfo, 'Informe seu nome para concluir o registro.', true);
      return;
    }
    if (!telefone) {
      window.AppUtils.notify(registerInfo, 'Informe seu telefone para concluir o registro.', true);
      return;
    }

    try {
      const { data: signUpData, error: signUpError } = await window.sb.auth.signUp({
        email,
        password,
        options: {
          data: {
            barbearia_id: window.Auth.currentBarbeariaId(),
            barbearia_slug: window.Auth.currentBarbeariaSlug(),
            telefone,
            nome: nomePadrao
          }
        }
      });
      if (signUpError) throw signUpError;

      if (signUpData?.session) {
        const { error: ensureError } = await window.sb.rpc('garantir_cliente_auth', {
          p_nome: nomePadrao,
          p_telefone: telefone,
          p_email: email
        });
        if (ensureError) throw ensureError;
        window.location.href = './pages/cliente.html';
        return;
      }

      window.AppUtils.notify(registerInfo, 'Registro realizado. Verifique seu email para confirmar a conta.');
    } catch (err) {
      window.AppUtils.notify(registerInfo, err.message, true);
    }
  });

  document.getElementById('form-agendar-rapido-login').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const nome = document.getElementById('sr-nome').value.trim();
    const telefone = document.getElementById('sr-telefone').value.trim();
    const barbeiroId = srBarbeiro.value;
    const servicoId = srServico.value;
    if (!nome) {
      window.AppUtils.notify(agendarInfo, 'Nome e obrigatorio para agendar sem cadastro.', true);
      return;
    }
    if (!telefone) {
      window.AppUtils.notify(agendarInfo, 'Telefone e obrigatorio para agendar sem cadastro.', true);
      return;
    }
    if (!barbeiroId || !servicoId) {
      window.AppUtils.notify(agendarInfo, 'Selecione barbeiro e servico antes de agendar.', true);
      return;
    }
    if (!srDataInput.value) {
      window.AppUtils.notify(agendarInfo, 'Selecione uma data no calendario.', true);
      return;
    }
    if (!srHoraInput.value) {
      window.AppUtils.notify(agendarInfo, 'Selecione um horario disponivel.', true);
      return;
    }

    try {
      const agendamentoCriado = {
        clienteNome: nome,
        barbeiroId,
        servicoNome: srServico.options[srServico.selectedIndex]?.textContent?.trim().split(' - ')[0] || 'servico',
        data: srDataInput.value,
        hora: srHoraInput.value
      };
      const { error } = await window.sb.rpc('criar_agendamento_publico', {
        p_cliente_id: null,
        p_nome: nome,
        p_telefone: telefone,
        p_barbeiro_id: barbeiroId,
        p_servico_id: servicoId,
        p_data: srDataInput.value,
        p_hora_inicio: srHoraInput.value,
        p_sem_cadastro: true
      });
      if (error) throw error;

      ev.target.reset();
      srSelectedDate = normalizeDate(new Date());
      srViewMonth = new Date(srSelectedDate.getFullYear(), srSelectedDate.getMonth(), 1);
      srDataInput.value = isoDate(srSelectedDate);
      srDataLabel.textContent = window.AppUtils.formatDate(srDataInput.value);
      srHoraInput.value = '';
      srHorarioSelecionado.textContent = 'Selecione um horario para confirmar.';
      renderAgendarCalendar();
      await loadQuickSlots();
      showWhatsappCallout(agendamentoCriado);
    } catch (err) {
      window.AppUtils.notify(agendarInfo, err.message, true);
    }
  });

  [srBarbeiro, srServico].forEach((el) => el.addEventListener('change', loadQuickSlots));

  try {
    srSelectedDate = normalizeDate(new Date());
    srDataInput.value = isoDate(srSelectedDate);
    srDataLabel.textContent = window.AppUtils.formatDate(srDataInput.value);
    renderAgendarCalendar();
    await loadAgendaConfig();
    await loadAgendamentoOptions();
  } catch (err) {
    window.AppUtils.notify(agendarInfo, err.message, true);
  }
});
