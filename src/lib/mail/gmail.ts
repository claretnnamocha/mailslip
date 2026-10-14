import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { platformOrigin, prepareAuthHostEnv } from "@/lib/public-url";
import { isPlatformHost, resolveHostContext } from "@/lib/tenant";

export const GMAIL_IMAP_HOST = "imap.gmail.com";
export const GMAIL_IMAP_PORT = 993;
export const GMAIL_SMTP_HOST = "smtp.gmail.com";
export const GMAIL_SMTP_PORT = 587;

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const MAIL_SCOPE = "https://mail.google.com/";

export const GMAIL_RETURN_PATHS = ["/onboarding", "/settings/identities"] as const;
export type GmailReturnPath = (typeof GMAIL_RETURN_PATHS)[number];

export type GmailConnectState = {
  userId: string;
  assignUserId?: string;
  access: "SHARED" | "PERSONAL";
  displayName?: string;
  loginHint?: string;
  returnTo: GmailReturnPath;
  /** Browser origin the connect flow started on. Google always returns to the platform host. */
  origin?: string;
  exp: number;
};

export type GmailTokenBlob = {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number;
};

export function gmailOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

function clientId() {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!id) throw new Error("Google sign-in is not configured on this server");
  return id;
}

function clientSecret() {
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!secret) throw new Error("Google sign-in is not configured on this server");
  return secret;
}

/**
 * The only redirect URI to register on the Google client.
 * Customer domains bounce back here after Google returns to the platform host.
 */
export function gmailRedirectUri() {
  prepareAuthHostEnv();
  return `${platformOrigin()}/api/mail/gmail/callback`;
}

export async function isAllowedGmailReturnOrigin(origin: string) {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if ((url.pathname !== "/" && url.pathname !== "") || url.search || url.hash || url.username || url.password) {
    return false;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".localhost");
  if (local) return url.protocol === "http:";
  if (url.protocol !== "https:") return false;
  if (isPlatformHost(url.host)) return true;
  const ctx = await resolveHostContext(url.host);
  return ctx.kind === "tenant" && ctx.tenant != null;
}

export function isGmailReturnPath(value: string | null | undefined): value is GmailReturnPath {
  return value === "/onboarding" || value === "/settings/identities";
}

export function packGmailState(state: GmailConnectState) {
  return encryptSecret(JSON.stringify(state));
}

export function unpackGmailState(payload: string): GmailConnectState {
  let parsed: GmailConnectState;
  try {
    parsed = JSON.parse(decryptSecret(payload)) as GmailConnectState;
  } catch {
    throw new Error("This Google sign-in link is invalid. Start again.");
  }
  if (!parsed?.userId || !parsed.exp || !isGmailReturnPath(parsed.returnTo)) {
    throw new Error("This Google sign-in link is invalid. Start again.");
  }
  if (parsed.access !== "SHARED" && parsed.access !== "PERSONAL") {
    throw new Error("This Google sign-in link is invalid. Start again.");
  }
  if (parsed.exp < Date.now()) {
    throw new Error("This Google sign-in link expired. Start again.");
  }
  return parsed;
}

export function googleAuthorizeUrl(params: {
  redirectUri: string;
  state: string;
  loginHint?: string;
}) {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ["openid", "email", "profile", MAIL_SCOPE].join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", params.state);
  if (params.loginHint) url.searchParams.set("login_hint", params.loginHint);
  return url.toString();
}

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !data.access_token) {
    if (data.error === "invalid_grant") {
      throw new Error("This Gmail connection expired. Connect the account again.");
    }
    throw new Error(data.error_description || data.error || "Google did not return an access token");
  }
  return data;
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const data = await postToken(
    new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  );
  if (!data.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Remove Mailslip from that Google account's third-party access and try again.",
    );
  }
  if (!data.scope?.includes(MAIL_SCOPE)) {
    throw new Error("Google did not grant mailbox access. Approve mail access and try again.");
  }
  return {
    refreshToken: data.refresh_token,
    accessToken: data.access_token as string,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

export async function fetchGoogleProfile(accessToken: string) {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Could not read the Google account email");
  const data = (await res.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  const email = data.email?.trim().toLowerCase();
  if (!email || data.email_verified === false) {
    throw new Error("That Google account has no verified email address");
  }
  return { email, name: data.name?.trim() || "" };
}

export function packGmailTokens(blob: GmailTokenBlob) {
  return JSON.stringify(blob);
}

export function unpackGmailTokens(raw: string): GmailTokenBlob {
  try {
    const parsed = JSON.parse(raw) as GmailTokenBlob;
    if (parsed?.refreshToken) return parsed;
  } catch {
    /* stored value is not a token blob */
  }
  throw new Error("This Gmail connection is missing its refresh token. Connect the account again.");
}

const refreshing = new Map<string, Promise<string>>();

async function refreshStoredToken(identityId: string, raw: string): Promise<string> {
  const blob = unpackGmailTokens(raw);
  if (blob.accessToken && blob.expiresAt && blob.expiresAt - Date.now() > 60_000) {
    return blob.accessToken;
  }
  const data = await postToken(
    new URLSearchParams({
      client_id: clientId(),
      client_secret: clientSecret(),
      refresh_token: blob.refreshToken,
      grant_type: "refresh_token",
    }),
  );
  const next: GmailTokenBlob = {
    refreshToken: data.refresh_token || blob.refreshToken,
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };
  await prisma.mailIdentity.update({
    where: { id: identityId },
    data: { credentialsEnc: encryptSecret(packGmailTokens(next)) },
  });
  return next.accessToken as string;
}

export function ensureGmailAccessToken(identityId: string, credentialsEnc: string) {
  const existing = refreshing.get(identityId);
  if (existing) return existing;
  const job = refreshStoredToken(identityId, decryptSecret(credentialsEnc)).finally(() => {
    refreshing.delete(identityId);
  });
  refreshing.set(identityId, job);
  return job;
}
