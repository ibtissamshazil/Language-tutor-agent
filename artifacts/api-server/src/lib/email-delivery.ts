import nodemailer from "nodemailer";

export function emailDeliveryConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM)
    && [465, 587].includes(Number(process.env.SMTP_PORT ?? "465"));
}

/** Standard SMTP works with an existing mailbox; no authentication SaaS required. */
export async function sendSignInCode(email: string, code: string) {
  if (!emailDeliveryConfigured()) throw new Error("Email delivery is not configured");
  const port = Number(process.env.SMTP_PORT ?? "465");
  if (![465, 587].includes(port)) throw new Error("Use a TLS SMTP port (465 or 587)");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    logger: false,
    debug: false,
  });
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Your Language Tutor sign-in code",
      text: `Your Language Tutor sign-in code is ${code}.\n\nIt expires in 10 minutes and can be used once. Never share this code. If you did not request it, ignore this email.`,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  } finally { transport.close(); }
}
