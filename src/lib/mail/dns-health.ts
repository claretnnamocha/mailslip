import { promises as dns } from "dns";

export type DnsHealth = {
  mxOk: boolean;
  spfOk: boolean;
  dkimOk: boolean | null;
  dmarcOk: boolean;
  details: {
    mx: string[];
    spf?: string;
    dmarc?: string;
  };
};

export async function checkDeliverability(domain: string): Promise<DnsHealth> {
  const details: DnsHealth["details"] = { mx: [] };

  let mxOk = false;
  try {
    const mx = await dns.resolveMx(domain);
    details.mx = mx.map((r) => `${r.priority} ${r.exchange}`);
    mxOk = mx.length > 0;
  } catch {
    mxOk = false;
  }

  let spfOk = false;
  try {
    const txt = await dns.resolveTxt(domain);
    const flat = txt.map((parts) => parts.join(""));
    const spf = flat.find((r) => r.toLowerCase().startsWith("v=spf1"));
    details.spf = spf;
    spfOk = Boolean(spf);
  } catch {
    spfOk = false;
  }

  let dmarcOk = false;
  try {
    const txt = await dns.resolveTxt(`_dmarc.${domain}`);
    const flat = txt.map((parts) => parts.join(""));
    const dmarc = flat.find((r) => r.toLowerCase().startsWith("v=dmarc1"));
    details.dmarc = dmarc;
    dmarcOk = Boolean(dmarc);
  } catch {
    dmarcOk = false;
  }

  // DKIM selectors vary; we cannot reliably probe without knowing the selector.
  return { mxOk, spfOk, dkimOk: null, dmarcOk, details };
}
