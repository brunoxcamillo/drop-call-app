import express from "express";
import routes from "./routes/index.js";


const app = express();

// 🔹 Parser global para o resto da aplicação
app.use(express.json());

// 🔹 Healthcheck (opcional)
app.get("/health", (req, res) => res.send("ok"));


// 🔹 Rotas normais da aplicação
app.use("/", routes);

// 🔹 Handler de erro simples (opcional)
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});



export default app;
