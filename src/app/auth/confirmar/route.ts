import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServidor } from "@/lib/supabase/server";

/** Volta do link mágico enviado por e-mail. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sb = await supabaseServidor();
  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  if (code) await sb.auth.exchangeCodeForSession(code);
  else if (token_hash && type) await sb.auth.verifyOtp({ token_hash, type });
  return NextResponse.redirect(new URL("/", req.url));
}
