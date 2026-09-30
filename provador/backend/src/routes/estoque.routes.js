import { Router } from "express";
import { listarEstoque } from "../controllers/estoque.controller.js";

export const estoqueRouter = Router();

estoqueRouter.get("/", listarEstoque);
