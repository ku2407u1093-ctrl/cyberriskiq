import express from "express";
import cors from "cors";
import apiRouter from "./routes/api.js";
import realApiRouter from "./routes/realApi.js";
import { rebuild } from "./store.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", apiRouter);
app.use("/api/real", realApiRouter);
app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4001;

console.log("Computing baseline cyber risk simulation...");
const t0 = Date.now();
rebuild(42);
console.log(`Baseline ready in ${Date.now() - t0}ms`);

app.listen(PORT, () => {
  console.log(`Cyber Risk Quantification API listening on http://localhost:${PORT}`);
});
