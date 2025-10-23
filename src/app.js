import express from "express";
import routes from "./routes/index.routes.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(routes);

export default app;
