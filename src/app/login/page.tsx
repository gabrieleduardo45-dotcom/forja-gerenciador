"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";
import { classeBotao } from "@/components/ui";

export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setMsg(null);
    const { error } = await supabaseNavegador().auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) return setMsg(error.message === "Invalid login credentials" ? "E-mail ou senha errados." : error.message);
    r.replace("/");
    r.refresh();
  }

  async function link() {
    if (!email) return setMsg("Digite o e-mail primeiro.");
    setCarregando(true);
    const { error } = await supabaseNavegador().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/auth/confirmar` },
    });
    setCarregando(false);
    setMsg(error ? error.message : "Mandei um link de acesso para o seu e-mail.");
  }

  const campo = "w-full rounded-md border border-linha bg-painel-2 px-3 py-2.5 text-base outline-none focus:border-brasa";
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-brasa text-lg font-bold text-sobre-brasa">F</div>
          <div>
            <h1 className="text-xl font-semibold">Forja</h1>
            <p className="text-sm text-suave">Central de comando</p>
          </div>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm text-suave">E-mail</span>
          <input className={campo} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm text-suave">Senha</span>
          <input className={campo} type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </label>
        {msg && <p className="text-sm text-atencao">{msg}</p>}
        <button disabled={carregando} className={`${classeBotao()} w-full py-2.5`}>{carregando ? "Entrando…" : "Entrar"}</button>
        <button type="button" onClick={link} className={`${classeBotao("fantasma")} w-full`}>Esqueci a senha: me mande um link</button>
      </form>
    </main>
  );
}
