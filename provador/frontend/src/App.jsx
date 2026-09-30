import { useState } from "react";
import CameraCapture from "./components/CameraCapture";
import VitrineDePecas from "./components/VitrineDePecas";
import TelaProcessando from "./components/TelaProcessando";
import TelaResultado from "./components/TelaResultado";
import { enviarParaProvador } from "./services/api";

const ETAPAS = ["Foto", "Vitrine", "Provando", "Resultado"];

function base64ParaBlob(base64) {
  const [, dados] = base64.split(",");
  const binario = atob(dados);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: "image/jpeg" });
}

export default function App() {
  const [tela, setTela] = useState("camera"); // camera | vitrine | processando | resultado | erro
  const [fotoBase64, setFotoBase64] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);

  const etapaAtual = { camera: 0, vitrine: 1, processando: 2, resultado: 3, erro: 2 }[tela];

  function irParaVitrine() {
    if (!fotoBase64) return;
    setTela("vitrine");
  }

  async function lidarComSelecaoPeca(pecaSelecionada) {
    setTela("processando");
    setErro(null);
    try {
      const fotoBlob = base64ParaBlob(fotoBase64);
      const resposta = await enviarParaProvador({ fotoBlob, idPeca: pecaSelecionada.id });
      setResultado(resposta);
      setTela("resultado");
    } catch (e) {
      setErro(e.message);
      setTela("erro");
    }
  }

  function reiniciar() {
    setFotoBase64(null);
    setResultado(null);
    setErro(null);
    setTela("camera");
  }

  return (
    <div className="min-h-screen textura-tecido flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-navy rounded-sm border border-brass-dim shadow-2xl overflow-hidden">
        <header className="px-6 pt-6 pb-4 border-b border-brass-dim/40 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-ivory leading-tight">Provador Virtual</h1>
            <p className="text-xs text-ivory-dim font-sans">Alfaiataria assistida por IA</p>
          </div>
          <TrenaDeProgresso passoAtual={etapaAtual} />
        </header>

        <main className="px-6 py-6">
          {tela === "camera" && (
            <div className="flex flex-col gap-5">
              <CameraCapture onFotoCapturada={setFotoBase64} />
              <button
                type="button"
                onClick={irParaVitrine}
                disabled={!fotoBase64}
                className="w-full py-3 rounded-sm bg-brass text-charcoal font-sans font-semibold tracking-wide disabled:opacity-40 hover:bg-ivory transition-colors"
              >
                Continuar
              </button>
            </div>
          )}

          {tela === "vitrine" && <VitrineDePecas onSelecionarPeca={lidarComSelecaoPeca} />}

          {tela === "processando" && <TelaProcessando />}

          {tela === "resultado" && resultado && (
            <TelaResultado resultado={resultado} onReiniciar={reiniciar} />
          )}

          {tela === "erro" && (
            <div className="flex flex-col gap-4 text-center py-8">
              <p className="font-display text-lg text-thread">Não foi possível gerar o seu look</p>
              <p className="text-sm text-ivory-dim font-sans">{erro}</p>
              <button
                onClick={reiniciar}
                className="mx-auto px-5 py-2 rounded-sm border border-brass text-brass font-sans text-sm hover:bg-brass hover:text-charcoal transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function TrenaDeProgresso({ passoAtual }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {ETAPAS.map((nome, i) => (
        <div key={nome} className="flex items-center gap-2">
          <span className={`text-[10px] font-sans ${i === passoAtual ? "text-brass" : "text-ivory-dim/50"}`}>
            {nome}
          </span>
          <span className={`w-1.5 h-1.5 rounded-full ${i <= passoAtual ? "bg-brass" : "bg-brass-dim/30"}`} />
        </div>
      ))}
    </div>
  );
}
