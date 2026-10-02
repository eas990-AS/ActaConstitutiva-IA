const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

module.exports = async () => {
  require('./env');
  const url = new URL(process.env.DATABASE_URL);
  if (!url.pathname.endsWith('_test')) {
    throw new Error(`Las pruebas solo corren contra una base *_test (recibí ${url.pathname})`);
  }
  execSync('npx prisma migrate deploy', { stdio: 'ignore', env: process.env });
  const prisma = new PrismaClient();
  const tables = await prisma.$queryRawUnsafe(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  if (tables.length) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );
  }
  await prisma.$disconnect();
};
