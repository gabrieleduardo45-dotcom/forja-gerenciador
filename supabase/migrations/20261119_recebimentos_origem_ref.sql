-- Aplicada no forja-proprio em 2026-11-19.
-- Identificador da venda na plataforma de origem (ex.: transação da Hotmart). Único: reenvio do webhook não duplica.
alter table public.recebimentos add column if not exists origem_ref text;
create unique index if not exists recebimentos_origem_ref_uk on public.recebimentos (origem_ref) where origem_ref is not null;
