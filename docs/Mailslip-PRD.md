# Mailslip — Product Requirements Document

**A calm, provider-agnostic webmail client.**
Version: 1.0 (design) · Last updated: July 4, 2026
Domain: `mailslip.woksol.space` · A sub-product of Linqr.

---

## 1. Overview

Mailslip is a beautiful, hosted email **client** — not an email **service**. Users bring their own SMTP / IMAP / POP3 / JMAP credentials (from Gmail, Zoho, Namecheap, cPanel, or a custom/self-hosted server) and get a clean, modern interface to send and receive mail. Think of it as a high-end, hosted Thunderbird: provider-agnostic, zero lock-in.

It ships in two forms from the same codebase:

- **Cloud** — hosted at mailslip.woksol.space.
- **Self-hosted** — open source (MIT), run your own instance.

### 1.1 The core bet

Mailslip **decouples the client from the server**. Gmail welds inbox + client together; Mailslip is the opposite — the client is the product, the server stays yours.

> **Positioning:** _Beautiful email, without switching providers._
> It is not "a better Gmail." The buyer is anyone whose mail lives **off** Gmail — a custom domain, cPanel, a VPS, a self-hosted server, or scattered accounts — who today is stuck with Roundcube/Horde/host webmail and has no good-looking, provider-agnostic option.

### 1.2 What it is NOT

- Not an email host/provider (stores no mail of its own).
- Not trying to convert happy Gmail-web users.
- Not a calendar or full groupware suite (CalDAV is wired for future; no calendar UI today).

---

## 2. Principles

- **Calm over noise.** Every element must "add calm, not noise." White space is a feature. The opposite of Gmail's toolbar density.
- **Config made human.** The scary part of BYO-server mail (IMAP/POP3/SMTP/JMAP, TLS, app-passwords vs OAuth, SPF/DKIM/DMARC) is turned into a premium settings experience.
- **Zero lock-in as a moat.** Mailslip holds nothing hostage. Even the delete-account and disconnect flows reassure that mail on your own server is never touched.
- **Reference feel:** Linear, Notion, iA Writer, Mimestream, Superhuman. **Explicitly not:** Gmail, Outlook, Roundcube, generic Tailwind templates.

---

## 3. Design system

### 3.1 Type

- **Display / UI:** Geist (300–700). Airy line height, gentle negative tracking on headings.
- **Mono:** Geist Mono — email addresses, hosts, ports, technical values, labels.

### 3.2 Colour tokens (role-named, theme-agnostic)

| Token         | Light     | Dark                    |
| ------------- | --------- | ----------------------- |
| bg            | `#F7F6F3` | `#161514`               |
| surface       | `#FFFFFF` | `#1E1D1B`               |
| surface-2     | `#FBFAF8` | `#242220`               |
| text          | `#1C1B19` | `#ECEAE5`               |
| text-2        | `#6B675F` | `#A39E96`               |
| text-3        | `#9C968C` | `#6F6A63`               |
| border        | `#ECE8E1` | `#2C2A27`               |
| border-strong | `#E1DCD3` | `#3A3733`               |
| accent        | `#BE7C5E` | `#CD9070`               |
| accent-tint   | `#F4E9E2` | `rgba(201,138,108,.18)` |
| danger        | `#C25E54` | `#D3756B`               |
| ok            | `#6E8B6A` | `#7E9A78`               |

- **One accent (terracotta), applied last.** Marks only the primary action and the current selection. Shifts one notch warmer in dark to hold contrast.
- **No gradients, no bright colours, no pure black/white.**
- **Email content stays on a white sheet even in dark mode** (like a physical letter).

### 3.3 Iconography

One line-icon family: 24px grid, 1.7 stroke, round caps/joins, `currentColor` (adapts to theme + state). No emoji in chrome.

### 3.4 Interaction

- Hover: subtle background tint. Selected: accent-tint bg + 2px left accent border.
- Focus: 1.5px accent border + 3px accent-tint ring.
- Transitions 150–200ms ease-out. Loading = skeletons, not spinners.
- Toasts bottom-left, auto-dismiss. Form errors inline, never modal.
- Density toggle (Comfortable / Compact).

---

## 4. Concept model (important)

Four distinct concepts — do not conflate:

- **Profile** = a person's Mailslip **app account** (login, name, avatar). Exactly one per person.
- **Mail identity** = a **mailbox you connect** to send/receive through. A profile can hold many. Three flavours:
  - **Own mailbox** — a real IMAP/POP3/JMAP account with its own credentials.
  - **Alias · scoped inbox** — a _filtered view_ of a shared backing mailbox (see §9).
  - **Full domain** — connect a domain once; every address on it becomes a send-from identity.
- **Add a person** = admin **provisions a new profile** for someone else (see §8). Distinct from an invite.
- **Add mail identity** = attach a mailbox to an existing profile.

**Identities are a shared pool; a profile is a person; granting is the link between them** — mandatory to choose for Members, automatic-and-total for Admins.

---

## 5. Protocols & connection

| Protocol             | Role                                                                   | Quota?                                     |
| -------------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| **IMAP**             | Incoming, two-way sync, mail stays on server (default)                 | Yes, if server advertises QUOTA (RFC 2087) |
| **POP3**             | Incoming, downloads to device, optional delete-after                   | No (STAT only)                             |
| **JMAP**             | Modern: mail + contacts + calendar over one endpoint; no separate SMTP | Yes (RFC 9425)                             |
| **SMTP**             | Outgoing only, stateless                                               | None                                       |
| **CardDAV / CalDAV** | Contacts / calendar sync                                               | WebDAV quota (RFC 4331)                    |

- **Auth modes:** Password · **App password** · **OAuth 2.0**. Gmail/Outlook require OAuth or an app password — surfaced explicitly (the #1 setup trip-up).
- **Deliverability health:** SPF / DKIM / DMARC / MX shown as a check on the identity card and onboarding success — turns invisible DNS config into a trust signal.
- **SMTP sends, IMAP stores.** Outgoing mail is stored only because the client IMAP-APPENDs a copy to Sent; SMTP alone keeps nothing.

---

## 6. Screens & flows (the product)

Organized as a top-to-bottom journey; each stage reads left-to-right.

1. **Discover & sign in** — Landing (hero: "Beautiful email, without switching providers"), Login.
2. **Connect your first account** — onboarding: choose type → incoming & auth (IMAP/POP3/JMAP + auth mode) → contacts & calendar (optional CardDAV/CalDAV) → test & success.
3. **Or connect a whole domain** — verify ownership (TXT) → mail server (admin login vs per-address) → addresses (catch-all + discovered mailboxes) → done (send as any address).
4. **First run** — no-identity empty state, all-caught-up empty state.
5. **Your inbox** — three-panel (sidebar / list / reading), message thread, dark mode, **unified "All inboxes"** with per-row destination tags, address switcher.
6. **Triage & menus** — right-click context menu, move-to submenu, toolbar overflow, sort & display, account menu, multi-select action bar.
7. **Writing & sending** — compose (modal), full-screen compose.
8. **Find & organize** — search results (filters + highlight), contacts (CardDAV address book), filters & rules (Sieve).
9. **On mobile** — inbox list, message view (three panels collapse; bottom nav + FAB compose).
10. **Settings** — Profile, Mail identities, Signatures, Notifications, Appearance, Keyboard shortcuts, Danger zone.
11. **Domain & admin** — domain mapping (CNAME + auto-TLS), domain-already-claimed (exclusive ownership).
12. **Team & provisioning** — team roster, add person, admin-role variant, credentials handover, first-login forced password change.
13. **Aliases & scoped inboxes** — scoped identity setup, own-mailbox setup, Joshua's filtered view, storage/quota per identity.
14. **Time & templates** — snooze, schedule send, undo-send setting, templates.
15. **Vacation & folders** — vacation responder, folder management.
16. **Attachments** — compose with drag-drop + progress, reader with blocked remote images + download-all.
17. **Security & migration** — encrypted (PGP) compose, encryption keys settings, spam & blocking, import/migrate.

Reference (isolated state studies): incoming protocol states, auth & connection-test states, list-row & compose states.

---

## 7. Layout spec

### Desktop — three panel

- **Sidebar (~220px):** logo, Compose, nav (Inbox/Sent/Drafts/Archive/Trash/Spam), custom folders, Identities (colour dot + unread badge per account), user/settings at bottom.
- **Message list (~320px):** rows = sender (bold if unread) / subject / snippet / timestamp; unread = accent dot; selected = accent-tint + left border; star/actions on hover; density toggle.
- **Message view (fills rest):** subject heading, collapsible From/To/Cc/Date, clean body (HTML respected, plain text reads like a document), attachment chips, Reply / Reply all / Forward, collapsed thread history.

### Compose

Modal or bottom-right slide-up, plus full-screen toggle. From (identity dropdown), To, Cc/Bcc (hidden until clicked), Subject; rich-text default with plain-text toggle; toolbar = bold/italic/link/list/attach only; auto-saved draft ("Draft saved"); discard confirms if content exists.

### Mobile

Default = message list. Tap → full-screen message. Hamburger → sidebar. Bottom nav + FAB compose. Hit targets ≥ 44px.

---

## 8. Team, roles & provisioning

Admin-provisioning model (like Microsoft 365 / Outlook), **not** an email invite:

1. Admin **creates the account**: full name, username/login, an auto-generated **temporary password** (copy/regenerate), and **"require password change at first sign-in"** (on by default).
2. Admin **copies credentials** and hands them to the person out-of-band (password shown once).
3. On **first sign-in**, the user is forced to set their own password.

**Roles:**

- **Owner** — everything, plus billing + delete/transfer workspace (the ceiling; not even Admins get this).
- **Admin** — **all mailboxes automatically** (incl. future ones) + add/remove users, add/edit/delete identities, map domains & DNS, manage filters. No per-mailbox assignment step.
- **Member** — access is **allow-listed**: pick specific mailboxes + a permission each (**Send & read** / **Read only**). Sees nothing else.

A person's **personal own-mailbox** identity is not grantable to others (shown disabled). Granting is **many-to-many** (one shared mailbox → several people; one person → several mailboxes).

---

## 9. Aliases & scoped inboxes (key architecture)

**An alias is not a mailbox.** 50 aliases + a catch-all all deliver into one physical IMAP inbox. So an alias like `joshua@linkad.io` has no inbox of its own.

**Solution — scoped identity:** a first-class identity = **(backing mailbox) + (recipient filter) + (match header)**, assigned to a user instead of the raw mailbox. Mailslip shows that user only the messages whose recipient matches; the other 49 aliases stay hidden.

- **Match on Envelope recipient (Delivered-To / X-Original-To)**, not just To/Cc — so **BCC** and **catch-all** mail (where the address never appears in To) still resolve. Fall back to To/Cc when the envelope header is stripped.
- **Catch-all** case = same trick, backing off the catch-all mailbox.
- **Sent & send-as scoped too:** user replies as `joshua@` (SMTP From), and the Sent view filters the shared Sent folder by From.
- **Enforcement is server-side in Mailslip** — a security boundary, never "hidden in the client."
- Shared read-state (\Seen) lives on the backing mailbox; rarely collides since each person sees different messages.

**Storage/quota is identity-type-aware:** a quota bar shows **only for real credentialed mailboxes that report a quota**. Aliases/scoped/catch-all show "counts toward [backing mailbox]"; POP3 / unsupported servers show "This server doesn't report a quota" rather than faking a number.

---

## 10. Full-domain & one person, many addresses

- Verify domain ownership once (TXT), configure the shared mail server, choose auth model (domain-admin login unlocks all mailboxes, or per-address passwords), enable catch-all, pick addresses.
- One profile then **receives** every address in a **unified "All inboxes"** stream (each row tagged with its destination address, colour-coded), **switches** via an address picker (All / ada@ / hello@ / support@ / + any), and **sends as any address** on the domain.
- **A domain is exclusively owned:** it can be configured on **one workspace at a time**. Attempting to add a claimed domain is blocked, shows who holds it, and offers only "Request transfer" (current owner must release).

---

## 11. Feature detail

**Time & sending:** snooze (later/tomorrow/weekend/next week/custom), schedule send (held in Drafts), undo-send (5/10/20/30s window + toast), templates/canned responses.

**Away & organization:** vacation responder (server-side Sieve, date range, contacts-only option, per-sender rate limit), folder management (real IMAP folders, drag reorder/nest, inline rename).

**Attachments:** compose with chips + upload progress + drag-drop overlay; reader blocks remote images by default (Show / Always from sender), attachment chips + Download all.

**Security & migration (self-hosted strengths):** PGP encryption (encrypted compose, key management, sign-by-default, auto-encrypt when recipient key known, per-contact key status), spam & blocking (blocked senders/domains + always-allow list), import/migrate (IMAP-to-IMAP copy or mbox upload; nothing deleted at source).

**Search:** full query with filter chips (from / has-attachment / unread / date), all-folders scope, term highlighting in list + body.

**Contacts:** CardDAV address book — groups, alphabetical list, contact detail (email/phone/company/groups), recent threads, compose.

**Filters & rules:** server-side Sieve — When (field/operator/value) → Then (move/mark/star…) builder + enable toggles.

---

## 12. Settings map

Profile · Mail identities · Signatures (per identity, rich text) · Filters & rules · Team · Domain · Notifications (per identity) · Appearance (Light/Dark/System + "keep email white in dark") · Keyboard shortcuts · Vacation responder · Folders · Encryption · Spam & blocking · Import · Storage · Danger zone (disconnect identity / delete account — both reassure mail on your server is untouched).

---

## 13. Open decisions & out of scope

- **Folders, not labels.** Deliberately chose IMAP folders over Gmail-style multi-tag labels. (Revisit if multi-tagging is wanted.)
- **No calendar UI.** CalDAV is wired in onboarding; the calendar surface is left to a sibling product.
- **Static hi-fi design today** — screens are polished layouts, not a click-through prototype. (Interactive build is a possible next step.)
- Not yet designed: read receipts, i18n/timezone prefs, saved searches (low priority).

---

## 14. Deliverables (current)

- `Mailslip.dc.html` — full product canvas (~50 frames), light + dark, journey-ordered + reference state studies.
- `Mailslip Design System.dc.html` — tokens / type / icons / components, light **and** dark.
- `Mailslip OG Image.dc.html` (+ `Mailslip-og.png`) — 1200×630 link preview.
- `Mailslip Logo Mark.dc.html` (+ `Mailslip-logo-512.png`) — square "m" mark.
- `Mailslip-PRD.md` — this document.
