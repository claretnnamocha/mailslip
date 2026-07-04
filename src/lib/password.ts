function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function derive(password: string, salt: Uint8Array) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return toHex(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  return `${toHex(salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength))}:${hash}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [saltHex, hash] = stored.split(":");
  if (!saltHex || !hash) return false;
  const next = await derive(password, fromHex(saltHex));
  if (next.length !== hash.length) return false;
  let ok = 0;
  for (let i = 0; i < next.length; i++) ok |= next.charCodeAt(i) ^ hash.charCodeAt(i);
  return ok === 0;
}
