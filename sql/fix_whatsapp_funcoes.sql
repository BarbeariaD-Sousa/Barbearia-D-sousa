-- =========================================================
-- FIX INCREMENTAL - WHATSAPP
-- Nao apaga tabelas nem dados
-- Atualiza apenas funcoes usadas pelo frontend
-- =========================================================

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
  select
    b.id,
    b.nome,
    coalesce(nullif(b.telefone, ''), u.telefone) as telefone
  from public.barbeiros b
  left join public.usuarios u on u.id = b.usuario_id
  where b.barbearia_id = coalesce(p_barbearia_id, public.fn_barbearia_publica_id())
    and coalesce(b.ativo, true) = true
    and coalesce(u.perfil, 'barbeiro') <> 'admin'
  order by b.nome;
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
      or lower(coalesce(u.email, '')) like '%' || lower(p_busca) || '%'
      or lower(coalesce(u.telefone, '')) like '%' || lower(p_busca) || '%'
      or lower(coalesce(c.telefone, '')) like '%' || lower(p_busca) || '%'
    )
  order by coalesce(c.nome, u.nome);
$$;

grant execute on function public.listar_barbeiros_publico(bigint) to anon, authenticated;
grant execute on function public.listar_meus_agendamentos(bigint) to authenticated;
grant execute on function public.listar_clientes_agendamento_barbeiro(text) to authenticated;
