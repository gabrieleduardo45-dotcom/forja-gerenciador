-- FORJA · Central de comando: conversas com agentes e fila de propostas (aprovação humana).
-- Aplicada no projeto forja-proprio em 2026-11-16. Só adiciona; não altera tabelas existentes.
-- Regra: agente nunca executa nada fora do banco nem fala com cliente. Ele propõe; Gabriel aprova.

create table public.agente_conversas (
  id            uuid primary key default gen_random_uuid(),
  agente        text not null references public.agentes(codigo),
  titulo        text not null default 'Conversa',
  mensagens     jsonb not null default '[]'::jsonb,
  autor_email   text not null default coalesce(auth.jwt()->>'email',''),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index agente_conversas_agente_idx on public.agente_conversas (agente, atualizado_em desc);

create table public.propostas (
  id            bigint generated always as identity primary key,
  criado_em     timestamptz not null default now(),
  agente        text not null references public.agentes(codigo),
  tipo          text not null check (tipo in ('tarefa','mensagem','decisao','alerta','atualizacao')),
  prioridade    text not null default 'media' check (prioridade in ('alta','media','baixa')),
  titulo        text not null,
  detalhe       text,
  alvo          text,
  payload       jsonb not null default '{}'::jsonb,
  prazo         date,
  status        text not null default 'pendente' check (status in ('pendente','aprovada','descartada','feita')),
  decidido_em   timestamptz,
  decidido_por  text,
  nota_decisao  text,
  conversa_id   uuid references public.agente_conversas(id) on delete set null
);
create index propostas_status_idx on public.propostas (status, criado_em desc);

alter table public.agente_conversas enable row level security;
alter table public.propostas enable row level security;
create policy membro_tudo on public.agente_conversas for all to authenticated using (eh_membro()) with check (eh_membro());
create policy membro_tudo on public.propostas for all to authenticated using (eh_membro()) with check (eh_membro());

create view public.v_propostas_resumo with (security_invoker = true) as
select a.codigo, a.nome, a.frente,
  count(p.*) filter (where p.status = 'pendente') as pendentes,
  count(p.*) filter (where p.status = 'aprovada') as aprovadas,
  count(p.*) filter (where p.status = 'feita') as feitas,
  count(p.*) filter (where p.status = 'descartada') as descartadas,
  max(p.criado_em) as ultima
from public.agentes a left join public.propostas p on p.agente = a.codigo
group by a.codigo, a.nome, a.frente;
