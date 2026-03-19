-- =========================================================
-- FIX: ATUALIZAR STATUS DE PAGAMENTO VIA RPC
-- Evita violacao de RLS ao lancar servico como "a receber"
-- ou marcar conta como recebida.
-- =========================================================

begin;

create or replace function public.atualizar_status_pagamento_financeiro(
  p_financeiro_id uuid,
  p_agendamento_id uuid default null,
  p_status_pagamento text default 'pago',
  p_barbearia_id bigint default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia_id bigint := coalesce(p_barbearia_id, public.fn_minha_barbearia_id());
  v_is_admin boolean := public.fn_admin_mesma_barbearia(v_barbearia_id);
  v_meu_barbeiro_id uuid := public.fn_meu_barbeiro_id();
  v_is_barbeiro boolean := public.fn_is_barbeiro() and v_meu_barbeiro_id is not null;
  v_rows integer;
begin
  if p_financeiro_id is null then
    raise exception 'Lancamento financeiro invalido';
  end if;

  if p_status_pagamento not in ('pago', 'pendente') then
    raise exception 'Status de pagamento invalido';
  end if;

  if not v_is_admin and not v_is_barbeiro then
    raise exception 'Usuario sem permissao para alterar pagamento';
  end if;

  if p_agendamento_id is not null then
    update public.agendamentos a
    set pagamento_status = p_status_pagamento,
        pagamento_pendente = (p_status_pagamento = 'pendente')
    where a.id = p_agendamento_id
      and a.barbearia_id = v_barbearia_id
      and (
        v_is_admin
        or a.barbeiro_id = v_meu_barbeiro_id
      );

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'Agendamento vinculado nao foi encontrado para atualizar o pagamento.';
    end if;
  end if;

  update public.financeiro f
  set status_pagamento = p_status_pagamento
  where f.id = p_financeiro_id
    and f.barbearia_id = v_barbearia_id
    and (
      v_is_admin
      or f.barbeiro_id = v_meu_barbeiro_id
    );

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Lancamento financeiro nao foi encontrado.';
  end if;
end;
$$;

grant execute on function public.atualizar_status_pagamento_financeiro(uuid, uuid, text, bigint) to authenticated;

commit;
