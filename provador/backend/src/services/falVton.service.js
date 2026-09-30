import { fal } from "@fal-ai/client";
import { env } from "../config/env.js";

fal.config({ credentials: env.falKey });

// Modelo de virtual try-on usado no fluxo. FASHN v1.6 foi escolhido por ser,
// hoje, o que melhor preserva padrões/estampas e detecta sozinho a
// categoria da peça (topo, calça, peça única), sem precisar de máscara
// manual — o que importa numa demo rápida de estande.
const MODELO_VTON = "fal-ai/fashn/tryon/v1.6";

/**
 * Garante que a Fal.ai consiga acessar a foto da peça:
 * - se já for uma URL http(s) (ex: Unsplash, CDN da loja), repassa direto.
 * - se for um caminho local (ex: "/pecas/xyz.jpg"), sobe pro storage da Fal.ai.
 */
async function resolverUrlDaPeca(urlFotoDaPeca) {
  if (/^https?:\/\//i.test(urlFotoDaPeca)) {
    return urlFotoDaPeca;
  }
  const urlPublicaLocal = `${env.backendBaseUrl}${urlFotoDaPeca}`;
  const respostaFetch = await fetch(urlPublicaLocal);
  if (!respostaFetch.ok) {
    throw new Error(`Não foi possível ler a foto da peça em ${urlPublicaLocal}`);
  }
  const blob = await respostaFetch.blob();
  return fal.storage.upload(blob);
}

/**
 * Sobe a foto do cliente (Buffer vindo do multer) para o storage da Fal.ai,
 * necessário porque o modelo espera uma URL, não um base64/Buffer direto.
 */
async function resolverUrlDoCliente(fotoBuffer, mimeType) {
  const blob = new Blob([fotoBuffer], { type: mimeType });
  return fal.storage.upload(blob);
}

/**
 * Extrai a URL da imagem gerada, cobrindo os formatos de resposta mais
 * comuns dos modelos de imagem da Fal.ai (alguns devolvem "images: []",
 * outros "image: {}").
 */
function extrairUrlDaImagem(resultado) {
  return (
    resultado?.data?.images?.[0]?.url ??
    resultado?.data?.image?.url ??
    null
  );
}

/**
 * Chama o FASHN v1.6 (via Fal.ai): veste a peça escolhida na foto original
 * do cliente, preservando rosto, corpo e fundo.
 */
export async function gerarImagemVestida({ fotoBuffer, mimeType, peca }) {
  const [urlFotoCliente, urlFotoPeca] = await Promise.all([
    resolverUrlDoCliente(fotoBuffer, mimeType),
    resolverUrlDaPeca(peca.url_foto_da_peca),
  ]);

  let resultado;
  try {
    resultado = await fal.subscribe(MODELO_VTON, {
      input: {
        model_image: urlFotoCliente,
        garment_image: urlFotoPeca,
        mode: "balanced", // performance | balanced | quality — equilíbrio entre velocidade e nitidez
      },
      logs: false,
    });
  } catch (err) {
    // O @fal-ai/client costuma anexar o corpo da resposta de erro em err.body,
    // que é onde a Fal.ai explica QUAL campo/validação falhou. Sem isso, só
    // sobra o texto genérico do status HTTP (ex: "Unprocessable Entity").
    const detalhe = err?.body ?? null;
    console.error("[fal.ai] erro bruto:", detalhe ? JSON.stringify(detalhe) : err.message);

    const mensagensDeValidacao = detalhe?.detail?.map((d) => d.msg) ?? [];

    // Caso mais comum no estande: a foto não mostra o corpo de forma clara
    // o suficiente para o modelo detectar a pose (muito de perto, cortada,
    // mal enquadrada). Traduzimos para uma instrução acionável — essa
    // mensagem cai automaticamente como erro 400 (contém "imagem").
    if (mensagensDeValidacao.some((msg) => msg.toLowerCase().includes("body pose"))) {
      throw new Error(
        "Não conseguimos identificar a pose na imagem. Tire a foto de frente, enquadrando da cintura para cima, com boa iluminação e o corpo bem visível."
      );
    }

    throw new Error(
      `Falha ao chamar o FASHN v1.6 na Fal.ai: ${detalhe ? JSON.stringify(detalhe) : err.message}`
    );
  }

  const imagemFinal = extrairUrlDaImagem(resultado);
  if (!imagemFinal) {
    throw new Error("A Fal.ai não retornou uma imagem válida.");
  }

  return imagemFinal;
}
