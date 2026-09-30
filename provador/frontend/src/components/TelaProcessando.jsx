import { useEffect, useState } from "react";

const MENSAGENS = [
  "A preparar a sua peça…",
  "A vestir você digitalmente, aguarde…",
  "O consultor de IA está a escrever a sua justificativa…",
  "Ajustando caimento e acabamento final…",
  "Quase pronto, só mais um instante…",
];

export default function TelaProcessando() {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setIndice((i) => (i + 1) % MENSAGENS.length);
    }, 3200);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-brass-dim" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-brass animate-spin" />
        <div className="absolute inset-3 rounded-full bg-navy-light" />
      </div>

      <p className="font-display italic text-lg text-ivory min-h-[3.5rem] px-6 transition-opacity duration-500">
        {MENSAGENS[indice]}
      </p>

      <p className="text-xs text-ivory-dim font-sans">
        Isto pode levar até um minuto — a magia da alfaiataria digital não é instantânea.
      </p>
    </div>
  );
}
