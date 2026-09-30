import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { env } from "./config/env.js";
import { provadorRouter } from "./routes/provador.routes.js";
import { estoqueRouter } from "./routes/estoque.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors({ origin: env.frontendOrigin }));
app.use(express.json());

// Serve as fotos mockadas das peças em http://localhost:3001/pecas/arquivo.jpg
app.use("/pecas", express.static(path.join(__dirname, "..", "public", "pecas")));

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api/provador", provadorRouter);
app.use("/api/estoque", estoqueRouter);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`Backend do Provador Virtual rodando em http://localhost:${env.port}`);
});
