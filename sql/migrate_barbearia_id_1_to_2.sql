-- =========================================================
-- MIGRACAO: ADICIONAR BARBEARIA TESTE ID 2
-- Mantem a barbearia id = 1 intacta e faz o fluxo publico
-- usar a barbearia teste id = 2.
-- =========================================================

begin;

insert into public.barbearias (id, nome, slug)
values (2, 'Barbearia teste', 'barbearia-teste')
on conflict (id) do update
  set nome = excluded.nome,
      slug = excluded.slug,
      ativo = true;

insert into public.configuracao_agenda (
  barbearia_id,
  hora_abertura,
  hora_fechamento,
  intervalo_minutos,
  whatsapp_confirmacao_obrigatoria
)
values (
  2,
  '09:00',
  '19:00',
  30,
  true
)
on conflict (barbearia_id) do update
  set hora_abertura = excluded.hora_abertura,
      hora_fechamento = excluded.hora_fechamento,
      intervalo_minutos = excluded.intervalo_minutos,
      whatsapp_confirmacao_obrigatoria = excluded.whatsapp_confirmacao_obrigatoria,
      updated_at = now();

create or replace function public.fn_barbearia_publica_id()
returns bigint
language sql
stable
as $$
  select 2::bigint;
$$;

create or replace function public.obter_cliente_auth()
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
    and c.barbearia_id = public.fn_minha_barbearia_id()
  limit 1;
$$;

create or replace function public.criar_agendamento_cliente_auth(
  p_servico_id uuid,
  p_barbeiro_id uuid,
  p_data date,
  p_hora_inicio time
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_agendamento_id uuid;
  v_barbearia_id bigint;
begin
  select c.id, c.barbearia_id
  into v_cliente_id, v_barbearia_id
  from public.clientes c
  where c.usuario_id = auth.uid()
    and c.barbearia_id = public.fn_minha_barbearia_id()
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

create or replace function public.listar_meus_agendamentos()
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
    and c.barbearia_id = public.fn_minha_barbearia_id()
    and a.barbearia_id = public.fn_minha_barbearia_id()
  order by a.data desc, a.hora_inicio desc;
$$;

create or replace function public.cancelar_agendamento_cliente(p_agendamento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_data date;
  v_hora time;
  v_cliente_id uuid;
begin
  select c.id into v_cliente_id
  from public.clientes c
  where c.usuario_id = auth.uid()
    and c.barbearia_id = public.fn_minha_barbearia_id()
  limit 1;

  select a.data, a.hora_inicio
  into v_data, v_hora
  from public.agendamentos a
  where a.id = p_agendamento_id
    and a.cliente_id = v_cliente_id
    and a.barbearia_id = public.fn_minha_barbearia_id()
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
  where id = p_agendamento_id;
end;
$$;

commit;
