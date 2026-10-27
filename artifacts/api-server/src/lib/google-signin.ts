import { OAuth2Client } from "google-auth-library";

export function googleConfiguration() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const origin = process.env.AUTH_PUBLIC_ORIGIN;
  if (!clientId || !clientSecret || !origin) return null;
  try {
    const url = new URL(origin);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    return { clientId, clientSecret, origin: url.origin, redirectUri: `${url.origin}/api/auth/google/callback` };
  } catch { return null; }
}

export async function exchangeGoogleCode(code: string, verifier: string) {
  const config = googleConfiguration();
  if (!config) throw new Error("Google sign-in not configured");
  const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
  const { tokens } = await client.getToken({ code, codeVerifier: verifier, redirect_uri: config.redirectUri });
  if (!tokens.id_token) throw new Error("Missing Google identity token");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: config.clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || payload.email_verified !== true) throw new Error("Verified Google email required");
  return { subject: payload.sub, email: payload.email.trim().toLowerCase(), nonce: (payload as { nonce?: string }).nonce };
}
