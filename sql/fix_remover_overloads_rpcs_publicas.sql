-- =========================================================
-- FIX: REMOVER OVERLOADS ANTIGOS DAS RPCS
-- Evita erro "Could not choose the best candidate function"
-- no Supabase/PostgREST.
-- =========================================================

begin;

drop function if exists public.listar_barbeiros_publico();
drop function if exists public.listar_servicos_publico();
drop function if exists public.obter_configuracao_agenda_publica();
drop function if exists public.obter_cliente_auth();
drop function if exists public.listar_meus_agendamentos();

drop function if exists public.horarios_disponiveis_cliente(date, uuid, uuid);
drop function if exists public.garantir_cliente_auth(text, text, text);
drop function if exists public.registrar_cliente_auth(text, text, text);
drop function if exists public.criar_agendamento_cliente_auth(uuid, uuid, date, time);
drop function if exists public.cancelar_agendamento_cliente(uuid);
drop function if exists public.criar_agendamento_publico(uuid, text, text, uuid, uuid, date, time, boolean);

commit;
