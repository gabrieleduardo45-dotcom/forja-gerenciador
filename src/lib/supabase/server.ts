import { createServerClient } from "@supabase/ssr";
import { createClient as createAdmin, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
/** Esquema das tabelas da gestão. No forja-proprio é "public"; no banco único (forja-os) é "gestao". */
const SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public";

/** Cliente com a sessão de quem está logado. Toda leitura passa pelo RLS (eh_membro / eh_dono). */
export async function supabaseServidor() {
  const jar = await cookies();
  return createServerClient(URL, KEY, {
    db: { schema: SCHEMA },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          /* chamado de Server Component: o proxy renova a sessão */
        }
      },
    },
  }) as unknown as SupabaseClient;
}

/** Cliente de serviço: só para a rodada agendada (cron), sem usuário. Ignora RLS. */
export function supabaseServico() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) return null;
  return createAdmin(URL, k, { db: { schema: SCHEMA }, auth: { persistSession: false } }) as unknown as SupabaseClient;
}

/**
 * Cliente da rodada automática. Preferência: entrar como o usuário robô da Forja (FORJA_ROBO_EMAIL/SENHA),
 * que é membro e passa pelo RLS como qualquer pessoa. A chave de serviço fica só como alternativa.
 */
export async function supabaseRobo() {
  const email = process.env.FORJA_ROBO_EMAIL;
  const senha = process.env.FORJA_ROBO_SENHA;
  if (email && senha) {
    const sb = createAdmin(URL, KEY, { db: { schema: SCHEMA }, auth: { persistSession: false, autoRefreshToken: false } }) as unknown as SupabaseClient;
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(`Robô não entrou: ${error.message}`);
    return sb;
  }
  return supabaseServico();
}

export async function usuarioAtual() {
  const sb = await supabaseServidor();
  const { data } = await sb.auth.getUser();
  return { sb, user: data.user };
}
