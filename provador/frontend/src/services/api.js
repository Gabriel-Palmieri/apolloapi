export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export async function buscarEstoque() {
  const resposta = await fetch(`${API_URL}/api/estoque`);
  if (!resposta.ok) {
    throw new Error("Não foi possível carregar as peças disponíveis.");
  }
  return resposta.json();
}

export async function enviarParaProvador({ fotoBlob, idPeca }) {
  const formData = new FormData();
  formData.append("id_peca", idPeca);
  formData.append("foto", fotoBlob, "foto-cliente.jpg");

  const resposta = await fetch(`${API_URL}/api/provador`, {
    method: "POST",
    body: formData,
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    throw new Error(dados.erro || "Não foi possível gerar o seu look agora.");
  }

  return dados; // { imagemFinalUrl, peca }
}
