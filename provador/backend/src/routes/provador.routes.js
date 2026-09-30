import { Router } from "express";
import { upload } from "../middlewares/upload.js";
import { processarProvador } from "../controllers/provador.controller.js";

export const provadorRouter = Router();

provadorRouter.post("/", upload.single("foto"), processarProvador);
