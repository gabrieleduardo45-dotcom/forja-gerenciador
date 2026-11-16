-- Aplicada no forja-proprio em 2026-11-16.
-- Fecha uma implantação de uma vez: casa + contrato + oportunidade ganha + prospect no estágio certo.
-- security invoker: roda com o login de quem chamou, então o RLS (eh_membro / eh_dono) continua valendo.
create or replace function public.fechar_implantacao(
  p_prospect_id bigint,
  p_produto text,
  p_valor numeric,
  p_condicao text default 'fundadora',
  p_meses integer default null,
  p_inicio date default current_date,
  p_forma_pagamento text default null,
  p_unidade text default 'avulso',
  p_frentes text[] default '{}'
) returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_p prospects%rowtype;
  v_casa_id bigint;
  v_codigo text;
  v_n int;
  v_opp bigint;
begin
  select * into v_p from prospects where id = p_prospect_id;
  if not found then raise exception 'Prospect % não existe', p_prospect_id; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Valor precisa ser maior que zero'; end if;

  if v_p.casa_id is not null then
    v_casa_id := v_p.casa_id;
    update casas set status = 'ativa', inicio = coalesce(inicio, p_inicio) where id = v_casa_id returning codigo into v_codigo;
  else
    select coalesce(max((regexp_match(codigo, '^C-(\d+)$'))[1]::int), 0) + 1 into v_n from casas;
    v_codigo := 'C-' || lpad(v_n::text, 3, '0');
    insert into casas (codigo, nome, setor, cidade, status, fundadora, frentes, inicio)
    values (v_codigo, v_p.nome_casa, v_p.setor, 'Manaus', 'ativa', p_condicao = 'fundadora', p_frentes, p_inicio)
    returning id into v_casa_id;
  end if;

  insert into contratos (casa_id, produto, valor, unidade, forma_pagamento, inicio, meses, status)
  values (v_casa_id, p_produto, p_valor, p_unidade, p_forma_pagamento, p_inicio, p_meses, 'ativo');

  select id into v_opp from oportunidades where prospect_id = p_prospect_id and status = 'aberta' order by criado_em desc limit 1;
  if v_opp is not null then
    update oportunidades set status = 'ganha', valor_fechado = p_valor, data_fechamento = current_date, casa_id = v_casa_id where id = v_opp;
  else
    insert into oportunidades (prospect_id, casa_id, produto, valor_tabela, condicao, valor_fechado, data_proposta, data_fechamento, status)
    values (p_prospect_id, v_casa_id, p_produto, p_valor, p_condicao, p_valor, current_date, current_date, 'ganha');
  end if;

  update prospects set estagio = 'implantacao_fechada', casa_id = v_casa_id where id = p_prospect_id;
  return v_codigo;
end $$;

revoke execute on function public.fechar_implantacao(bigint,text,numeric,text,integer,date,text,text,text[]) from public, anon;
grant execute on function public.fechar_implantacao(bigint,text,numeric,text,integer,date,text,text,text[]) to authenticated;
