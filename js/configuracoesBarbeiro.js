document.addEventListener('DOMContentLoaded', async () => {
  const user = await window.Auth.requireAuth(['barbeiro']);
  if (!user) return;

  await window.CommonUI.setupLayout(user);

  const info = document.getElementById('config-barbeiro-info');
  const semanaRefInput = document.getElementById('cfgb-semana-ref');
  const horariosBody = document.getElementById('cfgb-horarios-body');
  const btnSalvar = document.getElementById('btn-salvar-meus-horarios');

  const diasSemana = [
    { id: 0, nome: 'Domingo' },
    { id: 1, nome: 'Segunda' },
    { id: 2, nome: 'Terca' },
    { id: 3, nome: 'Quarta' },
    { id: 4, nome: 'Quinta' },
    { id: 5, nome: 'Sexta' },
    { id: 6, nome: 'Sabado' }
  ];

  function isoDate(date) {
    return date.toISOString().slice(0, 10);
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

  async function getMeuBarbeiroId() {
    const { data, error } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('barbeiros')
        .select('id, nome')
        .eq('usuario_id', user.id)
    ).maybeSingle();
    if (error) throw error;
    return data?.id || null;
  }

  function renderRows(horariosMap, defaults, datesMap) {
    horariosBody.innerHTML = diasSemana.map((d) => {
      const item = horariosMap.get(d.id) || {};
      const ativo = item.ativo ?? true;
      const inicio = String(item.hora_inicio || defaults.hora_abertura || '09:00').slice(0, 5);
      const inicioIntervalo = String(item.hora_intervalo_inicio || '').slice(0, 5);
      const voltaIntervalo = String(item.hora_intervalo_fim || '').slice(0, 5);
      const fim = String(item.hora_fim || defaults.hora_fechamento || '19:00').slice(0, 5);
      const intv = Number(item.intervalo_minutos || defaults.intervalo_minutos || 30);
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

  async function loadHorarios(meuBarbeiroId, defaults) {
    const { data, error } = await window.Api.scopeToFrontBarbearia(
      window.sb
        .from('barbeiro_horarios')
        .select('dia_semana, ativo, hora_inicio, hora_intervalo_inicio, hora_intervalo_fim, hora_fim, intervalo_minutos')
        .eq('barbeiro_id', meuBarbeiroId)
    );
    if (error) throw error;

    const map = new Map((data || []).map((h) => [Number(h.dia_semana), h]));
    const datesMap = weekDatesMap(semanaRefInput.value);
    renderRows(map, defaults, datesMap);
  }

  let meuBarbeiroId = null;
  let defaults = { hora_abertura: '09:00', hora_fechamento: '19:00', intervalo_minutos: 30 };

  semanaRefInput.addEventListener('change', async () => {
    try {
      if (!meuBarbeiroId) return;
      await loadHorarios(meuBarbeiroId, defaults);
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  horariosBody.addEventListener('change', (ev) => {
    const input = ev.target.closest('input[data-field="ativo"]');
    if (!input) return;
    const label = input.closest('.status-switch')?.querySelector('.status-switch-label');
    if (label) label.textContent = input.checked ? 'Ativo' : 'Pausado';
  });

  btnSalvar.addEventListener('click', async () => {
    if (!meuBarbeiroId) {
      window.AppUtils.notify(info, 'Barbeiro nao encontrado para este usuario.', true);
      return;
    }

    try {
      const rows = diasSemana.map((d) => {
        const ativo = horariosBody.querySelector(`input[data-dia="${d.id}"][data-field="ativo"]`)?.checked ?? true;
        const inicio = horariosBody.querySelector(`input[data-dia="${d.id}"][data-field="inicio"]`)?.value || null;
        const inicioIntervalo = horariosBody.querySelector(`input[data-dia="${d.id}"][data-field="inicio-intervalo"]`)?.value || null;
        const voltaIntervalo = horariosBody.querySelector(`input[data-dia="${d.id}"][data-field="volta-intervalo"]`)?.value || null;
        const fim = horariosBody.querySelector(`input[data-dia="${d.id}"][data-field="fim"]`)?.value || null;
        const intv = Number(horariosBody.querySelector(`input[data-dia="${d.id}"][data-field="intervalo"]`)?.value || 30);

        if (!ativo) {
          return {
            barbeiro_id: meuBarbeiroId,
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
        if (inicioIntervalo && voltaIntervalo) {
          if (!(inicio < inicioIntervalo && inicioIntervalo < voltaIntervalo && voltaIntervalo < fim)) {
            throw new Error(`Intervalo de almoco invalido em ${d.nome}.`);
          }
        }
        if (!Number.isFinite(intv) || intv < 5 || intv > 120) {
          throw new Error(`Intervalo invalido em ${d.nome}: use um valor entre 5 e 120 minutos.`);
        }
        return {
          barbeiro_id: meuBarbeiroId,
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
      window.AppUtils.notify(info, 'Meus horarios foram salvos com sucesso.');
    } catch (err) {
      window.AppUtils.notify(info, err.message, true);
    }
  });

  try {
    semanaRefInput.value = isoDate(new Date());
    meuBarbeiroId = await getMeuBarbeiroId();
    if (!meuBarbeiroId) {
      window.AppUtils.notify(info, 'Seu usuario nao possui barbeiro vinculado.', true);
      return;
    }
    await loadHorarios(meuBarbeiroId, defaults);
  } catch (err) {
    window.AppUtils.notify(info, err.message, true);
  }
});
