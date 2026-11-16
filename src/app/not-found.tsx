import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-lg font-semibold">Página não encontrada</p>
        <Link href="/" className="mt-4 inline-block text-sm text-brasa">Voltar para Hoje</Link>
      </div>
    </main>
  );
}
