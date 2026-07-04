function authHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

function parseVCard(text: string) {
  const lines = text.split(/\r?\n/);
  let name = "";
  let email = "";
  let phone = "";
  let company = "";
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith("FN:")) name = line.slice(3).trim();
    if (upper.startsWith("EMAIL") && line.includes(":")) {
      email = line.split(":").pop()?.trim() || email;
    }
    if (upper.startsWith("TEL") && line.includes(":")) {
      phone = line.split(":").pop()?.trim() || phone;
    }
    if (upper.startsWith("ORG:")) company = line.slice(4).split(";")[0].trim();
  }
  if (!email) return null;
  return { name: name || email, email, phone, company };
}

export async function fetchCardDavContacts(params: {
  url: string;
  username: string;
  password: string;
}) {
  const base = params.url.replace(/\/$/, "");
  const res = await fetch(base + "/", {
    method: "PROPFIND",
    headers: {
      Authorization: authHeader(params.username, params.password),
      Depth: "1",
      "Content-Type": "application/xml",
    },
    body: `<?xml version="1.0" encoding="utf-8" ?>
      <d:propfind xmlns:d="DAV:">
        <d:prop><d:getcontenttype/><d:displayname/></d:prop>
      </d:propfind>`,
  });

  if (!res.ok) throw new Error(`CardDAV PROPFIND failed (${res.status})`);
  const xml = await res.text();
  const hrefs = [...xml.matchAll(/<[^>]*href[^>]*>([^<]+)<\//gi)].map((m) => m[1]);
  const contacts: { name: string; email: string; phone?: string; company?: string }[] = [];

  for (const href of hrefs) {
    if (!href.toLowerCase().includes(".vcf") && !href.toLowerCase().includes("card")) continue;
    const url = href.startsWith("http") ? href : new URL(href, base + "/").toString();
    try {
      const cardRes = await fetch(url, {
        headers: { Authorization: authHeader(params.username, params.password) },
      });
      if (!cardRes.ok) continue;
      const text = await cardRes.text();
      const parsed = parseVCard(text);
      if (parsed) contacts.push(parsed);
    } catch {
      /* skip card */
    }
  }

  return contacts;
}
