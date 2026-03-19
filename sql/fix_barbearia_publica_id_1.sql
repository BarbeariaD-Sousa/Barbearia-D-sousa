-- =========================================================
-- REPARO: GARANTIR CADASTRO PUBLICO NA BARBEARIA ID 1
-- Barberia D'sousa / slug: barberia-dsousa
-- =========================================================

begin;

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

create or replace function public.fn_barbearia_publica_id()
returns bigint
language sql
stable
as $$
  select 1::bigint;
$$;

commit;
