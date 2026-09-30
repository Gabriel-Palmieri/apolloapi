export default function TelaResultado({ resultado, onReiniciar }) {
  const { imagemFinalUrl, peca } = resultado;
  const justificativa = peca?.justificativa;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-sm overflow-hidden border border-brass-dim">
        <img
          src={imagemFinalUrl}
          alt={`Look escolhido: ${peca?.modelo_nome ?? ""}`}
          className="w-full object-cover"
        />
      </div>

      <div className="flex flex-col gap-3 px-1">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl text-ivory">{peca?.modelo_nome}</h2>
          <span className="text-xs font-sans text-brass">{peca?.cor}</span>
        </div>

        {justificativa && (
          <blockquote className="font-display italic text-ivory-dim leading-relaxed border-l-2 border-brass pl-4">
            {justificativa}
          </blockquote>
        )}
      </div>

      <button
        type="button"
        onClick={onReiniciar}
        className="w-full py-3 rounded-sm border border-brass text-brass font-sans font-semibold tracking-wide hover:bg-brass hover:text-charcoal transition-colors"
      >
        Provar outro look
      </button>
    </div>
  );
}
