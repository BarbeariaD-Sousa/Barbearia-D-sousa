-- =========================================================
-- BARBERIA D'SOUSA - SCHEMA MULTI BARBEARIA
-- Esta instalacao mantem a barbearia id = 1 como barbearia publica padrao
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- LIMPEZA
-- =========================================================

drop function if exists public.atualizar_agendamentos_atrasados() cascade;
drop function if exists public.dashboard_admin_resumo(date, date) cascade;
drop function if exists public.criar_agendamento_manual_barbeiro(uuid, uuid, uuid, date, time) cascade;
drop function if exists public.listar_clientes_agendamento_barbeiro(text) cascade;
drop function if exists public.cancelar_agendamento_cliente(uuid) cascade;
drop function if exists public.listar_meus_agendamentos() cascade;
drop function if exists public.criar_agendamento_cliente_auth(uuid, uuid, date, time) cascade;
drop function if exists public.criar_agendamento_publico(uuid, text, text, uuid, uuid, date, time, boolean) cascade;
drop function if exists public.horarios_disponiveis_cliente(date, uuid, uuid) cascade;
drop function if exists public.obter_cliente_auth() cascade;
drop function if exists public.registrar_cliente_auth(text, text, text) cascade;
drop function if exists public.garantir_cliente_auth(text, text, text) cascade;
drop function if exists public.obter_configuracao_agenda_publica() cascade;
drop function if exists public.listar_servicos_publico() cascade;
drop function if exists public.listar_barbeiros_publico() cascade;
drop function if exists public.admin_definir_senha_usuario(uuid, text) cascade;
drop function if exists public.admin_atualizar_usuario_cadastro(uuid, text, text, text, date) cascade;
drop function if exists public.definir_usuario_como_cliente(uuid) cascade;
drop function if exists public.definir_usuario_como_barbeiro(uuid, text, text, numeric) cascade;
drop function if exists public.listar_usuarios_cadastro_admin() cascade;
drop function if exists public.trg_sync_financeiro_agendamento() cascade;
drop function if exists public.trg_preencher_agendamento() cascade;
drop function if exists public.fn_admin_mesma_barbearia(bigint) cascade;
drop function if exists public.fn_staff_mesma_barbearia(bigint) cascade;
drop function if exists public.fn_usuario_mesma_barbearia(bigint) cascade;
drop function if exists public.fn_meu_barbeiro_id() cascade;
drop function if exists public.fn_is_barbeiro() cascade;
drop function if exists public.fn_is_admin() cascade;
drop function if exists public.fn_minha_barbearia_id() cascade;
drop function if exists public.fn_barbearia_publica_id() cascade;

drop table if exists public.financeiro cascade;
drop table if exists public.comissoes cascade;
drop table if exists public.agendamentos cascade;
drop table if exists public.barbeiro_horarios cascade;
drop table if exists public.servicos cascade;
drop table if exists public.barbeiros cascade;
drop table if exists public.clientes cascade;
drop table if exists public.configuracao_agenda cascade;
drop table if exists public.loja_horarios_data cascade;
drop table if exists public.loja_dias_fechados cascade;
drop table if exists public.receitas_manuais cascade;
drop table if exists public.contas_receber_manuais cascade;
drop table if exists public.despesas cascade;
drop table if exists public.categorias_despesa cascade;
drop table if exists public.usuarios cascade;
drop table if exists public.barbearias cascade;

-- =========================================================
-- TABELAS
-- =========================================================

create table public.barbearias (
  id bigint primary key,
  nome text not null,
  slug text not null unique,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  barbearia_id bigint not null references public.barbearias(id) on delete restrict,
  email text,
  nome text not null,
  telefone text,
  data_nascimento date,
  perfil text not null check (perfil in ('admin', 'barbeiro', 'cliente')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  barbearia_id bigint not null references public.barbearias(id) on delete restrict,
  usuario_id uuid unique references public.usuarios(id) on delete set null,
  nome text not null,
  telefone text,
  observacao text,
  created_at timestamptz not null default now()
);

create table public.barbeiros (
  id uuid primary key default gen_random_uuid(),
  barbearia_id bigint not null references public.barbearias(id) on delete restrict,
  usuario_id uuid unique references public.usuarios(id) on delete set null,
  nome text not null,
  telefone text,
  comissao_percentual numeric(5,2) not null default 40 check (comissao_percentual >= 0 and comissao_percentual <= 100),
  saldo_barbeiro numeric(12,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.servicos (
  id uuid primary key default gen_random_uuid(),
  barbearia_id bigint not null references public.barbearias(id) on delete restrict,
  nome text not null,
  preco numeric(12,2) not null check (preco >= 0),
  duracao_minutos integer not null check (duracao_minutos > 0 and duracao_minutos <= 720),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (barbearia_id, nome)
);

create table public.barbeiro_horarios (
  id uuid primary key default gen_random_uuid(),
  barbearia_id bigint not null references public.barbearias(id) on delete restrict,
  barbeiro_id uuid not null references public.barbeiros(id) on delete cascade,
  dia_semana integer not null check (dia_semana >= 0 and dia_semana <= 6),
  ativo boolean not null default true,
  hora_inicio time,
  hora_intervalo_inicio time,
  hora_intervalo_fim time,
  hora_fim time,
  intervalo_minutos integer default 30 check (intervalo_minutos is null or (intervalo_minutos > 0 and intervalo_minutos <= 120)),
  created_at timestamptz not null default now(),
  unique (barbeiro_id, dia_semana),
  check (
    (ativo = false)
    or (
      hora_inicio is not null
      and hora_fim is not null
      and hora_inicio < hora_fim
    )
  ),
  check (
    hora_intervalo_inicio is null
    or hora_intervalo_fim is null
    or (
      hora_inicio is not null
      and hora_fim is not null
      and hora_inicio < hora_intervalo_inicio
      and hora_intervalo_inicio < hora_intervalo_fim
      and hora_intervalo_fim < hora_fim
    )
  )
);

create table public.configuracao_agenda (
  id bigint generated by default as identity primary key,
  barbearia_id bigint not null unique references public.barbearias(id) on delete cascade,
  hora_abertura time not null default '09:00',
  hora_fechamento time not null default '19:00',
  intervalo_minutos integer not null default 30 check (intervalo_minutos > 0 and intervalo_minutos <= 120),
  whatsapp_confirmacao_obrigatoria boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.loja_horarios_data (
  id uuid primary key default gen_random_uuid(),
  barbearia_id bigint not null references public.barbearias(id) on delete cascade,
  data date not null,
  ativo boolean not null default true,
  hora_inicio time,
  hora_fim time,
  intervalo_minutos integer default 30 check (intervalo_minutos is null or (intervalo_minutos > 0 and intervalo_minutos <= 120)),
  updated_at timestamptz not null default now(),
  unique (barbearia_id, data)
);

create table public.loja_dias_fechados (
  id uuid primary key default gen_random_uuid(),
  barbearia_id bigint not null references public.barbearias(id) on delete cascade,
  dia_semana integer not null check (dia_semana >= 0 and dia_semana <= 6),
  fechado boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (barbearia_id, dia_semana)
);

create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  barbearia_id bigint not null references public.barbearias(id) on delete restrict,
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  barbeiro_id uuid not null references public.barbeiros(id) on delete restrict,
  servico_id uuid not null references public.servicos(id) on delete restrict,
  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  status text not null default 'agendado' check (status in ('agendado', 'em_atendimento', 'concluido', 'cancelado', 'desistencia_cliente')),
  pagamento_status text not null default 'pago' check (pagamento_status in ('pago', 'pendente')),
  pagamento_pendente boolean not null default false,
  valor numeric(12,2) not null default 0,
  motivo_cancelamento text,
  cancelado_em timestamptz,
  cancelado_por uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.financeiro (
  id uuid primary key default gen_random_uuid(),
  barbearia_id bigint not null references public.barbearias(id) on delete restrict,
  agendamento_id uuid not null unique references public.agendamentos(id) on delete cascade,
  barbeiro_id uuid not null references public.barbeiros(id) on delete restrict,
  valor_servico numeric(12,2) not null check (valor_servico >= 0),
  comissao_barbeiro numeric(12,2) not null check (comissao_barbeiro >= 0),
  forma_pagamento text,
  status_pagamento text not null check (status_pagamento in ('pago', 'pendente')),
  data date not null,
  created_at timestamptz not null default now()
);

create table public.receitas_manuais (
  id uuid primary key default gen_random_uuid(),
  barbearia_id bigint not null references public.barbearias(id) on delete restrict,
  descricao text not null,
  categoria text,
  valor numeric(12,2) not null check (valor >= 0),
  data date not null,
  status_pagamento text not null default 'pago' check (status_pagamento in ('pago', 'pendente')),
  observacao text,
  created_at timestamptz not null default now()
);

create table public.contas_receber_manuais (
  id uuid primary key default gen_random_uuid(),
  barbearia_id bigint not null references public.barbearias(id) on delete restrict,
  descricao text not null,
  categoria text,
  valor numeric(12,2) not null check (valor >= 0),
  data date not null,
  status text not null default 'pendente' check (status in ('pendente', 'recebido')),
  data_recebimento date,
  observacao text,
  created_at timestamptz not null default now()
);

create table public.categorias_despesa (
  id uuid primary key default gen_random_uuid(),
  barbearia_id bigint not null references public.barbearias(id) on delete restrict,
  nome text not null,
  created_at timestamptz not null default now(),
  unique (barbearia_id, nome)
);

create table public.despesas (
  id uuid primary key default gen_random_uuid(),
  barbearia_id bigint not null references public.barbearias(id) on delete restrict,
  descricao text not null,
  categoria text,
  valor numeric(12,2) not null check (valor >= 0),
  data date not null,
  observacao text,
  created_at timestamptz not null default now()
);

create table public.comissoes (
  id uuid primary key default gen_random_uuid(),
  barbearia_id bigint not null references public.barbearias(id) on delete restrict,
  barbeiro_id uuid not null references public.barbeiros(id) on delete restrict,
  agendamento_id uuid not null unique references public.agendamentos(id) on delete cascade,
  valor_servico numeric(12,2) not null check (valor_servico >= 0),
  percentual numeric(5,2) not null check (percentual >= 0 and percentual <= 100),
  valor_comissao numeric(12,2) not null check (valor_comissao >= 0),
  data date not null,
  created_at timestamptz not null default now()
);

create or replace function public.fn_barbearia_publica_id()
returns bigint
language sql
stable
as $$
  select 1::bigint;
$$;

create or replace function public.fn_minha_barbearia_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select u.barbearia_id from public.usuarios u where u.id = auth.uid()),
    public.fn_barbearia_publica_id()
  );
$$;

create or replace function public.fn_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.ativo = true
      and u.perfil = 'admin'
  );
$$;

create or replace function public.fn_is_barbeiro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and u.ativo = true
      and u.perfil in ('admin', 'barbeiro')
  );
$$;

create or replace function public.fn_meu_barbeiro_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.id
  from public.barbeiros b
  where b.usuario_id = auth.uid()
  limit 1;
$$;

create or replace function public.fn_usuario_mesma_barbearia(p_barbearia_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_barbearia_id = public.fn_minha_barbearia_id();
$$;

create or replace function public.fn_admin_mesma_barbearia(p_barbearia_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_admin() and p_barbearia_id = public.fn_minha_barbearia_id();
$$;

create or replace function public.fn_staff_mesma_barbearia(p_barbearia_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.fn_is_barbeiro() and p_barbearia_id = public.fn_minha_barbearia_id();
$$;

alter table public.servicos alter column barbearia_id set default public.fn_minha_barbearia_id();
alter table public.barbeiro_horarios alter column barbearia_id set default public.fn_minha_barbearia_id();
alter table public.configuracao_agenda alter column barbearia_id set default public.fn_minha_barbearia_id();
alter table public.receitas_manuais alter column barbearia_id set default public.fn_minha_barbearia_id();
alter table public.contas_receber_manuais alter column barbearia_id set default public.fn_minha_barbearia_id();
alter table public.categorias_despesa alter column barbearia_id set default public.fn_minha_barbearia_id();
alter table public.despesas alter column barbearia_id set default public.fn_minha_barbearia_id();

-- =========================================================
-- TRIGGERS
-- =========================================================

create or replace function public.trg_preencher_agendamento()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_duracao integer;
  v_preco numeric(12,2);
  v_barbearia_id bigint;
begin
  select s.duracao_minutos, s.preco, s.barbearia_id
  into v_duracao, v_preco, v_barbearia_id
  from public.servicos s
  where s.id = new.servico_id;

  if v_duracao is null then
    raise exception 'Servico invalido';
  end if;

  if not exists (
    select 1
    from public.barbeiros b
    where b.id = new.barbeiro_id
      and b.barbearia_id = v_barbearia_id
      and b.ativo = true
  ) then
    raise exception 'Barbeiro invalido para esta barbearia';
  end if;

  if not exists (
    select 1
    from public.clientes c
    where c.id = new.cliente_id
      and c.barbearia_id = v_barbearia_id
  ) then
    raise exception 'Cliente invalido para esta barbearia';
  end if;

  new.barbearia_id := v_barbearia_id;
  new.valor := coalesce(v_preco, 0);
  new.hora_fim := (new.hora_inicio + make_interval(mins => v_duracao))::time;

  if new.status in ('cancelado', 'desistencia_cliente') then
    new.pagamento_status := 'pendente';
    new.pagamento_pendente := true;
    new.cancelado_em := coalesce(new.cancelado_em, now());
    new.cancelado_por := coalesce(new.cancelado_por, auth.uid());
  else
    new.pagamento_status := coalesce(new.pagamento_status, 'pago');
    new.pagamento_pendente := new.pagamento_status = 'pendente';
    new.cancelado_em := null;
  end if;

  if exists (
    select 1
    from public.agendamentos a
    where a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and a.barbearia_id = new.barbearia_id
      and a.barbeiro_id = new.barbeiro_id
      and a.data = new.data
      and a.status not in ('cancelado', 'desistencia_cliente')
      and new.hora_inicio < a.hora_fim
      and new.hora_fim > a.hora_inicio
  ) then
    raise exception 'Ja existe agendamento nesse horario';
  end if;

  return new;
end;
$$;

create or replace function public.trg_sync_financeiro_agendamento()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_percentual numeric(5,2);
  v_valor_comissao numeric(12,2);
begin
  if tg_op = 'DELETE' then
    delete from public.financeiro where agendamento_id = old.id;
    delete from public.comissoes where agendamento_id = old.id;
    return old;
  end if;

  if new.status in ('cancelado', 'desistencia_cliente') then
    delete from public.financeiro where agendamento_id = new.id;
    delete from public.comissoes where agendamento_id = new.id;
    return new;
  end if;

  select b.comissao_percentual
  into v_percentual
  from public.barbeiros b
  where b.id = new.barbeiro_id;

  v_valor_comissao := round((coalesce(new.valor, 0) * coalesce(v_percentual, 0)) / 100.0, 2);

  insert into public.financeiro (
    barbearia_id,
    agendamento_id,
    barbeiro_id,
    valor_servico,
    comissao_barbeiro,
    status_pagamento,
    data
  )
  values (
    new.barbearia_id,
    new.id,
    new.barbeiro_id,
    new.valor,
    v_valor_comissao,
    new.pagamento_status,
    new.data
  )
  on conflict (agendamento_id) do update
    set barbeiro_id = excluded.barbeiro_id,
        valor_servico = excluded.valor_servico,
        comissao_barbeiro = excluded.comissao_barbeiro,
        status_pagamento = excluded.status_pagamento,
        data = excluded.data;

  insert into public.comissoes (
    barbearia_id,
    barbeiro_id,
    agendamento_id,
    valor_servico,
    percentual,
    valor_comissao,
    data
  )
  values (
    new.barbearia_id,
    new.barbeiro_id,
    new.id,
    new.valor,
    coalesce(v_percentual, 0),
    v_valor_comissao,
    new.data
  )
  on conflict (agendamento_id) do update
    set barbeiro_id = excluded.barbeiro_id,
        valor_servico = excluded.valor_servico,
        percentual = excluded.percentual,
        valor_comissao = excluded.valor_comissao,
        data = excluded.data;

  return new;
end;
$$;

create trigger before_agendamentos_write
before insert or update on public.agendamentos
for each row execute function public.trg_preencher_agendamento();

create trigger after_agendamentos_write
after insert or update or delete on public.agendamentos
for each row execute function public.trg_sync_financeiro_agendamento();

-- =========================================================
-- RPCS PUBLICAS E CLIENTE
-- =========================================================

create or replace function public.listar_barbeiros_publico()
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
  where b.barbearia_id = public.fn_barbearia_publica_id()
    and b.ativo = true
    and coalesce(u.perfil, 'barbeiro') <> 'admin'
  order by b.nome;
$$;

create or replace function public.listar_servicos_publico()
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
  where s.barbearia_id = public.fn_barbearia_publica_id()
    and s.ativo = true
  order by s.nome;
$$;

create or replace function public.obter_configuracao_agenda_publica()
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
  where c.barbearia_id = public.fn_barbearia_publica_id()
  limit 1;
$$;

create or replace function public.garantir_cliente_auth(
  p_nome text,
  p_telefone text default null,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_barbearia_id bigint := public.fn_barbearia_publica_id();
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
    set nome = excluded.nome,
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
    set nome = excluded.nome,
        telefone = coalesce(excluded.telefone, public.clientes.telefone);

  return v_uid;
end;
$$;

create or replace function public.registrar_cliente_auth(
  p_nome text,
  p_telefone text default null,
  p_email text default null
)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.garantir_cliente_auth(p_nome, p_telefone, p_email);
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

create or replace function public.horarios_disponiveis_cliente(
  p_data date,
  p_barbeiro_id uuid,
  p_servico_id uuid
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

  v_barbearia_id := public.fn_barbearia_publica_id();
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
  p_sem_cadastro boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia_id bigint := public.fn_barbearia_publica_id();
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

-- =========================================================
-- RPCS ADMIN E BARBEIRO
-- =========================================================

create or replace function public.listar_clientes_agendamento_barbeiro(
  p_busca text default null
)
returns table (
  id uuid,
  nome text,
  email text,
  telefone text
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    coalesce(c.nome, u.nome) as nome,
    u.email,
    coalesce(nullif(c.telefone, ''), nullif(u.telefone, '')) as telefone
  from public.usuarios u
  left join public.clientes c on c.usuario_id = u.id
  where u.barbearia_id = public.fn_minha_barbearia_id()
    and u.perfil = 'cliente'
    and (
      p_busca is null
      or lower(u.nome) like '%' || lower(p_busca) || '%'
      or lower(coalesce(u.telefone, '')) like '%' || lower(p_busca) || '%'
      or lower(coalesce(c.telefone, '')) like '%' || lower(p_busca) || '%'
    )
  order by coalesce(c.nome, u.nome);
$$;

create or replace function public.criar_agendamento_manual_barbeiro(
  p_usuario_id uuid,
  p_barbeiro_id uuid,
  p_servico_id uuid,
  p_data date,
  p_hora_inicio time
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia_id bigint := public.fn_minha_barbearia_id();
  v_cliente_id uuid;
  v_nome text;
  v_telefone text;
  v_agendamento_id uuid;
begin
  if not public.fn_is_barbeiro() then
    raise exception 'Apenas admin ou barbeiro podem criar agendamento manual';
  end if;

  select u.nome, u.telefone
  into v_nome, v_telefone
  from public.usuarios u
  where u.id = p_usuario_id
    and u.barbearia_id = v_barbearia_id
    and u.perfil = 'cliente';

  if v_nome is null then
    raise exception 'Usuario cliente nao encontrado';
  end if;

  insert into public.clientes (
    barbearia_id,
    usuario_id,
    nome,
    telefone
  )
  values (
    v_barbearia_id,
    p_usuario_id,
    v_nome,
    nullif(trim(coalesce(v_telefone, '')), '')
  )
  on conflict (usuario_id) do update
    set nome = excluded.nome,
        telefone = coalesce(excluded.telefone, public.clientes.telefone)
  returning id into v_cliente_id;

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

create or replace function public.listar_usuarios_cadastro_admin()
returns table (
  id uuid,
  nome text,
  email text,
  telefone text,
  data_nascimento date,
  perfil text,
  ativo boolean,
  comissao_percentual numeric
)
language sql
security definer
set search_path = public
as $$
  select
    u.id,
    u.nome,
    u.email,
    coalesce(nullif(u.telefone, ''), c.telefone, b.telefone) as telefone,
    u.data_nascimento,
    u.perfil,
    u.ativo,
    b.comissao_percentual
  from public.usuarios u
  left join public.clientes c on c.usuario_id = u.id
  left join public.barbeiros b on b.usuario_id = u.id
  where public.fn_is_admin()
    and u.barbearia_id = public.fn_minha_barbearia_id()
  order by u.created_at desc;
$$;

create or replace function public.admin_atualizar_usuario_cadastro(
  p_usuario_id uuid,
  p_nome text,
  p_email text,
  p_telefone text,
  p_data_nascimento date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia_id bigint := public.fn_minha_barbearia_id();
begin
  if not public.fn_is_admin() then
    raise exception 'Apenas admin pode editar usuarios';
  end if;

  update public.usuarios
  set nome = trim(coalesce(p_nome, nome)),
      email = nullif(trim(coalesce(p_email, '')), ''),
      telefone = nullif(trim(coalesce(p_telefone, '')), ''),
      data_nascimento = p_data_nascimento
  where id = p_usuario_id
    and barbearia_id = v_barbearia_id;

  if not found then
    raise exception 'Usuario nao encontrado';
  end if;

  update public.clientes
  set nome = trim(coalesce(p_nome, nome)),
      telefone = nullif(trim(coalesce(p_telefone, '')), '')
  where usuario_id = p_usuario_id
    and barbearia_id = v_barbearia_id;

  update public.barbeiros
  set nome = trim(coalesce(p_nome, nome)),
      telefone = nullif(trim(coalesce(p_telefone, '')), '')
  where usuario_id = p_usuario_id
    and barbearia_id = v_barbearia_id;

  return true;
end;
$$;

create or replace function public.definir_usuario_como_cliente(
  p_usuario_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.fn_is_admin() then
    raise exception 'Apenas admin pode definir cliente';
  end if;

  update public.usuarios
  set perfil = case when perfil = 'admin' then 'admin' else 'cliente' end
  where id = p_usuario_id
    and barbearia_id = public.fn_minha_barbearia_id();

  if not found then
    raise exception 'Usuario nao encontrado';
  end if;

  return true;
end;
$$;

create or replace function public.definir_usuario_como_barbeiro(
  p_usuario_id uuid,
  p_nome text,
  p_telefone text default null,
  p_comissao numeric default 40
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia_id bigint := public.fn_minha_barbearia_id();
  v_barbeiro_id uuid;
begin
  if not public.fn_is_admin() then
    raise exception 'Apenas admin pode definir barbeiro';
  end if;

  update public.usuarios
  set perfil = case when perfil = 'admin' then 'admin' else 'barbeiro' end,
      nome = coalesce(nullif(trim(coalesce(p_nome, '')), ''), nome),
      telefone = coalesce(nullif(trim(coalesce(p_telefone, '')), ''), telefone)
  where id = p_usuario_id
    and barbearia_id = v_barbearia_id;

  if not found then
    raise exception 'Usuario nao encontrado';
  end if;

  insert into public.barbeiros (
    barbearia_id,
    usuario_id,
    nome,
    telefone,
    comissao_percentual
  )
  values (
    v_barbearia_id,
    p_usuario_id,
    coalesce(nullif(trim(coalesce(p_nome, '')), ''), 'Barbeiro'),
    nullif(trim(coalesce(p_telefone, '')), ''),
    coalesce(p_comissao, 40)
  )
  on conflict (usuario_id) do update
    set nome = excluded.nome,
        telefone = coalesce(excluded.telefone, public.barbeiros.telefone),
        comissao_percentual = excluded.comissao_percentual,
        ativo = true
  returning id into v_barbeiro_id;

  return v_barbeiro_id;
end;
$$;

create or replace function public.admin_definir_senha_usuario(
  p_usuario_id uuid,
  p_nova_senha text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_senha text;
begin
  if not public.fn_is_admin() then
    raise exception 'Apenas admin pode alterar senhas';
  end if;

  v_senha := coalesce(p_nova_senha, '');
  if length(v_senha) < 6 then
    raise exception 'A senha deve ter no minimo 6 caracteres';
  end if;

  if not exists (
    select 1
    from public.usuarios u
    where u.id = p_usuario_id
      and u.barbearia_id = public.fn_minha_barbearia_id()
  ) then
    raise exception 'Usuario nao encontrado';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(v_senha, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_usuario_id;

  if not found then
    raise exception 'Usuario de autenticacao nao encontrado';
  end if;

  return true;
end;
$$;

create or replace function public.dashboard_admin_resumo(
  p_inicio date,
  p_fim date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia_id bigint := public.fn_minha_barbearia_id();
  v_result jsonb;
begin
  if not public.fn_is_admin() then
    raise exception 'Apenas admin pode acessar o dashboard';
  end if;

  with ag as (
    select a.data, a.status
    from public.agendamentos a
    where a.barbearia_id = v_barbearia_id
      and a.data between p_inicio and p_fim
  ),
  fin as (
    select
      f.data,
      f.valor_servico,
      f.comissao_barbeiro,
      f.status_pagamento,
      coalesce(b.nome, 'Sem nome') as barbeiro
    from public.financeiro f
    left join public.barbeiros b on b.id = f.barbeiro_id
    where f.barbearia_id = v_barbearia_id
      and f.data between p_inicio and p_fim
  ),
  desp as (
    select d.data, d.valor
    from public.despesas d
    where d.barbearia_id = v_barbearia_id
      and d.data between p_inicio and p_fim
  ),
  contas as (
    select coalesce(sum(c.valor), 0) as total
    from public.contas_receber_manuais c
    where c.barbearia_id = v_barbearia_id
      and c.status = 'pendente'
      and c.data between p_inicio and p_fim
  ),
  ranking as (
    select f.barbeiro as nome, sum(f.valor_servico) as total
    from fin f
    where f.status_pagamento = 'pago'
    group by f.barbeiro
    order by total desc
    limit 6
  ),
  serie as (
    select
      f.data,
      sum(case when f.status_pagamento = 'pago' then f.valor_servico else 0 end) as receita,
      sum(case when f.status_pagamento = 'pago' then f.comissao_barbeiro else 0 end) as comissao
    from fin f
    group by f.data
  )
  select jsonb_build_object(
    'totalFaturado', coalesce((select sum(valor_servico) from fin where status_pagamento = 'pago'), 0),
    'atendimentos', coalesce((select count(*) from ag where status = 'concluido'), 0),
    'agendamentos', coalesce((select count(*) from ag where status in ('agendado', 'em_atendimento')), 0),
    'cancelados', coalesce((select count(*) from ag where status in ('cancelado', 'desistencia_cliente')), 0),
    'topBarbeiro', coalesce((select jsonb_build_object('nome', nome, 'total', total) from ranking limit 1), 'null'::jsonb),
    'contasReceber', coalesce((select sum(valor_servico) from fin where status_pagamento = 'pendente'), 0) + coalesce((select total from contas), 0),
    'despesas', coalesce((select sum(valor) from desp), 0),
    'comissoes', coalesce((select sum(comissao_barbeiro) from fin where status_pagamento = 'pago'), 0),
    'liquido', coalesce((select sum(valor_servico - comissao_barbeiro) from fin where status_pagamento = 'pago'), 0) - coalesce((select sum(valor) from desp), 0),
    'series', coalesce((select jsonb_agg(jsonb_build_object('data', s.data, 'receita', s.receita, 'comissao', s.comissao, 'liquido', s.receita - s.comissao) order by s.data) from serie s), '[]'::jsonb),
    'ranking', coalesce((select jsonb_agg(jsonb_build_object('nome', r.nome, 'total', r.total) order by r.total desc) from ranking r), '[]'::jsonb)
  )
  into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create or replace function public.atualizar_agendamentos_atrasados()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd integer;
begin
  update public.agendamentos a
  set status = 'concluido'
  where a.status in ('agendado', 'em_atendimento')
    and (a.data::timestamp + a.hora_fim) < now();

  get diagnostics v_qtd = row_count;
  return coalesce(v_qtd, 0);
end;
$$;

-- =========================================================
-- INDICES
-- =========================================================

create index idx_usuarios_barbearia on public.usuarios(barbearia_id, perfil);
create index idx_clientes_barbearia on public.clientes(barbearia_id, nome);
create index idx_clientes_usuario on public.clientes(usuario_id);
create index idx_barbeiros_barbearia on public.barbeiros(barbearia_id, nome);
create index idx_servicos_barbearia on public.servicos(barbearia_id, nome);
create index idx_barbeiro_horarios_barbearia on public.barbeiro_horarios(barbearia_id, barbeiro_id, dia_semana);
create index idx_agendamentos_barbearia_data on public.agendamentos(barbearia_id, data);
create index idx_agendamentos_barbeiro_data on public.agendamentos(barbearia_id, barbeiro_id, data);
create index idx_agendamentos_cliente_data on public.agendamentos(barbearia_id, cliente_id, data);
create index idx_financeiro_barbearia_data on public.financeiro(barbearia_id, data);
create index idx_comissoes_barbearia_data on public.comissoes(barbearia_id, barbeiro_id, data);
create index idx_despesas_barbearia_data on public.despesas(barbearia_id, data);
create index idx_contas_barbearia_data on public.contas_receber_manuais(barbearia_id, data);

-- =========================================================
-- RLS
-- =========================================================

alter table public.usuarios enable row level security;
alter table public.clientes enable row level security;
alter table public.barbeiros enable row level security;
alter table public.servicos enable row level security;
alter table public.barbeiro_horarios enable row level security;
alter table public.configuracao_agenda enable row level security;
alter table public.agendamentos enable row level security;
alter table public.financeiro enable row level security;
alter table public.receitas_manuais enable row level security;
alter table public.contas_receber_manuais enable row level security;
alter table public.categorias_despesa enable row level security;
alter table public.despesas enable row level security;
alter table public.comissoes enable row level security;
alter table public.loja_horarios_data enable row level security;
alter table public.loja_dias_fechados enable row level security;

create policy usuarios_select on public.usuarios
for select
using (
  id = auth.uid()
  or public.fn_admin_mesma_barbearia(barbearia_id)
);

create policy usuarios_update on public.usuarios
for update
using (
  id = auth.uid()
  or public.fn_admin_mesma_barbearia(barbearia_id)
)
with check (
  id = auth.uid()
  or public.fn_admin_mesma_barbearia(barbearia_id)
);

create policy clientes_select on public.clientes
for select
using (
  usuario_id = auth.uid()
  or public.fn_staff_mesma_barbearia(barbearia_id)
);

create policy clientes_write_admin on public.clientes
for all
using (public.fn_admin_mesma_barbearia(barbearia_id))
with check (public.fn_admin_mesma_barbearia(barbearia_id));

create policy barbeiros_select on public.barbeiros
for select
using (
  usuario_id = auth.uid()
  or public.fn_staff_mesma_barbearia(barbearia_id)
);

create policy barbeiros_admin_write on public.barbeiros
for all
using (public.fn_admin_mesma_barbearia(barbearia_id))
with check (public.fn_admin_mesma_barbearia(barbearia_id));

create policy servicos_select_staff on public.servicos
for select
using (public.fn_staff_mesma_barbearia(barbearia_id));

create policy servicos_admin_write on public.servicos
for all
using (public.fn_admin_mesma_barbearia(barbearia_id))
with check (public.fn_admin_mesma_barbearia(barbearia_id));

create policy horarios_select_staff on public.barbeiro_horarios
for select
using (
  public.fn_admin_mesma_barbearia(barbearia_id)
  or (public.fn_is_barbeiro() and barbeiro_id = public.fn_meu_barbeiro_id())
);

create policy horarios_write_staff on public.barbeiro_horarios
for all
using (
  public.fn_admin_mesma_barbearia(barbearia_id)
  or (public.fn_is_barbeiro() and barbeiro_id = public.fn_meu_barbeiro_id())
)
with check (
  public.fn_admin_mesma_barbearia(barbearia_id)
  or (public.fn_is_barbeiro() and barbeiro_id = public.fn_meu_barbeiro_id())
);

create policy config_select_staff on public.configuracao_agenda
for select
using (public.fn_staff_mesma_barbearia(barbearia_id));

create policy config_admin_write on public.configuracao_agenda
for all
using (public.fn_admin_mesma_barbearia(barbearia_id))
with check (public.fn_admin_mesma_barbearia(barbearia_id));

create policy agendamentos_select on public.agendamentos
for select
using (
  public.fn_admin_mesma_barbearia(barbearia_id)
  or (public.fn_is_barbeiro() and barbeiro_id = public.fn_meu_barbeiro_id())
  or exists (
    select 1
    from public.clientes c
    where c.id = cliente_id
      and c.usuario_id = auth.uid()
  )
);

create policy agendamentos_update_staff on public.agendamentos
for update
using (
  public.fn_admin_mesma_barbearia(barbearia_id)
  or (public.fn_is_barbeiro() and barbeiro_id = public.fn_meu_barbeiro_id())
)
with check (
  public.fn_admin_mesma_barbearia(barbearia_id)
  or (public.fn_is_barbeiro() and barbeiro_id = public.fn_meu_barbeiro_id())
);

create policy financeiro_select on public.financeiro
for select
using (
  public.fn_admin_mesma_barbearia(barbearia_id)
  or (public.fn_is_barbeiro() and barbeiro_id = public.fn_meu_barbeiro_id())
);

create policy financeiro_update on public.financeiro
for update
using (
  public.fn_admin_mesma_barbearia(barbearia_id)
  or (public.fn_is_barbeiro() and barbeiro_id = public.fn_meu_barbeiro_id())
)
with check (
  public.fn_admin_mesma_barbearia(barbearia_id)
  or (public.fn_is_barbeiro() and barbeiro_id = public.fn_meu_barbeiro_id())
);

create policy categorias_select_staff on public.categorias_despesa
for select
using (public.fn_staff_mesma_barbearia(barbearia_id));

create policy categorias_admin_write on public.categorias_despesa
for all
using (public.fn_admin_mesma_barbearia(barbearia_id))
with check (public.fn_admin_mesma_barbearia(barbearia_id));

create policy despesas_select_staff on public.despesas
for select
using (public.fn_staff_mesma_barbearia(barbearia_id));

create policy despesas_admin_write on public.despesas
for all
using (public.fn_admin_mesma_barbearia(barbearia_id))
with check (public.fn_admin_mesma_barbearia(barbearia_id));

create policy contas_select_staff on public.contas_receber_manuais
for select
using (public.fn_staff_mesma_barbearia(barbearia_id));

create policy contas_admin_write on public.contas_receber_manuais
for all
using (public.fn_admin_mesma_barbearia(barbearia_id))
with check (public.fn_admin_mesma_barbearia(barbearia_id));

create policy receitas_select_staff on public.receitas_manuais
for select
using (public.fn_staff_mesma_barbearia(barbearia_id));

create policy receitas_admin_write on public.receitas_manuais
for all
using (public.fn_admin_mesma_barbearia(barbearia_id))
with check (public.fn_admin_mesma_barbearia(barbearia_id));

create policy comissoes_select on public.comissoes
for select
using (
  public.fn_admin_mesma_barbearia(barbearia_id)
  or (public.fn_is_barbeiro() and barbeiro_id = public.fn_meu_barbeiro_id())
);

create policy comissoes_admin_write on public.comissoes
for all
using (public.fn_admin_mesma_barbearia(barbearia_id))
with check (public.fn_admin_mesma_barbearia(barbearia_id));

create policy loja_data_staff on public.loja_horarios_data
for all
using (public.fn_admin_mesma_barbearia(barbearia_id))
with check (public.fn_admin_mesma_barbearia(barbearia_id));

create policy loja_fechado_staff on public.loja_dias_fechados
for all
using (public.fn_admin_mesma_barbearia(barbearia_id))
with check (public.fn_admin_mesma_barbearia(barbearia_id));

-- =========================================================
-- GRANTS E SEED
-- =========================================================

grant usage on schema public to anon, authenticated;
grant select on public.barbearias to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.listar_barbeiros_publico() to anon, authenticated;
grant execute on function public.listar_servicos_publico() to anon, authenticated;
grant execute on function public.obter_configuracao_agenda_publica() to anon, authenticated;
grant execute on function public.garantir_cliente_auth(text, text, text) to authenticated;
grant execute on function public.registrar_cliente_auth(text, text, text) to authenticated;
grant execute on function public.obter_cliente_auth() to authenticated;
grant execute on function public.horarios_disponiveis_cliente(date, uuid, uuid) to anon, authenticated;
grant execute on function public.criar_agendamento_publico(uuid, text, text, uuid, uuid, date, time, boolean) to anon, authenticated;
grant execute on function public.criar_agendamento_cliente_auth(uuid, uuid, date, time) to authenticated;
grant execute on function public.listar_meus_agendamentos() to authenticated;
grant execute on function public.cancelar_agendamento_cliente(uuid) to authenticated;
grant execute on function public.listar_clientes_agendamento_barbeiro(text) to authenticated;
grant execute on function public.criar_agendamento_manual_barbeiro(uuid, uuid, uuid, date, time) to authenticated;
grant execute on function public.listar_usuarios_cadastro_admin() to authenticated;
grant execute on function public.admin_atualizar_usuario_cadastro(uuid, text, text, text, date) to authenticated;
grant execute on function public.definir_usuario_como_cliente(uuid) to authenticated;
grant execute on function public.definir_usuario_como_barbeiro(uuid, text, text, numeric) to authenticated;
grant execute on function public.admin_definir_senha_usuario(uuid, text) to authenticated;
grant execute on function public.dashboard_admin_resumo(date, date) to authenticated;
grant execute on function public.atualizar_agendamentos_atrasados() to authenticated;

insert into public.barbearias (id, nome, slug)
values (1, 'Barberia D''sousa', 'barberia-dsousa')
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
  1,
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
