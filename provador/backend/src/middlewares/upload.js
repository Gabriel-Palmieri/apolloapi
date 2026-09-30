import multer from "multer";

// Mantém o arquivo em memória (Buffer) — não precisamos gravar em disco,
// já que a foto é repassada direto para o storage da Fal.ai.
const storage = multer.memoryStorage();

function filtroDeArquivo(req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Envie um arquivo de imagem (jpeg/png)."));
  }
  cb(null, true);
}

export const upload = multer({
  storage,
  fileFilter: filtroDeArquivo,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB é suficiente para uma foto de webcam
});
