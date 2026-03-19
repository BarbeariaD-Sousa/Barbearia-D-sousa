document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.Auth.requireAuth(['admin']);
  if (!user) return;

  await window.CommonUI.setupLayout(user);

  const info = document.getElementById('config-info');
  const tabButtons = document.querySelectorAll('[data-config-tab]');
  const panelHorarios = document.getElementById('config-panel-horarios');
  const panelSenhas = document.getElementById('config-panel-senhas');

  const selectBarbeiro = document.getElementById('cfg-barbeiro');
  const semanaRefInput = document.getElementById('cfg-semana-ref');
  const horariosBody = document.getElementById('cfg-barbeiro-horarios-body');
  const btnSalvarBarbeiro = document.getElementById('btn-salvar-horarios-barbeiro');
  const whatsappInfo = document.getElementById('cfg-whatsapp-info');
  const whatsappObrigatorioInput = document.getElementById('cfg-whatsapp-obrigatorio');
  const whatsappObrigatorioLabel = document.getElementById('cfg-whatsapp-obrigatorio-label');
  const btnSalvarWhatsapp = document.getElementById('btn-salvar-config-whatsapp');

  const passwordInfo = document.getElementById('cfg-password-info');
  const userSearchInput = document.getElementById('cfg-user-search');
  const btnBuscarUsuario = document.getElementById('btn-buscar-usuario-senha');
  const userPreviewEl = document.getElementById('cfg-user-preview');
  const userList = document.getElementById('cfg-user-list');
  const selectedUserEl = document.getElementById('cfg-selected-user');
  const newPasswordInput = document.getElementById('cfg-new-password');
  const confirmPasswordInput = document.getElementById('cfg-confirm-password');
  const btnSalvarSenha = document.getElementById('btn-salvar-senha-usuario');
  const userSearchModalInput = document.getElementById('cfg-user-search-modal');
  const btnFiltrarUsuario = document.getElementById('btn-filtrar-usuario-senha');
  const userModalRoot = document.getElementById('cfg-user-modal-root');
  const userModalBackdrop = document.getElementById('cfg-user-modal-backdrop');
  const userModalClose = document.getElementById('cfg-user-modal-close');

  const diasSemana = [
    { id: 0, nome: 'Domingo' },
    { id: 1, nome: 'Segunda' },
    { id: 2, nome: 'Terca' },
    { id: 3, nome: 'Quarta' },
    { id: 4, nome: 'Quinta' },
    { id: 5, nome: 'Sexta' },
    { id: 6, nome: 'Sabado' }
  ];

  const defaults = {
    hora_abertura: '09:00',
    hora_fechamento: '19:00',
    intervalo_minutos: 30
  };

  let usuariosCache = [];
  let selectedUserId = null;
  let agendaConfigRow = null;

  function updateWhatsappToggleLabel() {
    if (!whatsappObrigatorioLabel || !whatsappObrigatorioInput) return;
    whatsappObrigatorioLabel.textContent = whatsappObrigatorioInput.checked ? 'Obrigatorio' : 'Opcional';
  }

  async function loadAgendaConfig() {
    const { data, error } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('configuracao_agenda')
        .select('id, barbearia_id, whatsapp_confirmacao_obrigatoria')
    ).maybeSingle();
    if (error) throw error;

    agendaConfigRow = data || null;
    whatsappObrigatorioInput.checked = data?.whatsapp_confirmacao_obrigatoria !== false;
    updateWhatsappToggleLabel();
  }

  async function saveWhatsappConfig() {
    try {
      btnSalvarWhatsapp.disabled = true;
      const payload = {
        whatsapp_confirmacao_obrigatoria: whatsappObrigatorioInput.checked
      };
      if (agendaConfigRow?.id) payload.id = agendaConfigRow.id;
      payload.barbearia_id = agendaConfigRow?.barbearia_id || window.Api.currentFrontBarbeariaId();

      const { error } = await window.sb
        .from('configuracao_agenda')
        .upsert(payload, { onConflict: 'barbearia_id' })
        .select('id, barbearia_id, whatsapp_confirmacao_obrigatoria')
        .single();
      if (error) throw error;

      await loadAgendaConfig();
      updateWhatsappToggleLabel();
      window.AppUtils.notify(whatsappInfo, 'Configuracao do WhatsApp salva com sucesso.');
    } catch (err) {
      window.AppUtils.notify(whatsappInfo, err.message, true);
    } finally {
      btnSalvarWhatsapp.disabled = false;
    }
  }

  function openUserModal() {
    userModalRoot.hidden = false;
    userModalRoot.setAttribute('aria-hidden', 'false');
    userSearchModalInput.value = userSearchInput.value;
    renderUsuariosSenha(userSearchModalInput.value);
    userSearchModalInput.focus();
  }

  function closeUserModal() {
    userModalRoot.hidden = true;
    userModalRoot.setAttribute('aria-hidden', 'true');
  }

  function setTab(tab) {
    tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.configTab === tab));
    panelHorarios.classList.toggle('active', tab === 'horarios');
    panelSenhas.classList.toggle('active', tab === 'senhas');
  }

  function currentHashTab() {
    const tab = window.location.hash.replace('#', '').trim();
    return ['horarios', 'senhas'].includes(tab) ? tab : 'horarios';
  }

  function applyHashTab() {
    setTab(currentHashTab());
  }

  function isoDate(date) {
    return window.AppUtils.dateToISO(date);
  }

  function parseIsoDate(value) {
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return new Date();
    return d;
  }

  function startOfWeekSunday(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - d.getDay());
    return d;
  }

  function weekDatesMap(refValue) {
    const ref = parseIsoDate(refValue || isoDate(new Date()));
    const start = startOfWeekSunday(ref);
    const map = new Map();
    diasSemana.forEach((dia) => {
      const current = new Date(start);
      current.setDate(start.getDate() + dia.id);
      map.set(dia.id, current);
    });
    return map;
  }

  function renderHorarioRows(horariosMap, datesMap) {
    horariosBody.innerHTML = diasSemana.map((d) => {
      const item = horariosMap.get(d.id) || {};
      const ativo = item.ativo ?? true;
      const inicio = String(item.hora_inicio || defaults.hora_abertura).slice(0, 5);
      const inicioIntervalo = String(item.hora_intervalo_inicio || '').slice(0, 5);
      const voltaIntervalo = String(item.hora_intervalo_fim || '').slice(0, 5);
      const fim = String(item.hora_fim || defaults.hora_fechamento).slice(0, 5);
      const intv = Number(item.intervalo_minutos || defaults.intervalo_minutos);
      const dateRef = datesMap.get(d.id);
      const dateText = dateRef ? window.AppUtils.formatDate(isoDate(dateRef)) : '-';

      return `
        <tr>
          <td>${d.nome}</td>
          <td>${dateText}</td>
          <td>
            <label class="status-switch">
              <input type="checkbox" data-dia="${d.id}" data-field="ativo" ${ativo ? 'checked' : ''} />
              <span class="status-switch-track">
                <span class="status-switch-thumb"></span>
              </span>
              <span class="status-switch-label">${ativo ? 'Ativo' : 'Pausado'}</span>
            </label>
          </td>
          <td><input type="time" data-dia="${d.id}" data-field="inicio" value="${inicio}" /></td>
          <td><input type="time" data-dia="${d.id}" data-field="inicio-intervalo" value="${inicioIntervalo}" /></td>
          <td><input type="time" data-dia="${d.id}" data-field="volta-intervalo" value="${voltaIntervalo}" /></td>
          <td><input type="time" data-dia="${d.id}" data-field="fim" value="${fim}" /></td>
          <td><input type="number" min="5" max="120" step="5" data-dia="${d.id}" data-field="intervalo" value="${intv}" /></td>
        </tr>
      `;
    }).join('');
  }

  async function loadBarbeiros() {
    const { data, error } = await window.Api.rpcWithFrontBarbearia('listar_barbeiros_publico');
    if (error) throw error;

    const rows = data || [];
    if (rows.length === 0) {
      selectBarbeiro.innerHTML = '<option value="">Sem barbeiros cadastrados</option>';
      return;
    }

    selectBarbeiro.innerHTML = rows.map((b) => (
      `<option value="${window.AppUtils.escapeAttr(b.id)}">${window.AppUtils.escapeHtml(b.nome)}</option>`
    )).join('');
  }

  async function loadHorariosBarbeiro() {
    const barbeiroId = selectBarbeiro.value;
    if (!barbeiroId) {
      horariosBody.innerHTML = '<tr><td colspan="8">Selecione um barbeiro.</td></tr>';
      return;
    }

    const { data, error } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('barbeiro_horarios')
        .select('dia_semana, ativo, hora_inicio, hora_intervalo_inicio, hora_intervalo_fim, hora_fim, intervalo_minutos')
        .eq('barbeiro_id', barbeiroId)
    );
    if (error) throw error;

    const map = new Map((data || []).map((h) => [Number(h.dia_semana), h]));
    renderHorarioRows(map, weekDatesMap(semanaRefInput.value));
  }

  function renderSelectedUser() {
    const usuario = usuariosCache.find((item) => String(item.id) === String(selectedUserId));
    if (!usuario) {
      selectedUserEl.textContent = 'Selecione um usuario para trocar a senha.';
      userPreviewEl.textContent = 'Nenhum usuario selecionado.';
      return;
    }

    const html = `
      <strong>${window.AppUtils.escapeHtml(usuario.nome || 'Usuario sem nome')}</strong><br />
      <span>${window.AppUtils.escapeHtml(usuario.email || 'Email nao informado')}</span><br />
      <small>${window.AppUtils.escapeHtml(usuario.perfil || 'sem perfil')} ${usuario.ativo ? '| ativo' : '| inativo'}</small>
    `;
    selectedUserEl.innerHTML = html;
    userPreviewEl.innerHTML = html;
  }

  function renderUsuariosSenha(searchValue = userSearchInput.value) {
    const termo = String(searchValue || '').trim().toLowerCase();
    const rows = usuariosCache.filter((usuario) => {
      if (!termo) return true;
      const nome = String(usuario.nome || '').toLowerCase();
      const email = String(usuario.email || '').toLowerCase();
      return nome.includes(termo) || email.includes(termo);
    });

    if (rows.length === 0) {
      userList.innerHTML = '<div class="password-empty-state">Nenhum usuario encontrado para a busca informada.</div>';
      return;
    }

    userList.innerHTML = rows.map((usuario) => `
      <button
        type="button"
        class="password-user-item ${String(usuario.id) === String(selectedUserId) ? 'active' : ''}"
        data-user-id="${window.AppUtils.escapeAttr(usuario.id)}"
      >
        <strong>${window.AppUtils.escapeHtml(usuario.nome || 'Usuario sem nome')}</strong>
        <span>${window.AppUtils.escapeHtml(usuario.email || 'Email nao informado')}</span>
        <small>${window.AppUtils.escapeHtml(usuario.perfil || 'sem perfil')} ${usuario.ativo ? '| ativo' : '| inativo'}</small>
      </button>
    `).join('');
  }

  async function loadUsuariosSenha() {
    const { data, error } = await window.sb.rpc('listar_usuarios_cadastro_admin');
    if (error) throw error;

    usuariosCache = data || [];
    if (!selectedUserId && usuariosCache[0]?.id) {
      selectedUserId = usuariosCache[0].id;
    } else if (selectedUserId && !usuariosCache.some((item) => String(item.id) === String(selectedUserId))) {
      selectedUserId = usuariosCache[0]?.id || null;
    }

    renderUsuariosSenha();
    renderSelectedUser();
  }

  function validatePasswordForm() {
    const senha = String(newPasswordInput.value || '');
    const confirmacao = String(confirmPasswordInput.value || '');

    if (!selectedUserId) {
      throw new Error('Selecione um usuario para trocar a senha.');
    }
    if (!senha || !confirmacao) {
      throw new Error('Preencha a nova senha e a confirmacao.');
    }
    if (senha.length < 6) {
      throw new Error('A senha deve ter no minimo 6 caracteres.');
    }
    if (senha !== confirmacao) {
      throw new Error('Senha e confirmacao precisam ser iguais.');
    }

    return senha;
  }

  async function savePassword() {
    try {
      const senha = validatePasswordForm();
      btnSalvarSenha.disabled = true;

      const { error } = await window.sb.rpc('admin_definir_senha_usuario', {
        p_usuario_id: selectedUserId,
        p_nova_senha: senha
      });
      if (error) throw error;

      newPasswordInput.value = '';
      confirmPasswordInput.value = '';
      window.AppUtils.notify(passwordInfo, 'Senha alterada com sucesso.');
    } catch (err) {
      window.AppUtils.notify(passwordInfo, err.message, true);
    } finally {
      btnSalvarSenha.disabled = false;
    }
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      window.location.hash = btn.dataset.configTab;
      applyHashTab();
    });
  });

  selectBarbeiro.addEventListener('change', () => {
    loadHorariosBarbeiro().catch((err) => window.AppUtils.notify(info, err.message, true));
  });

  semanaRefInput.addEventListener('change', () => {
    loadHorariosBarbeiro().catch((err) => window.AppUtils.notify(info, err.message, true));
  });

  horariosBody.addEventListener('change', (ev) => {
    const input = ev.target.closest('input[data-field="ativo"]');
    if (!input) return;
    const label = input.closest('.status-switch')?.querySelector('.status-switch-label');
    if (label) label.textContent = input.checked ? 'Ativo' : 'Pausado';
  });

  btnSalvarBarbeiro.addEventListener('click', async () => {
    const barbeiroId = selectBarbeiro.value;
    if (!barbeiroId) {
      window.AppUtils.notify(info, 'Selecione um barbeiro.', true);
      return;
    }

    try {
      const rows = diasSemana.map((d) => {
        const ativo = horariosBody.querySelector(`input[data-dia="${d.id}"][data-field="ativo"]`)?.checked ?? true;
        const inicio = horariosBody.querySelector(`input[data-dia="${d.id}"][data-field="inicio"]`)?.value || null;
        const inicioIntervalo = horariosBody.querySelector(`input[data-dia="${d.id}"][data-field="inicio-intervalo"]`)?.value || null;
        const voltaIntervalo = horariosBody.querySelector(`input[data-dia="${d.id}"][data-field="volta-intervalo"]`)?.value || null;
        const fim = horariosBody.querySelector(`input[data-dia="${d.id}"][data-field="fim"]`)?.value || null;
        const intv = Number(horariosBody.querySelector(`input[data-dia="${d.id}"][data-field="intervalo"]`)?.value || defaults.intervalo_minutos);

        if (!ativo) {
          return {
            barbeiro_id: barbeiroId,
            dia_semana: d.id,
            ativo: false,
            hora_inicio: null,
            hora_intervalo_inicio: null,
            hora_intervalo_fim: null,
            hora_fim: null,
            intervalo_minutos: intv
          };
        }

        if (!inicio || !fim) throw new Error(`Preencha inicio e fim para ${d.nome}.`);
        if (inicio >= fim) throw new Error(`Horario invalido em ${d.nome}: inicio deve ser menor que fim.`);
        if ((inicioIntervalo && !voltaIntervalo) || (!inicioIntervalo && voltaIntervalo)) {
          throw new Error(`Preencha inicio e volta do intervalo de ${d.nome}.`);
        }
        if (inicioIntervalo && voltaIntervalo && !(inicio < inicioIntervalo && inicioIntervalo < voltaIntervalo && voltaIntervalo < fim)) {
          throw new Error(`Intervalo de almoco invalido em ${d.nome}.`);
        }
        if (!Number.isFinite(intv) || intv < 5 || intv > 120) {
          throw new Error(`Intervalo invalido em ${d.nome}: use um valor entre 5 e 120 minutos.`);
        }

        return {
          barbeiro_id: barbeiroId,
          dia_semana: d.id,
          ativo: true,
          hora_inicio: inicio,
          hora_intervalo_inicio: inicioIntervalo,
          hora_intervalo_fim: voltaIntervalo,
          hora_fim: fim,
          intervalo_minutos: intv
        };
      });

      const scopedRows = rows.map((row) => window.Api.withFrontBarbearia(row));
      const { error } = await window.sb.from('barbeiro_horarios').upsert(scopedRows, { onConflict: 'barbeiro_id,dia_semana' });
      if (error) throw error;
      window.AppUtils.notify(info, 'Horarios do barbeiro salvos com sucesso.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  whatsappObrigatorioInput?.addEventListener('change', updateWhatsappToggleLabel);
  btnSalvarWhatsapp?.addEventListener('click', saveWhatsappConfig);

  userSearchInput.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      openUserModal();
    }
  });

  btnBuscarUsuario.addEventListener('click', openUserModal);
  btnFiltrarUsuario.addEventListener('click', () => {
    userSearchInput.value = userSearchModalInput.value;
    renderUsuariosSenha(userSearchModalInput.value);
  });

  userSearchModalInput.addEventListener('input', () => {
    renderUsuariosSenha(userSearchModalInput.value);
  });

  userList.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-user-id]');
    if (!btn) return;
    selectedUserId = btn.dataset.userId;
    userSearchInput.value = userSearchModalInput.value;
    renderUsuariosSenha();
    renderSelectedUser();
    passwordInfo.className = 'muted';
    passwordInfo.textContent = '';
    closeUserModal();
  });

  userModalBackdrop.addEventListener('click', closeUserModal);
  userModalClose.addEventListener('click', closeUserModal);
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !userModalRoot.hidden) {
      closeUserModal();
    }
  });

  document.querySelectorAll('[data-password-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.passwordToggle);
      if (!target) return;
      const showing = target.type === 'text';
      target.type = showing ? 'password' : 'text';
      btn.textContent = showing ? 'Mostrar' : 'Ocultar';
    });
  });

  btnSalvarSenha.addEventListener('click', savePassword);

  [newPasswordInput, confirmPasswordInput].forEach((input) => {
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        savePassword().catch(() => {});
      }
    });
  });

  window.addEventListener('hashchange', applyHashTab);

  try {
    if (!window.location.hash) {
      window.location.hash = 'horarios';
    }
    applyHashTab();
    semanaRefInput.value = isoDate(new Date());
    await loadAgendaConfig();
    await Promise.all([
      loadBarbeiros(),
      loadUsuariosSenha()
    ]);
    await loadHorariosBarbeiro();
  } catch (err) {
    window.AppUtils.notify(info, err.message, true);
  }
});
