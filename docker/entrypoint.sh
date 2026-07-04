#!/bin/sh
set -e

echo "Applying database schema…"
prisma db push --skip-generate

echo "Starting Mailslip…"
exec node server.js
