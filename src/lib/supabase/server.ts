import { createServerClient } from "@supabase/ssr";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

/** Cliente com a sessão de quem está logado. Toda leitura passa pelo RLS (eh_membro / eh_dono). */
export async function supabaseServidor() {
  const jar = await cookies();
  return createServerClient(URL, KEY, {
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
  });
}

/** Cliente de serviço: só para a rodada agendada (cron), sem usuário. Ignora RLS. */
export function supabaseServico() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) return null;
  return createAdmin(URL, k, { auth: { persistSession: false } });
}

/**
 * Cliente da rodada automática. Preferência: entrar como o usuário robô da Forja (FORJA_ROBO_EMAIL/SENHA),
 * que é membro e passa pelo RLS como qualquer pessoa. A chave de serviço fica só como alternativa.
 */
export async function supabaseRobo() {
  const email = process.env.FORJA_ROBO_EMAIL;
  const senha = process.env.FORJA_ROBO_SENHA;
  if (email && senha) {
    const sb = createAdmin(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
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
