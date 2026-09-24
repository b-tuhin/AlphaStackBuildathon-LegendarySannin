import { SMTPServer } from "smtp-server";
import { simpleParser } from "mailparser";
import { db } from "../db/database.js";
import { config } from "../config.js";
import { ingestEmail, normalizeAddress } from "./mailEngine.js";

export function startSmtpServer() {
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    banner: "PhoneMail SMTP",

    onRcptTo(address, session, cb) {
      const addr = normalizeAddress(address.address);
      if (!addr.endsWith(`@${config.mailDomain}`)) {
        return cb(new Error(`550 Relay denied: only @${config.mailDomain} accepted`));
      }
      const localPart = addr.split("@")[0];
      const user = db.prepare(`SELECT id FROM users WHERE phone = ? OR aliases LIKE ?`)
        .get(localPart, `%"${localPart}"%`);
      if (!user) return cb(new Error(`550 No such user: ${addr}`));
      cb();
    },

    onData(stream, session, cb) {
      simpleParser(stream)
        .then((parsed) => {
          const to = session.envelope.rcptTo.map(r => r.address);
          ingestEmail({
            from: parsed.from?.value?.[0]?.address || session.envelope.mailFrom.address,
            to,
            subject: parsed.subject,
            text: parsed.text,
            html: parsed.html || "",
            attachments: parsed.attachments || [],
            source: "smtp",
          });
          console.log(`[smtp] Ingested mail -> ${to.join(", ")}`);
          cb();
        })
        .catch((err) => {
          console.error("[smtp] Parse error:", err.message);
          cb(new Error("451 Processing error"));
        });
    },
  });

  server.on("error", (err) => console.error("[smtp] Error:", err.message));
  server.listen(config.smtpPort, "0.0.0.0", () =>
    console.log(`[smtp] Listening on :${config.smtpPort} for *@${config.mailDomain}`)
  );
  return server;
}
