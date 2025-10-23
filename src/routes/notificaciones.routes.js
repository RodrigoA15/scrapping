import { Router } from "express";
import { generateNotifications } from "../controllers/notificaciones.controller.js";

const router = Router();

router.post("/", generateNotifications);

export default router;
