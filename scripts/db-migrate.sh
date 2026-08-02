#!/usr/bin/env sh
# Apply database migrations, tolerating a database that predates them.
#
# Fresh installs: `migrate deploy` applies the baseline and everything after.
# Installs created before migrations existed (the old `db push` path) already
# have the tables, so `deploy` fails with P3005 "schema is not empty" — mark
# the baseline as applied, then continue with any later migrations.
set -e

BASELINE=20260101000000_init

if npx prisma migrate deploy; then
  exit 0
fi

echo "migrate deploy failed — baselining a pre-existing database..."
npx prisma migrate resolve --applied "$BASELINE"
npx prisma migrate deploy
