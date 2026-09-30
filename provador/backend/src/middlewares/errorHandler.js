export function errorHandler(err, req, res, next) {
  console.error("[erro]", err.message);

  if (err instanceof Error && err.message.includes("imagem")) {
    return res.status(400).json({ erro: err.message });
  }

  const status = err.status || 500;
  res.status(status).json({
    erro: "Falha ao processar a solicitação.",
    detalhe: err.message,
  });
}
