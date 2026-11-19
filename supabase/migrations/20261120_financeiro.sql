-- Financeiro da Forja: o extrato do banco entra aqui (entradas e saídas), cada linha com uma categoria.
-- DRE: receita vem de recebimentos (competência); custos e despesas vêm das saídas do extrato.
-- DFC: caixa real = todas as linhas do extrato.
create table if not exists public.lancamentos (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  data date not null,
  descricao text not null,
  valor numeric(12,2) not null,            -- + entrada, - saída
  categoria text not null default 'a_classificar',
  conta text,
  ref text unique,                          -- FITID do OFX ou hash da linha: evita importar duas vezes
  origem text not null default 'extrato' check (origem in ('extrato','manual')),
  confianca numeric(3,2),
  conferido boolean not null default false,
  obs text
);
create index if not exists lancamentos_data on public.lancamentos (data desc);
alter table public.lancamentos enable row level security;
drop policy if exists membro_tudo on public.lancamentos;
create policy membro_tudo on public.lancamentos for all to authenticated using (eh_membro()) with check (eh_membro());

create table if not exists public.parametros (
  chave text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.parametros enable row level security;
drop policy if exists membro_tudo on public.parametros;
create policy membro_tudo on public.parametros for all to authenticated using (eh_membro()) with check (eh_membro());
insert into public.parametros (chave, valor) values
  ('regime', 'simples_nacional'),
  ('aliquota_simples', '0.06'),
  ('saldo_inicial', '0'),
  ('saldo_inicial_data', to_char(date_trunc('month', now()), 'YYYY-MM-DD'))
on conflict (chave) do nothing;
