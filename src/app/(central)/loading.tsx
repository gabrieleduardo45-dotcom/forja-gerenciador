export default function Carregando() {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse px-4 pt-8 md:px-8">
      <div className="h-7 w-56 rounded bg-painel-2" />
      <div className="mt-2 h-4 w-40 rounded bg-painel-2" />
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-lg bg-painel" />)}
      </div>
      <div className="mt-6 h-64 rounded-lg bg-painel" />
    </div>
  );
}
