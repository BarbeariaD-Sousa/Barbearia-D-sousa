document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.Auth.requireAuth(['admin']);
  if (!user) return;

  await window.CommonUI.setupLayout(user);

  const info = document.getElementById('cadastro-info');
  const listUsuarios = document.getElementById('lista-usuarios');
  const usuarioSubtabButtons = document.querySelectorAll('[data-usuario-subtab]');
  const subtabInfo = document.getElementById('usuarios-subtab-info');
  const usuariosFiltroBusca = document.getElementById('usuarios-filtro-busca');
  const countClientes = document.getElementById('usuarios-count-clientes');
  const countBarbeiros = document.getElementById('usuarios-count-barbeiros');
  const countAdmin = document.getElementById('usuarios-count-admin');
  const listServicos = document.getElementById('lista-servicos');
  const formServico = document.getElementById('form-servico');
  const inputNome = document.getElementById('servico-nome');
  const inputPreco = document.getElementById('servico-preco');
  const inputDuracao = document.getElementById('servico-duracao');
  const formCategoriaDespesa = document.getElementById('form-categoria-despesa');
  const listCategoriasDespesa = document.getElementById('lista-categorias-despesa');
  const categoriaDespesaNome = document.getElementById('categoria-despesa-nome');
  const tabButtons = document.querySelectorAll('[data-cadastro-tab]');
  const panelUsuarios = document.getElementById('cadastro-panel-usuarios');
  const panelServicos = document.getElementById('cadastro-panel-servicos');
  const panelDespesas = document.getElementById('cadastro-panel-despesas');
  const modalRoot = document.getElementById('app-modal-root');
  const modalBackdrop = document.getElementById('app-modal-backdrop');
  const modalDialog = document.getElementById('app-modal-dialog');
  const modalCloseBtn = document.getElementById('app-modal-close');
  const modalTitle = document.getElementById('app-modal-title');
  const modalMessage = document.getElementById('app-modal-message');
  const modalForm = document.getElementById('app-modal-form');
  const modalFields = document.getElementById('app-modal-fields');
  const modalError = document.getElementById('app-modal-error');
  const modalCancelBtn = document.getElementById('app-modal-cancel');
  const modalConfirmBtn = document.getElementById('app-modal-confirm');
  let usuariosCache = [];
  let usuarioSubtabAtiva = 'usuarios';
  let activeModal = null;
  let lastFocusedElement = null;
  const loadedTabs = new Set();

  function setTab(tab) {
    tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.cadastroTab === tab));
    panelUsuarios.classList.toggle('active', tab === 'usuarios');
    panelServicos.classList.toggle('active', tab === 'servicos');
    panelDespesas.classList.toggle('active', tab === 'despesas');
  }

  function currentHashTab() {
    const tab = window.location.hash.replace('#', '').trim();
    return ['usuarios', 'servicos', 'despesas'].includes(tab) ? tab : 'usuarios';
  }

  async function applyHashTab(force = false) {
    const tab = currentHashTab();
    setTab(tab);
    await ensureTabLoaded(tab, force);
  }

  async function ensureTabLoaded(tab, force = false) {
    if (!force && loadedTabs.has(tab)) return;

    if (tab === 'usuarios') {
      await refreshUsuarios();
    } else if (tab === 'servicos') {
      await refreshServicos();
    } else if (tab === 'despesas') {
      await refreshCategoriasDespesa();
    }

    loadedTabs.add(tab);
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      window.location.hash = btn.dataset.cadastroTab;
      try {
        await applyHashTab();
      } catch (err) {
        await showFeedback(err.message, true);
      }
    });
  });

  function parsePreco(v) {
    return Number(String(v).replace(',', '.'));
  }

  function safeText(value, fallback = '-') {
    const text = String(value ?? '').trim();
    return window.AppUtils.escapeHtml(text || fallback);
  }

  function formatBirthDate(value) {
    const raw = String(value || '').trim();
    if (!raw) return '-';
    const onlyDate = raw.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(onlyDate)) {
      return window.AppUtils.formatDate(onlyDate);
    }
    return raw;
  }

  function normalizeDateInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
    return null;
  }

  function setInfoMessage(message, isError = false) {
    if (!info) return;
    info.className = isError ? 'error' : 'info';
    info.textContent = message;
  }

  function closeModal(result = null) {
    if (!activeModal) return;
    const resolver = activeModal.resolve;
    activeModal = null;
    modalRoot.hidden = true;
    modalRoot.setAttribute('aria-hidden', 'true');
    modalTitle.textContent = '';
    modalMessage.textContent = '';
    modalFields.innerHTML = '';
    modalError.hidden = true;
    modalError.textContent = '';
    modalConfirmBtn.textContent = 'Confirmar';
    modalCancelBtn.textContent = 'Cancelar';
    modalCancelBtn.hidden = false;
    modalForm.dataset.mode = '';
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
    resolver(result);
  }

  function openModal(config) {
    if (activeModal) {
      closeModal(null);
    }

    lastFocusedElement = document.activeElement;
    modalTitle.textContent = config.title || 'Aviso';
    modalMessage.textContent = config.message || '';
    modalFields.innerHTML = config.fieldsHtml || '';
    modalError.hidden = true;
    modalError.textContent = '';
    modalConfirmBtn.textContent = config.confirmText || 'Confirmar';
    modalCancelBtn.textContent = config.cancelText || 'Cancelar';
    modalCancelBtn.hidden = config.hideCancel === true;
    modalForm.dataset.mode = config.mode || 'alert';
    modalRoot.hidden = false;
    modalRoot.setAttribute('aria-hidden', 'false');

    return new Promise((resolve) => {
      activeModal = {
        ...config,
        resolve
      };

      const firstInput = modalFields.querySelector('input, select, textarea');
      if (firstInput) {
        firstInput.focus();
        if (typeof firstInput.select === 'function') firstInput.select();
      } else {
        modalConfirmBtn.focus();
      }
    });
  }

  async function openAlertModal({ title, message, isError = false, confirmText = 'Fechar' }) {
    const result = await openModal({
      mode: 'alert',
      title,
      message,
      confirmText,
      hideCancel: true,
      closeOnBackdrop: true,
      isError
    });
    return result;
  }

  async function openConfirmModal({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar' }) {
    const result = await openModal({
      mode: 'confirm',
      title,
      message,
      confirmText,
      cancelText,
      closeOnBackdrop: true
    });
    return result === 'confirm';
  }

  async function openFormModal({
    title,
    message,
    fields,
    confirmText = 'Salvar',
    cancelText = 'Cancelar',
    validate
  }) {
    const fieldsHtml = fields.map((field) => `
      <label>
        ${field.label}
        <input
          name="${field.name}"
          type="${field.type || 'text'}"
          value="${window.AppUtils.escapeAttr(field.value ?? '')}"
          ${field.min !== undefined ? `min="${field.min}"` : ''}
          ${field.max !== undefined ? `max="${field.max}"` : ''}
          ${field.step !== undefined ? `step="${field.step}"` : ''}
          ${field.placeholder ? `placeholder="${window.AppUtils.escapeAttr(field.placeholder)}"` : ''}
        />
      </label>
    `).join('');

    const result = await openModal({
      mode: 'form',
      title,
      message,
      fieldsHtml,
      confirmText,
      cancelText,
      closeOnBackdrop: true,
      validate
    });
    return result;
  }

  async function showFeedback(message, isError = false) {
    setInfoMessage(message, isError);
    await openAlertModal({
      title: isError ? 'Erro' : 'Sucesso',
      message,
      isError,
      confirmText: 'Ok'
    });
  }

  function setUsuarioSubtab(tab) {
    usuarioSubtabAtiva = tab;
    usuarioSubtabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.usuarioSubtab === tab));
    const textMap = {
      usuarios: 'Exibindo usuarios clientes para edicao e alteracao de perfil.',
      barbeiros: 'Exibindo barbeiros com acesso a agenda e configuracao de comissao.',
      admin: 'Exibindo administradores com acesso total ao sistema.'
    };
    if (subtabInfo) subtabInfo.textContent = textMap[tab] || '';
    renderUsuarios();
  }

  usuarioSubtabButtons.forEach((btn) => {
    btn.addEventListener('click', () => setUsuarioSubtab(btn.dataset.usuarioSubtab));
  });

  if (usuariosFiltroBusca) {
    usuariosFiltroBusca.addEventListener('input', () => renderUsuarios());
  }

  async function refreshCategoriasDespesa() {
    const { data, error } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('categorias_despesa')
        .select('id, nome')
        .order('nome', { ascending: true })
        .limit(150)
    );
    if (error) throw error;

    listCategoriasDespesa.innerHTML = (data || []).map((d) => `
      <tr>
        <td>${safeText(d.nome)}</td>
        <td>
          <button type="button" class="btn-secondary" data-action="editar-categoria-despesa" data-id="${window.AppUtils.escapeAttr(d.id)}" data-nome="${window.AppUtils.escapeAttr(d.nome || '')}">Editar</button>
          <button type="button" class="btn-danger" data-action="excluir-categoria-despesa" data-id="${window.AppUtils.escapeAttr(d.id)}">Excluir</button>
        </td>
      </tr>
    `).join('');
  }

  async function refreshServicos() {
    const { data, error } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('servicos')
        .select('id, nome, preco, duracao_minutos')
        .order('nome', { ascending: true })
    );

    if (error) throw error;

    listServicos.innerHTML = (data || []).map((s) => `
      <tr>
        <td>${safeText(s.nome)}</td>
        <td>${window.AppUtils.formatMoney(s.preco || 0)}</td>
        <td>${s.duracao_minutos || 0} min</td>
        <td>
          <button type="button" class="btn-secondary" data-action="editar-servico" data-id="${window.AppUtils.escapeAttr(s.id)}" data-nome="${window.AppUtils.escapeAttr(s.nome || '')}" data-preco="${window.AppUtils.escapeAttr(s.preco || 0)}" data-duracao="${window.AppUtils.escapeAttr(s.duracao_minutos || 0)}">Editar</button>
          <button type="button" class="btn-danger" data-action="excluir-servico" data-id="${window.AppUtils.escapeAttr(s.id)}">Excluir</button>
        </td>
      </tr>
    `).join('');
  }

  function renderUsuarios() {
    const totalClientes = usuariosCache.filter((u) => u.perfil === 'cliente').length;
    const totalBarbeiros = usuariosCache.filter((u) => u.perfil === 'barbeiro').length;
    const totalAdmin = usuariosCache.filter((u) => u.perfil === 'admin').length;

    if (countClientes) countClientes.textContent = String(totalClientes);
    if (countBarbeiros) countBarbeiros.textContent = String(totalBarbeiros);
    if (countAdmin) countAdmin.textContent = String(totalAdmin);

    let rows = usuariosCache;
    if (usuarioSubtabAtiva === 'usuarios') rows = usuariosCache.filter((u) => u.perfil === 'cliente');
    if (usuarioSubtabAtiva === 'barbeiros') rows = usuariosCache.filter((u) => u.perfil === 'barbeiro');
    if (usuarioSubtabAtiva === 'admin') rows = usuariosCache.filter((u) => u.perfil === 'admin');

    const termoBusca = String(usuariosFiltroBusca?.value || '').trim().toLowerCase();
    if (termoBusca) {
      rows = rows.filter((u) => {
        const nome = String(u.nome || '').toLowerCase();
        const email = String(u.email || '').toLowerCase();
        const telefone = String(u.telefone || '').toLowerCase();
        return nome.includes(termoBusca) || email.includes(termoBusca) || telefone.includes(termoBusca);
      });
    }

    listUsuarios.innerHTML = rows.map((u) => `
      <tr>
        <td>${safeText(u.nome)}</td>
        <td>${safeText(u.email)}</td>
        <td>${safeText(u.telefone)}</td>
        <td>${formatBirthDate(u.data_nascimento)}</td>
        <td>${safeText(u.perfil)}</td>
        <td>${u.perfil === 'barbeiro' ? `${Number(u.comissao_percentual || 0).toFixed(2)}%` : '-'}</td>
        <td>${u.ativo ? 'Sim' : 'Nao'}</td>
        <td>
          ${u.perfil === 'admin'
            ? `<div class="action-wrap">
                <button type="button" class="btn-secondary" data-action="editar-usuario" data-id="${window.AppUtils.escapeAttr(u.id)}">Editar dados</button>
                <span class="muted">Administrador</span>
              </div>`
            : u.perfil === 'barbeiro'
              ? `<div class="action-wrap">
                  <button type="button" class="btn-secondary" data-action="editar-usuario" data-id="${window.AppUtils.escapeAttr(u.id)}">Editar dados</button>
                  <button type="button" class="btn-secondary" data-action="editar-comissao" data-id="${window.AppUtils.escapeAttr(u.id)}" data-nome="${window.AppUtils.escapeAttr(u.nome || '')}" data-comissao="${window.AppUtils.escapeAttr(Number(u.comissao_percentual || 0))}">Editar comissao</button>
                  <button type="button" class="btn-danger" data-action="tornar-cliente" data-id="${window.AppUtils.escapeAttr(u.id)}" data-nome="${window.AppUtils.escapeAttr(u.nome || '')}">Tornar cliente</button>
                </div>`
              : `<div class="action-wrap">
                  <button type="button" class="btn-secondary" data-action="editar-usuario" data-id="${window.AppUtils.escapeAttr(u.id)}">Editar dados</button>
                  <button type="button" class="btn-secondary" data-action="tornar-barbeiro" data-id="${window.AppUtils.escapeAttr(u.id)}" data-nome="${window.AppUtils.escapeAttr(u.nome || '')}">Definir como barbeiro</button>
                </div>`}
        </td>
      </tr>
    `).join('');
  }

  async function refreshUsuarios() {
    const { data, error } = await window.sb.rpc('listar_usuarios_cadastro_admin');
    if (error) throw error;
    usuariosCache = data || [];
    renderUsuarios();
  }

  modalForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!activeModal) return;

    if (activeModal.mode === 'alert' || activeModal.mode === 'confirm') {
      closeModal('confirm');
      return;
    }

    const formData = new FormData(modalForm);
    const values = Object.fromEntries(formData.entries());
    const validationError = activeModal.validate ? activeModal.validate(values) : '';
    if (validationError) {
      modalError.hidden = false;
      modalError.textContent = validationError;
      return;
    }

    closeModal(values);
  });

  modalCancelBtn.addEventListener('click', () => closeModal(null));
  modalCloseBtn.addEventListener('click', () => closeModal(null));
  modalBackdrop.addEventListener('click', () => {
    if (activeModal?.closeOnBackdrop) closeModal(null);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && activeModal) {
      closeModal(null);
    }
  });

  listUsuarios.addEventListener('click', async (ev) => {
    const btnEditarUsuario = ev.target.closest('button[data-action="editar-usuario"]');
    if (btnEditarUsuario) {
      const usuario = usuariosCache.find((item) => String(item.id) === String(btnEditarUsuario.dataset.id));
      if (!usuario) {
        await showFeedback('Usuario nao encontrado.', true);
        return;
      }

      const formValues = await openFormModal({
        title: 'Editar usuario',
        message: 'Atualize nome, telefone, email e data de nascimento.',
        confirmText: 'Salvar',
        fields: [
          { name: 'nome', label: 'Nome', value: usuario.nome || '' },
          { name: 'email', label: 'Email', type: 'email', value: usuario.email || '' },
          { name: 'telefone', label: 'Telefone', value: usuario.telefone || '' },
          { name: 'dataNascimento', label: 'Data de nascimento', value: String(usuario.data_nascimento || '').slice(0, 10), placeholder: 'YYYY-MM-DD' }
        ],
        validate: (values) => {
          if (!String(values.nome || '').trim()) return 'Nome invalido.';
          if (!String(values.email || '').trim()) return 'Email invalido.';
          if (!String(values.telefone || '').trim()) return 'Telefone invalido.';
          if (String(values.dataNascimento || '').trim() && !normalizeDateInput(values.dataNascimento)) {
            return 'Data de nascimento invalida.';
          }
          return '';
        }
      });
      if (!formValues) return;

      const dataNascimento = String(formValues.dataNascimento || '').trim()
        ? normalizeDateInput(formValues.dataNascimento)
        : null;

      try {
        const { error } = await window.sb.rpc('admin_atualizar_usuario_cadastro', {
          p_usuario_id: usuario.id,
          p_nome: String(formValues.nome).trim(),
          p_email: String(formValues.email).trim(),
          p_telefone: String(formValues.telefone || '').trim(),
          p_data_nascimento: dataNascimento
        });
        if (error) throw error;
        await showFeedback('Usuario atualizado com sucesso.');
        loadedTabs.delete('usuarios');
        await ensureTabLoaded('usuarios', true);
      } catch (err) {
        await showFeedback(err.message, true);
      }
      return;
    }

    const btnCliente = ev.target.closest('button[data-action="tornar-cliente"]');
    if (btnCliente) {
      const ok = await openConfirmModal({
        title: 'Tornar cliente',
        message: `Deseja remover ${btnCliente.dataset.nome || 'este usuario'} da funcao de barbeiro e voltar para cliente?`,
        confirmText: 'Confirmar'
      });
      if (!ok) return;

      try {
        const { error } = await window.sb.rpc('definir_usuario_como_cliente', {
          p_usuario_id: btnCliente.dataset.id
        });
        if (error) throw error;
        await showFeedback('Usuario definido como cliente com sucesso.');
        loadedTabs.delete('usuarios');
        await ensureTabLoaded('usuarios', true);
      } catch (err) {
        await showFeedback(err.message, true);
      }
      return;
    }

    const btn = ev.target.closest('button[data-action="tornar-barbeiro"]');
    const btnEditComissao = ev.target.closest('button[data-action="editar-comissao"]');

    if (btnEditComissao) {
      const formValues = await openFormModal({
        title: 'Editar comissao',
        message: `Defina a comissao de ${btnEditComissao.dataset.nome || 'usuario'}.`,
        confirmText: 'Salvar',
        fields: [
          { name: 'comissao', label: 'Comissao percentual', type: 'number', value: String(btnEditComissao.dataset.comissao || '40'), min: 0, max: 100, step: '0.01' }
        ],
        validate: (values) => {
          const novoValor = Number(values.comissao);
          if (!Number.isFinite(novoValor) || novoValor < 0 || novoValor > 100) {
            return 'Comissao invalida. Informe um numero entre 0 e 100.';
          }
          return '';
        }
      });
      if (!formValues) return;
      const novoValor = Number(formValues.comissao);

      try {
        const { error } = await window.Api.scopeToFrontBarbearia(
          window.sb
            .from('barbeiros')
            .update({ comissao_percentual: novoValor })
            .eq('usuario_id', btnEditComissao.dataset.id)
        );
        if (error) throw error;
        await showFeedback('Comissao atualizada com sucesso.');
        loadedTabs.delete('usuarios');
        await ensureTabLoaded('usuarios', true);
      } catch (err) {
        await showFeedback(err.message, true);
      }
      return;
    }

    if (!btn) return;

    const nomePadrao = btn.dataset.nome || 'Barbeiro';
    const formValues = await openFormModal({
      title: 'Definir como barbeiro',
      message: `Informe a comissao percentual de ${nomePadrao}.`,
      confirmText: 'Salvar',
      fields: [
        { name: 'comissao', label: 'Comissao percentual', type: 'number', value: '40', min: 0, max: 100, step: '0.01' }
      ],
      validate: (values) => {
        const valor = Number(values.comissao);
        if (!Number.isFinite(valor) || valor < 0 || valor > 100) {
          return 'Comissao invalida. Informe um numero entre 0 e 100.';
        }
        return '';
      }
    });
    if (!formValues) return;
    const comissao = Number(formValues.comissao);

    try {
      const usuarioAtual = usuariosCache.find((u) => String(u.id) === String(btn.dataset.id));
      const { error } = await window.sb.rpc('definir_usuario_como_barbeiro', {
        p_usuario_id: btn.dataset.id,
        p_nome: nomePadrao,
        p_telefone: usuarioAtual?.telefone || null,
        p_comissao: comissao
      });
      if (error) throw error;

      await showFeedback('Usuario definido como barbeiro com sucesso.');
      loadedTabs.delete('usuarios');
      await ensureTabLoaded('usuarios', true);
    } catch (err) {
      await showFeedback(err.message, true);
    }
  });

  formServico.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const nome = String(inputNome.value || '').trim();
    const preco = parsePreco(inputPreco.value);
    const duracao = Number(inputDuracao.value);

    if (!nome) {
      await showFeedback('Informe o nome do servico.', true);
      return;
    }
    if (!Number.isFinite(preco) || preco < 0) {
      await showFeedback('Preco invalido.', true);
      return;
    }
    if (!Number.isFinite(duracao) || duracao <= 0) {
      await showFeedback('Duracao invalida.', true);
      return;
    }

    try {
      const { error } = await window.sb.from('servicos').insert(
        window.Api.withFrontBarbearia({
          nome,
          preco,
          duracao_minutos: Math.round(duracao)
        })
      );
      if (error) throw error;

      formServico.reset();
      await showFeedback('Servico cadastrado com sucesso.');
      await refreshServicos();
    } catch (err) {
      await showFeedback(err.message, true);
    }
  });

  listServicos.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;

    const servicoId = btn.dataset.id;
    const action = btn.dataset.action;

    try {
      if (action === 'excluir-servico') {
        const ok = await openConfirmModal({
          title: 'Excluir servico',
          message: 'Deseja excluir este servico?',
          confirmText: 'Excluir'
        });
        if (!ok) return;
        const { error } = await window.Api.scopeToFrontBarbearia(
          window.sb.from('servicos').delete().eq('id', servicoId)
        );
        if (error) throw error;
        await showFeedback('Servico excluido com sucesso.');
        await refreshServicos();
        return;
      }

      if (action === 'editar-servico') {
        const formValues = await openFormModal({
          title: 'Editar servico',
          message: 'Atualize os dados do servico.',
          confirmText: 'Salvar',
          fields: [
            { name: 'nome', label: 'Nome do servico', value: btn.dataset.nome || '' },
            { name: 'preco', label: 'Preco (R$)', type: 'number', value: String(btn.dataset.preco || '0'), min: 0, step: '0.01' },
            { name: 'duracao', label: 'Duracao (minutos)', type: 'number', value: String(btn.dataset.duracao || '30'), min: 1, step: '1' }
          ],
          validate: (values) => {
            const preco = parsePreco(values.preco);
            const duracao = Number(values.duracao);
            if (!String(values.nome || '').trim()) return 'Nome invalido.';
            if (!Number.isFinite(preco) || preco < 0) return 'Preco invalido.';
            if (!Number.isFinite(duracao) || duracao <= 0) return 'Duracao invalida.';
            return '';
          }
        });
        if (!formValues) return;

        const preco = parsePreco(formValues.preco);
        const duracao = Number(formValues.duracao);

        const { error } = await window.Api.scopeToFrontBarbearia(
          window.sb
            .from('servicos')
            .update({
              nome: String(formValues.nome).trim(),
              preco,
              duracao_minutos: Math.round(duracao)
            })
            .eq('id', servicoId)
        );
        if (error) throw error;
        await showFeedback('Servico atualizado com sucesso.');
        await refreshServicos();
      }
    } catch (err) {
      await showFeedback(err.message, true);
    }
  });

  formCategoriaDespesa.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    const nome = String(categoriaDespesaNome.value || '').trim();

    if (!nome) {
      await showFeedback('Informe o nome da categoria de despesa.', true);
      return;
    }

    try {
      const { error } = await window.sb.from('categorias_despesa').insert(
        window.Api.withFrontBarbearia({
          nome
        })
      );
      if (error) throw error;

      formCategoriaDespesa.reset();
      await showFeedback('Categoria de despesa cadastrada com sucesso.');
      await refreshCategoriasDespesa();
    } catch (err) {
      await showFeedback(err.message, true);
    }
  });

  listCategoriasDespesa.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    try {
      if (action === 'excluir-categoria-despesa') {
        const ok = await openConfirmModal({
          title: 'Excluir categoria',
          message: 'Deseja excluir esta categoria de despesa?',
          confirmText: 'Excluir'
        });
        if (!ok) return;
        const { error } = await window.Api.scopeToFrontBarbearia(
          window.sb.from('categorias_despesa').delete().eq('id', id)
        );
        if (error) throw error;
        await showFeedback('Categoria excluida com sucesso.');
        await refreshCategoriasDespesa();
        return;
      }

      if (action === 'editar-categoria-despesa') {
        const formValues = await openFormModal({
          title: 'Editar categoria',
          message: 'Atualize o nome da categoria.',
          confirmText: 'Salvar',
          fields: [
            { name: 'nome', label: 'Categoria', value: btn.dataset.nome || '' }
          ],
          validate: (values) => (!String(values.nome || '').trim() ? 'Categoria invalida.' : '')
        });
        if (!formValues) return;

        const { error } = await window.Api.scopeToFrontBarbearia(
          window.sb
            .from('categorias_despesa')
            .update({
              nome: String(formValues.nome).trim()
            })
            .eq('id', id)
        );
        if (error) throw error;
        await showFeedback('Categoria atualizada com sucesso.');
        await refreshCategoriasDespesa();
      }
    } catch (err) {
      await showFeedback(err.message, true);
    }
  });

  setUsuarioSubtab('usuarios');
  window.addEventListener('hashchange', () => {
    applyHashTab().catch((err) => showFeedback(err.message, true));
  });
  try {
    if (!window.location.hash) {
      window.location.hash = 'usuarios';
    }
    await applyHashTab(true);
  } catch (err) {
    await showFeedback(err.message, true);
  }
});
