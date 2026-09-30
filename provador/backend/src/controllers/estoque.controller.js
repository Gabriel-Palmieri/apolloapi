import { carregarEstoque } from "../services/estoque.service.js";

export async function listarEstoque(req, res, next) {
  try {
    const estoque = await carregarEstoque();
    res.status(200).json(estoque);
  } catch (erro) {
    next(erro);
  }
}
