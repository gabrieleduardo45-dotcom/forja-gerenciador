-- Sobra e descarte das cozinhas, lançados por foto (a IA lê a foto e a balança; o Gabriel confere).
create table if not exists public.desperdicio (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  data date not null default (now() at time zone 'America/Manaus')::date,
  casa_os_id text,
  casa_nome text not null,
  item text not null,
  tipo text not null check (tipo in ('sobra','descarte')),
  peso_kg numeric(8,3),
  peso_fonte text check (peso_fonte in ('balanca','estimado','informado')),
  motivo text,
  foto text,
  confianca numeric(3,2),
  obs text,
  origem text not null default 'app' check (origem in ('app','whatsapp','telegram')),
  autor_email text default (auth.jwt() ->> 'email')
);
create index if not exists desperdicio_casa_data on public.desperdicio (casa_nome, data desc);
alter table public.desperdicio enable row level security;
drop policy if exists membro_tudo on public.desperdicio;
create policy membro_tudo on public.desperdicio for all to authenticated using (eh_membro()) with check (eh_membro());

create or replace view public.v_desperdicio_semana with (security_invoker = true) as
select casa_nome, date_trunc('week', data)::date as semana, tipo,
       count(*) as registros, round(sum(coalesce(peso_kg,0)),2) as kg
from public.desperdicio group by 1,2,3;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('desperdicio', 'desperdicio', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists desperdicio_membro on storage.objects;
create policy desperdicio_membro on storage.objects for all to authenticated
  using (bucket_id = 'desperdicio' and public.eh_membro())
  with check (bucket_id = 'desperdicio' and public.eh_membro());
