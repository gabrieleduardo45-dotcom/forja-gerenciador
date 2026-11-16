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

export async function usuarioAtual() {
  const sb = await supabaseServidor();
  const { data } = await sb.auth.getUser();
  return { sb, user: data.user };
}
