-- Catálogo: a tabela precos da Gestão é a fonte única; o FORJA OS copia via POST /api/integracao/catalogo.
alter table public.precos add column if not exists chave text unique;
alter table public.precos add column if not exists semanas int;
alter table public.precos add column if not exists visitas int;
alter table public.precos add column if not exists visitas_mes int;
alter table public.precos add column if not exists fichas_max int;
alter table public.precos add column if not exists grupo text check (grupo in ('principal','avulso','digital'));
-- Valores preenchidos em 20/11/2026 direto no banco (ids 1–17 + 'personalizado').
