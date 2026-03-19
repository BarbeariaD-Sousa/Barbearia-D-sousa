-- =========================================================
-- FIX: AGENDAR SEM CADASTRO DEVE USAR A BARBEARIA ID 1
-- Afeta as RPCs publicas:
--   - listar_barbeiros_publico
--   - listar_servicos_publico
--   - obter_configuracao_agenda_publica
--   - horarios_disponiveis_cliente
--   - criar_agendamento_publico
-- =========================================================

begin;

insert into public.barbearias (id, nome, slug)
values (1, 'Barberia D''sousa', 'barberia-dsousa')
on conflict (id) do update
  set nome = excluded.nome,
      slug = excluded.slug,
      ativo = true;

create or replace function public.fn_barbearia_publica_id()
returns bigint
language sql
stable
as $$
  select 1::bigint;
$$;

commit;
