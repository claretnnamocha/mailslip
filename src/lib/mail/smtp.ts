import nodemailer from "nodemailer";
import type { ConnectionConfig, SendPayload } from "./types";

export async function testSmtpConnection(config: ConnectionConfig) {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost || "",
    port: config.smtpPort || 587,
    secure: config.smtpPort === 465,
    auth: config.accessToken
      ? { type: "OAuth2", user: config.username, accessToken: config.accessToken }
      : { user: config.username, pass: config.password },
    tls: config.smtpTls === false ? { rejectUnauthorized: false } : undefined,
  });
  await transporter.verify();
  return { ok: true as const };
}

export async function sendMail(config: ConnectionConfig, payload: SendPayload) {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost || "",
    port: config.smtpPort || 587,
    secure: config.smtpPort === 465,
    auth: config.accessToken
      ? { type: "OAuth2", user: config.username, accessToken: config.accessToken }
      : { user: config.username, pass: config.password },
  });

  const from = payload.from || config.email;
  const info = await transporter.sendMail({
    from: payload.fromName ? `"${payload.fromName}" <${from}>` : from,
    to: payload.to.join(", "),
    cc: payload.cc?.join(", "),
    bcc: payload.bcc?.join(", "),
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    inReplyTo: payload.inReplyTo,
    references: payload.references?.join(" "),
  });

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  };
}
