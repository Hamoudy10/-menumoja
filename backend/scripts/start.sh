#!/bin/sh
set -eo pipefail

echo "=== Applying database migrations ==="
npx prisma migrate deploy 2>&1

echo "=== Checking if seed needed ==="
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.owner.count().then(c => {
  if (c === 0) {
    console.log('Empty database — running seed...');
    require('child_process').execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', cwd: process.cwd() });
    console.log('Seed complete!');
  } else {
    console.log('Database already has data — skipping seed');
  }
  p.\$disconnect();
}).catch(e => {
  console.log('Seed check error:', e.message);
  p.\$disconnect();
});
"

echo "=== Starting application ==="
if [ -f dist/index.js ]; then
  node dist/index.js
else
  node_modules/.bin/tsx src/index.ts
fi
