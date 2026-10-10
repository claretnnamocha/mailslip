/**
 * Create or update a multi-tenant workspace (subdomain / custom domain + brand).
 *
 * Examples:
 *   npm run seed:tenant -- --slug inbox --brand "Linqr Mail" --domain inbox.uselinqr.io \
 *     --mode self-hosted --email admin@uselinqr.io --password '••••••••'
 *
 *   npm run seed:tenant -- --attach --slug inbox --brand "Linqr Mail" \
 *     --domain inbox.uselinqr.io --mode self-hosted
 *
 * See docs/multi-tenant.md
 */

import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

type Args = {
  email?: string;
  password?: string;
  name?: string;
  workspace?: string;
  slug?: string;
  brand?: string;
  domain?: string;
  mode: string;
  attach: boolean;
  mustChangePassword: boolean;
  help: boolean;
};

function usage() {
  console.log(`Create or update a Mailslip tenant workspace.

Usage:
  npm run seed:tenant -- --slug <slug> --brand "<name>" [--domain host] [--mode self-hosted|cloud] \\
    --email <addr> [--password <secret>] [--name <name>]

  npm run seed:tenant -- --attach --slug <slug> --brand "<name>" [--domain host] [--mode ...]
    # Update the only / first workspace (no new user)

Options:
  --slug, -s            Subdomain label: {slug}.{MAILSLIP_BASE_DOMAIN}
  --brand, -b           Brand for titles (e.g. "Linqr Mail")
  --domain, -d          Custom host (e.g. inbox.uselinqr.io)
  --mode, -m            cloud | self-hosted (default: self-hosted)
  --email, -e           Owner email (required unless --attach)
  --password, -p        Owner password (generated if omitted)
  --name, -n            Owner display name
  --workspace, -w       Workspace display name
  --attach              Only set tenant fields on an existing workspace
  --must-change-password
  --help, -h
`);
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    mode: "self-hosted",
    attach: false,
    mustChangePassword: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--help":
      case "-h":
        out.help = true;
        break;
      case "--email":
      case "-e":
        out.email = next();
        break;
      case "--password":
      case "-p":
        out.password = next();
        break;
      case "--name":
      case "-n":
        out.name = next();
        break;
      case "--workspace":
      case "-w":
        out.workspace = next();
        break;
      case "--slug":
      case "-s":
        out.slug = next();
        break;
      case "--brand":
      case "-b":
        out.brand = next();
        break;
      case "--domain":
      case "-d":
        out.domain = next();
        break;
      case "--mode":
      case "-m":
        out.mode = next() || "self-hosted";
        break;
      case "--attach":
        out.attach = true;
        break;
      case "--must-change-password":
        out.mustChangePassword = true;
        break;
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    }
  }
  return out;
}

function normalizeMode(raw: string) {
  const mode = raw.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  if (mode === "cloud") return "cloud";
  return "self-hosted";
}

function normalizeSlug(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeDomain(raw: string) {
  return raw.trim().toLowerCase().replace(/:\d+$/, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  if (!process.env.DATABASE_URL) {
    console.error("Error: DATABASE_URL is not set.");
    process.exit(1);
  }

  const slug = args.slug ? normalizeSlug(args.slug) : "";
  const brand = (args.brand || "").trim();
  const domain = args.domain ? normalizeDomain(args.domain) : "";
  const mode = normalizeMode(args.mode);

  if (!slug && !domain) {
    usage();
    console.error("Error: provide at least --slug or --domain.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const tenantData = {
      ...(slug ? { slug } : {}),
      ...(brand ? { brandName: brand } : {}),
      ...(domain ? { customDomain: domain } : {}),
      mode,
    };

    if (args.attach) {
      const existing =
        (slug && (await prisma.workspace.findFirst({ where: { slug } }))) ||
        (domain && (await prisma.workspace.findFirst({ where: { customDomain: domain } }))) ||
        (await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } }));
      if (!existing) {
        console.error("No workspace found to attach. Create one with seed:owner / seed:tenant first.");
        process.exit(1);
      }
      const updated = await prisma.workspace.update({
        where: { id: existing.id },
        data: tenantData,
      });
      console.log("Tenant updated.");
      console.log(`  workspace: ${updated.name} (${updated.id})`);
      console.log(`  slug:      ${updated.slug || "—"}`);
      console.log(`  domain:    ${updated.customDomain || "—"}`);
      console.log(`  brand:     ${updated.brandName || "—"}`);
      console.log(`  mode:      ${updated.mode}`);
      return;
    }

    const email = (args.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      usage();
      console.error("Error: --email is required unless using --attach.");
      process.exit(1);
    }

    let password = args.password || "";
    let generatedPassword = false;
    if (!password) {
      password = randomBytes(12).toString("base64url");
      generatedPassword = true;
    }
    if (password.length < 8) {
      console.error("Error: password must be at least 8 characters.");
      process.exit(1);
    }

    const name =
      (args.name || "").trim() || email.split("@")[0];
    const workspaceName =
      (args.workspace || "").trim() || brand || `${name.split(/\s+/)[0]}'s workspace`;

    if (await prisma.user.findUnique({ where: { email } })) {
      console.error(`User ${email} already exists. Use --attach to update a workspace, or pick another email.`);
      process.exit(1);
    }
    if (slug && (await prisma.workspace.findFirst({ where: { slug } }))) {
      console.error(`Slug "${slug}" is already taken.`);
      process.exit(1);
    }
    if (domain && (await prisma.workspace.findFirst({ where: { customDomain: domain } }))) {
      console.error(`Domain "${domain}" is already taken.`);
      process.exit(1);
    }

    const user = await prisma.user.create({
      data: {
        zitadelId: `local:${email}`,
        email,
        name,
        loginName: email,
        passwordHash: await hashPassword(password),
        mustChangePassword: args.mustChangePassword,
        memberships: {
          create: {
            role: "OWNER",
            workspace: {
              create: {
                name: workspaceName,
                ...tenantData,
              },
            },
          },
        },
      },
      include: { memberships: { include: { workspace: true } } },
    });

    const workspace = user.memberships[0]?.workspace;
    console.log("Tenant owner created.");
    console.log(`  email:     ${user.email}`);
    console.log(`  workspace: ${workspace?.name} (${workspace?.id})`);
    console.log(`  slug:      ${workspace?.slug || "—"}`);
    console.log(`  domain:    ${workspace?.customDomain || "—"}`);
    console.log(`  brand:     ${workspace?.brandName || "—"}`);
    console.log(`  mode:      ${workspace?.mode}`);
    if (generatedPassword) {
      console.log(`  password:  ${password}`);
      console.log("  (generated once — save it now)");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
