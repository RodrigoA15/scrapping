import { Router } from "express";
import routesNotifications from "./notificaciones.routes.js";

const router = Router();

const pathRoutes = "/api/v1";

router.use(`${pathRoutes}/notificaciones`, routesNotifications);

export default router;
