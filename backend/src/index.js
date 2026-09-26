import express from "express";
import cors from "cors";
import { config } from "./config.js";
import "./db/database.js";
import { startSmtpServer } from "./smtp/smtpServer.js";
import authRoutes from "./routes/auth.routes.js";
import mailRoutes from "./routes/mail.routes.js";
import userRoutes from "./routes/user.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => res.json({ ok: true, service: "phonemail-backend" }));

app.use("/auth", authRoutes);
app.use("/mail", mailRoutes);
app.use("/users", userRoutes);
app.use("/webhooks", webhookRoutes);

app.listen(config.port, "0.0.0.0", () =>
  console.log(`[api] PhoneMail API on :${config.port}`)
);

startSmtpServer();
