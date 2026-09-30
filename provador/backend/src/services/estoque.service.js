import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAMINHO_ESTOQUE = path.join(__dirname, "..", "data", "estoque.json");

let cache = null;

export async function carregarEstoque() {
  if (cache) return cache;
  const conteudo = await readFile(CAMINHO_ESTOQUE, "utf-8");
  cache = JSON.parse(conteudo);
  return cache;
}

export async function buscarPecaPorId(id) {
  const estoque = await carregarEstoque();
  return estoque.find((peca) => peca.id === id) || null;
}
