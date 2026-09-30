import { useEffect, useState } from "react";
import { buscarEstoque, API_URL } from "../services/api";

// Aceita tanto uma URL completa (ex: Unsplash, CDN) quanto um caminho local
// (ex: "/pecas/paleto.jpg") vindo do backend, e sempre devolve algo que o
// navegador consegue carregar.
function resolverUrlImagem(url) {
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `${API_URL}${url}`;
}

// A simulação para o evento não trabalha com tamanho — variações que só
// diferem por essa dimensão viram um único card na vitrine.
function deduplicarPorModelo(estoque) {
  const vistos = new Set();
  return estoque.filter((peca) => {
    const chave = `${peca.modelo_nome}|${peca.cor}|${peca.categoria}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export default function VitrineDePecas({ onSelecionarPeca }) {
  const [pecas, setPecas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    buscarEstoque()
      .then((estoque) => setPecas(deduplicarPorModelo(estoque)))
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] rounded-sm bg-navy-light animate-pulse" />
        ))}
      </div>
    );
  }

  if (erro) {
    return <p className="text-center text-thread font-sans text-sm py-10">{erro}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="font-display italic text-ivory text-center">
        Toque na peça que quer experimentar
      </p>

      <div className="grid grid-cols-2 gap-3">
        {pecas.map((peca) => (
          <button
            key={peca.id}
            type="button"
            onClick={() => onSelecionarPeca(peca)}
            className="group relative aspect-[3/4] overflow-hidden rounded-sm border border-brass-dim/70 bg-navy-light text-left transition-all hover:border-brass hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40"
          >
            <img
              src={resolverUrlImagem(peca.url_foto_da_peca)}
              alt={peca.modelo_nome}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />

            {/* véu escuro de baixo pra cima, pro texto ficar legível sobre a foto */}
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/25 to-transparent" />

            <span className="absolute top-2 left-2 rounded-sm bg-charcoal/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-brass backdrop-blur-sm">
              {peca.categoria}
            </span>

            <div className="absolute inset-x-0 bottom-0 p-2.5 flex flex-col gap-0.5">
              <span className="text-sm font-display leading-tight text-ivory drop-shadow">
                {peca.modelo_nome}
              </span>
              <span className="text-[11px] text-ivory-dim">
                {peca.cor}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
