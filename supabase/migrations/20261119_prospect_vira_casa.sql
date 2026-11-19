-- Prospect que vira cliente (implantação fechada ou care ativo) ganha a casa sozinho, mesmo sem o botão "Fechar implantação".
create or replace function public.prospect_vira_casa() returns trigger
language plpgsql set search_path to 'public' as $$
declare v_n int; v_codigo text; v_id bigint;
begin
  if new.estagio in ('implantacao_fechada','care_ativo') and new.casa_id is null then
    select coalesce(max((regexp_match(codigo, '^C-(\d+)$'))[1]::int), 0) + 1 into v_n from casas;
    v_codigo := 'C-' || lpad(v_n::text, 3, '0');
    insert into casas (codigo, nome, setor, cidade, status, inicio)
    values (v_codigo, new.nome_casa, new.setor, 'Manaus', 'ativa', current_date)
    returning id into v_id;
    new.casa_id := v_id;
  end if;
  return new;
end $$;
drop trigger if exists prospect_vira_casa on public.prospects;
create trigger prospect_vira_casa before insert or update of estagio on public.prospects
for each row execute function public.prospect_vira_casa();
update public.prospects set estagio = estagio where estagio in ('implantacao_fechada','care_ativo') and casa_id is null;
