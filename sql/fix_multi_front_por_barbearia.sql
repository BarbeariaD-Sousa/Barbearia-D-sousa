-- =========================================================
-- FIX: CADA FRONT DEVE ENXERGAR APENAS SUA BARBEARIA
-- Usa p_barbearia_id nas RPCs publicas e do cliente autenticado.
-- =========================================================

begin;

create or replace function public.listar_barbeiros_publico(
  p_barbearia_id bigint default null
)
returns table (
  id uuid,
  nome text,
  telefone text
)
language sql
security definer
set search_path = public
as $$
  select b.id, b.nome, coalesce(nullif(b.telefone, ''), u.telefone) as telefone
  from public.barbeiros b
  left join public.usuarios u on u.id = b.usuario_id
  where b.barbearia_id = coalesce(p_barbearia_id, public.fn_barbearia_publica_id())
    and b.ativo = true
    and coalesce(u.perfil, 'barbeiro') <> 'admin'
  order by b.nome;
$$;

create or replace function public.listar_servicos_publico(
  p_barbearia_id bigint default null
)
returns table (
  id uuid,
  nome text,
  preco numeric,
  duracao_minutos integer
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.nome, s.preco, s.duracao_minutos
  from public.servicos s
  where s.barbearia_id = coalesce(p_barbearia_id, public.fn_barbearia_publica_id())
    and s.ativo = true
  order by s.nome;
$$;

create or replace function public.obter_configuracao_agenda_publica(
  p_barbearia_id bigint default null
)
returns table (
  hora_abertura time,
  hora_fechamento time,
  intervalo_minutos integer,
  whatsapp_confirmacao_obrigatoria boolean
)
language sql
security definer
set search_path = public
as $$
  select c.hora_abertura, c.hora_fechamento, c.intervalo_minutos, c.whatsapp_confirmacao_obrigatoria
  from public.configuracao_agenda c
  where c.barbearia_id = coalesce(p_barbearia_id, public.fn_barbearia_publica_id())
  limit 1;
$$;

create or replace function public.garantir_cliente_auth(
  p_nome text,
  p_telefone text default null,
  p_email text default null,
  p_barbearia_id bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_barbearia_id bigint := coalesce(
    p_barbearia_id,
    public.fn_minha_barbearia_id(),
    public.fn_barbearia_publica_id()
  );
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Usuario nao autenticado';
  end if;

  insert into public.usuarios (
    id,
    barbearia_id,
    email,
    nome,
    telefone,
    perfil,
    ativo
  )
  values (
    v_uid,
    v_barbearia_id,
    nullif(trim(coalesce(p_email, '')), ''),
    coalesce(nullif(trim(coalesce(p_nome, '')), ''), 'Cliente'),
    nullif(trim(coalesce(p_telefone, '')), ''),
    'cliente',
    true
  )
  on conflict (id) do update
    set barbearia_id = excluded.barbearia_id,
        nome = excluded.nome,
        email = coalesce(excluded.email, public.usuarios.email),
        telefone = coalesce(excluded.telefone, public.usuarios.telefone);

  insert into public.clientes (
    barbearia_id,
    usuario_id,
    nome,
    telefone
  )
  values (
    v_barbearia_id,
    v_uid,
    coalesce(nullif(trim(coalesce(p_nome, '')), ''), 'Cliente'),
    nullif(trim(coalesce(p_telefone, '')), '')
  )
  on conflict (usuario_id) do update
    set barbearia_id = excluded.barbearia_id,
        nome = excluded.nome,
        telefone = coalesce(excluded.telefone, public.clientes.telefone);

  return v_uid;
end;
$$;

create or replace function public.obter_cliente_auth(
  p_barbearia_id bigint default null
)
returns table (
  id uuid,
  nome text,
  telefone text
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.nome, c.telefone
  from public.clientes c
  where c.usuario_id = auth.uid()
    and c.barbearia_id = coalesce(p_barbearia_id, public.fn_minha_barbearia_id())
  limit 1;
$$;

create or replace function public.horarios_disponiveis_cliente(
  p_data date,
  p_barbeiro_id uuid,
  p_servico_id uuid,
  p_barbearia_id bigint default null
)
returns table (
  hora_inicio time
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia_id bigint;
  v_abertura time;
  v_fechamento time;
  v_intervalo integer;
  v_duracao integer;
  v_cursor time;
  v_dow integer;
  v_horario record;
  v_now_sp timestamp;
begin
  if p_data is null or p_barbeiro_id is null or p_servico_id is null then
    raise exception 'Data, barbeiro e servico sao obrigatorios';
  end if;

  v_barbearia_id := coalesce(p_barbearia_id, public.fn_barbearia_publica_id());
  v_dow := extract(dow from p_data)::integer;
  v_now_sp := now() at time zone 'America/Sao_Paulo';

  if exists (
    select 1
    from public.loja_dias_fechados f
    where f.barbearia_id = v_barbearia_id
      and f.dia_semana = v_dow
      and f.fechado = true
  ) then
    return;
  end if;

  select s.duracao_minutos
  into v_duracao
  from public.servicos s
  where s.id = p_servico_id
    and s.barbearia_id = v_barbearia_id
    and s.ativo = true;

  if v_duracao is null then
    raise exception 'Servico invalido';
  end if;

  select h.*
  into v_horario
  from public.barbeiro_horarios h
  join public.barbeiros b on b.id = h.barbeiro_id and b.barbearia_id = h.barbearia_id
  where h.barbearia_id = v_barbearia_id
    and h.barbeiro_id = p_barbeiro_id
    and h.dia_semana = v_dow
    and h.ativo = true
  limit 1;

  if v_horario.id is null then
    return;
  end if;

  select
    coalesce(ld.hora_inicio, v_horario.hora_inicio, c.hora_abertura),
    coalesce(ld.hora_fim, v_horario.hora_fim, c.hora_fechamento),
    coalesce(ld.intervalo_minutos, v_horario.intervalo_minutos, c.intervalo_minutos)
  into v_abertura, v_fechamento, v_intervalo
  from public.configuracao_agenda c
  left join public.loja_horarios_data ld
    on ld.barbearia_id = c.barbearia_id
   and ld.data = p_data
  where c.barbearia_id = v_barbearia_id
  limit 1;

  if v_abertura is null or v_fechamento is null or v_abertura >= v_fechamento then
    return;
  end if;

  v_cursor := v_abertura;
  while (v_cursor + make_interval(mins => v_duracao)) <= v_fechamento loop
    if (
      v_horario.hora_intervalo_inicio is not null
      and v_horario.hora_intervalo_fim is not null
      and v_cursor < v_horario.hora_intervalo_fim
      and (v_cursor + make_interval(mins => v_duracao))::time > v_horario.hora_intervalo_inicio
    ) then
      v_cursor := greatest((v_cursor + make_interval(mins => v_intervalo))::time, v_horario.hora_intervalo_fim);
      continue;
    end if;

    if not exists (
      select 1
      from public.agendamentos a
      where a.barbearia_id = v_barbearia_id
        and a.barbeiro_id = p_barbeiro_id
        and a.data = p_data
        and a.status not in ('cancelado', 'desistencia_cliente')
        and v_cursor < a.hora_fim
        and (v_cursor + make_interval(mins => v_duracao))::time > a.hora_inicio
    ) then
      if p_data > v_now_sp::date or (p_data = v_now_sp::date and v_cursor > v_now_sp::time) then
        hora_inicio := v_cursor;
        return next;
      end if;
    end if;

    v_cursor := (v_cursor + make_interval(mins => v_intervalo))::time;
  end loop;
end;
$$;

create or replace function public.criar_agendamento_publico(
  p_cliente_id uuid default null,
  p_nome text default null,
  p_telefone text default null,
  p_barbeiro_id uuid default null,
  p_servico_id uuid default null,
  p_data date default null,
  p_hora_inicio time default null,
  p_sem_cadastro boolean default false,
  p_barbearia_id bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia_id bigint := coalesce(p_barbearia_id, public.fn_barbearia_publica_id());
  v_cliente_id uuid;
  v_agendamento_id uuid;
begin
  if p_barbeiro_id is null or p_servico_id is null or p_data is null or p_hora_inicio is null then
    raise exception 'Barbeiro, servico, data e horario sao obrigatorios';
  end if;

  if p_data < current_date then
    raise exception 'Nao e permitido agendar em data passada';
  end if;

  if p_cliente_id is not null then
    select c.id into v_cliente_id
    from public.clientes c
    where c.id = p_cliente_id
      and c.barbearia_id = v_barbearia_id;
  else
    insert into public.clientes (
      barbearia_id,
      nome,
      telefone,
      observacao
    )
    values (
      v_barbearia_id,
      coalesce(nullif(trim(coalesce(p_nome, '')), ''), 'Cliente'),
      nullif(trim(coalesce(p_telefone, '')), ''),
      case when p_sem_cadastro then 'Agendamento rapido sem cadastro' else 'Agendamento publico' end
    )
    returning id into v_cliente_id;
  end if;

  if v_cliente_id is null then
    raise exception 'Cliente invalido';
  end if;

  insert into public.agendamentos (
    barbearia_id,
    cliente_id,
    barbeiro_id,
    servico_id,
    data,
    hora_inicio,
    pagamento_status,
    pagamento_pendente
  )
  values (
    v_barbearia_id,
    v_cliente_id,
    p_barbeiro_id,
    p_servico_id,
    p_data,
    p_hora_inicio,
    'pago',
    false
  )
  returning id into v_agendamento_id;

  return v_agendamento_id;
end;
$$;

create or replace function public.criar_agendamento_cliente_auth(
  p_servico_id uuid,
  p_barbeiro_id uuid,
  p_data date,
  p_hora_inicio time,
  p_barbearia_id bigint default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_agendamento_id uuid;
  v_barbearia_id bigint := coalesce(p_barbearia_id, public.fn_minha_barbearia_id());
begin
  select c.id
  into v_cliente_id
  from public.clientes c
  where c.usuario_id = auth.uid()
    and c.barbearia_id = v_barbearia_id
  limit 1;

  if v_cliente_id is null then
    raise exception 'Cliente nao encontrado para o usuario logado';
  end if;

  insert into public.agendamentos (
    barbearia_id,
    cliente_id,
    barbeiro_id,
    servico_id,
    data,
    hora_inicio,
    pagamento_status,
    pagamento_pendente
  )
  values (
    v_barbearia_id,
    v_cliente_id,
    p_barbeiro_id,
    p_servico_id,
    p_data,
    p_hora_inicio,
    'pago',
    false
  )
  returning id into v_agendamento_id;

  return v_agendamento_id;
end;
$$;

create or replace function public.listar_meus_agendamentos(
  p_barbearia_id bigint default null
)
returns table (
  id uuid,
  barbeiro text,
  barbeiro_telefone text,
  servico text,
  data date,
  hora_inicio time,
  hora_fim time,
  status text,
  valor numeric,
  pode_cancelar boolean
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    b.nome as barbeiro,
    coalesce(nullif(b.telefone, ''), ub.telefone) as barbeiro_telefone,
    s.nome as servico,
    a.data,
    a.hora_inicio,
    a.hora_fim,
    a.status,
    a.valor,
    (
      a.status = 'agendado'
      and ((a.data::timestamp + a.hora_inicio) - now()) > interval '2 hours'
    ) as pode_cancelar
  from public.agendamentos a
  join public.clientes c on c.id = a.cliente_id
  join public.barbeiros b on b.id = a.barbeiro_id
  left join public.usuarios ub on ub.id = b.usuario_id
  join public.servicos s on s.id = a.servico_id
  where c.usuario_id = auth.uid()
    and c.barbearia_id = coalesce(p_barbearia_id, public.fn_minha_barbearia_id())
    and a.barbearia_id = coalesce(p_barbearia_id, public.fn_minha_barbearia_id())
  order by a.data desc, a.hora_inicio desc;
$$;

create or replace function public.cancelar_agendamento_cliente(
  p_agendamento_id uuid,
  p_barbearia_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data date;
  v_hora time;
  v_cliente_id uuid;
  v_barbearia_id bigint := coalesce(p_barbearia_id, public.fn_minha_barbearia_id());
begin
  select c.id into v_cliente_id
  from public.clientes c
  where c.usuario_id = auth.uid()
    and c.barbearia_id = v_barbearia_id
  limit 1;

  select a.data, a.hora_inicio
  into v_data, v_hora
  from public.agendamentos a
  where a.id = p_agendamento_id
    and a.cliente_id = v_cliente_id
    and a.barbearia_id = v_barbearia_id
    and a.status = 'agendado';

  if v_data is null then
    raise exception 'Agendamento nao encontrado para este cliente';
  end if;

  if ((v_data::timestamp + v_hora) - now()) <= interval '2 hours' then
    raise exception 'Cancelamento permitido apenas com mais de 2 horas de antecedencia';
  end if;

  update public.agendamentos
  set status = 'cancelado',
      pagamento_status = 'pendente',
      pagamento_pendente = true,
      motivo_cancelamento = 'Cancelado pelo cliente',
      cancelado_em = now(),
      cancelado_por = auth.uid()
  where id = p_agendamento_id
    and barbearia_id = v_barbearia_id;
end;
$$;

grant execute on function public.listar_barbeiros_publico(bigint) to anon, authenticated;
grant execute on function public.listar_servicos_publico(bigint) to anon, authenticated;
grant execute on function public.obter_configuracao_agenda_publica(bigint) to anon, authenticated;
grant execute on function public.garantir_cliente_auth(text, text, text, bigint) to authenticated;
grant execute on function public.obter_cliente_auth(bigint) to authenticated;
grant execute on function public.horarios_disponiveis_cliente(date, uuid, uuid, bigint) to anon, authenticated;
grant execute on function public.criar_agendamento_publico(uuid, text, text, uuid, uuid, date, time, boolean, bigint) to anon, authenticated;
grant execute on function public.criar_agendamento_cliente_auth(uuid, uuid, date, time, bigint) to authenticated;
grant execute on function public.listar_meus_agendamentos(bigint) to authenticated;
grant execute on function public.cancelar_agendamento_cliente(uuid, bigint) to authenticated;

commit;
