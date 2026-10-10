/**
 * Seed the first workspace owner for self-hosted Mailslip installs.
 *
 * Usage:
 *   npm run seed:owner -- --email you@example.com --password '••••••••' --name 'Your Name'
 *
 * See docs/self-hosted-seed.md
 */

import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

type Args = {
  email?: string;
  password?: string;
  name?: string;
  workspace?: string;
  mustChangePassword: boolean;
  help: boolean;
};

function usage() {
  console.log(`Seed the first Mailslip owner (self-hosted).

Usage:
  npm run seed:owner -- --email <addr> --password <secret> [--name <name>] [--workspace <name>]
  npm run seed:owner -- --email <addr>   # password generated if omitted

Options:
  --email, -e           Login email (required)
  --password, -p        Password (min 8 chars). Generated if omitted.
  --name, -n            Display name (default: email local-part)
  --workspace, -w       Workspace name (default: "<name>'s workspace")
  --must-change-password  Require password change on first sign-in
  --help, -h            Show this help

Environment (used when flags are omitted):
  OWNER_EMAIL  OWNER_PASSWORD  OWNER_NAME  OWNER_WORKSPACE
`);
}

function parseArgs(argv: string[]): Args {
  const out: Args = { mustChangePassword: false, help: false };
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
      case "--must-change-password":
        out.mustChangePassword = true;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown option: ${arg}`);
        }
    }
  }
  return out;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  const email = (args.email || process.env.OWNER_EMAIL || "").trim().toLowerCase();
  let password = args.password || process.env.OWNER_PASSWORD || "";
  const name =
    (args.name || process.env.OWNER_NAME || "").trim() ||
    (email.includes("@") ? email.split("@")[0] : "");
  const workspaceName =
    (args.workspace || process.env.OWNER_WORKSPACE || "").trim() ||
    `${name.split(/\s+/)[0] || "Owner"}'s workspace`;

  if (!email || !isEmail(email)) {
    usage();
    console.error("Error: a valid --email is required.");
    process.exit(1);
  }

  let generatedPassword = false;
  if (!password) {
    password = randomBytes(12).toString("base64url");
    generatedPassword = true;
  }
  if (password.length < 8) {
    console.error("Error: password must be at least 8 characters.");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("Error: DATABASE_URL is not set. Copy .env.example to .env first.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const owners = await prisma.workspaceMember.count({ where: { role: "OWNER" } });
    if (owners > 0) {
      console.error(
        "An owner already exists. Use the Team settings page to add more people, or remove the existing owner first.",
      );
      process.exit(1);
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.error(`User ${email} already exists but is not an owner. Aborting.`);
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
              create: { name: workspaceName },
            },
          },
        },
      },
      include: {
        memberships: { include: { workspace: true } },
      },
    });

    const workspace = user.memberships[0]?.workspace;
    console.log("Owner created.");
    console.log(`  id:         ${user.id}`);
    console.log(`  email:      ${user.email}`);
    console.log(`  name:       ${user.name}`);
    console.log(`  workspace:  ${workspace?.name} (${workspace?.id})`);
    if (generatedPassword) {
      console.log(`  password:   ${password}`);
      console.log("  (generated once — save it now)");
    } else {
      console.log("  password:   (as provided)");
    }
    if (args.mustChangePassword) {
      console.log("  must change password on first sign-in: yes");
    }
    console.log("\nSign in at /login, then connect a mailbox.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
