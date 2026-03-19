window.Api = {
  currentFrontBarbeariaId() {
    return Number(window.Auth?.currentBarbeariaId?.() || 0) || null;
  },

  scopeToFrontBarbearia(query) {
    const barbeariaId = this.currentFrontBarbeariaId();
    if (!barbeariaId) return query;
    return query.eq('barbearia_id', barbeariaId);
  },

  withFrontBarbearia(payload = {}) {
    const barbeariaId = this.currentFrontBarbeariaId();
    if (!barbeariaId) return { ...payload };
    return {
      ...payload,
      barbearia_id: barbeariaId
    };
  },

  withFrontBarbeariaRpc(payload = {}) {
    const barbeariaId = this.currentFrontBarbeariaId();
    if (!barbeariaId) return { ...payload };
    return {
      ...payload,
      p_barbearia_id: barbeariaId
    };
  },

  rpcWithFrontBarbearia(fnName, payload = {}) {
    return window.sb.rpc(fnName, this.withFrontBarbeariaRpc(payload));
  },

  async runAutoCompletion(force = false) {
    const cacheKey = 'domlucas:auto-completion:last-run';
    const now = Date.now();
    const lastRun = Number(window.sessionStorage.getItem(cacheKey) || 0);

    if (!force && lastRun && now - lastRun < 5 * 60 * 1000) {
      return;
    }

    const { error } = await window.sb.rpc('atualizar_agendamentos_atrasados');
    if (error) {
      console.error('Falha na automacao de conclusao:', error.message);
      return;
    }

    window.sessionStorage.setItem(cacheKey, String(now));
  },

  async updateAgendamento(id, payload) {
    const query = this.scopeToFrontBarbearia(
      window.sb
        .from('agendamentos')
        .update(payload)
        .eq('id', id)
    );

    const { error } = await query;

    if (error) throw error;
  }
};
