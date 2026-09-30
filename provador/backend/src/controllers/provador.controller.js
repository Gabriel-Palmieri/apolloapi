import { buscarPecaPorId } from "../services/estoque.service.js";
import { gerarImagemVestida } from "../services/falVton.service.js";

export async function processarProvador(req, res, next) {
  try {
    const { id_peca } = req.body;
    const foto = req.file;

    if (!foto) {
      return res.status(400).json({ erro: "Envie a foto do cliente no campo 'foto'." });
    }
    if (!id_peca) {
      return res.status(400).json({ erro: "Envie o campo 'id_peca' com o item escolhido na vitrine." });
    }

    const peca = await buscarPecaPorId(id_peca);
    if (!peca) {
      return res.status(404).json({ erro: `Nenhuma peça encontrada com id "${id_peca}".` });
    }

    // Único ponto de IA do fluxo: a Fal.ai (FASHN v1.6) veste a peça
    // escolhida na foto do cliente. A justificativa não vem mais de uma IA —
    // é um texto fixo, já cadastrado em cada item do estoque.json.
    const imagemFinalUrl = await gerarImagemVestida({
      fotoBuffer: foto.buffer,
      mimeType: foto.mimetype,
      peca,
    });

    res.status(200).json({ imagemFinalUrl, peca });
  } catch (erro) {
    next(erro);
  }
}
