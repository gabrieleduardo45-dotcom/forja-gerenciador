-- Liga a casa da Gestão à casa do FORJA OS (id estável da integração).
alter table public.casas add column if not exists forja_os_id text unique;
