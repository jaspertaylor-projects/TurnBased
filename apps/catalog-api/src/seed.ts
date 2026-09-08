import { PrismaClient } from '@prisma/client';
import "dotenv/config";

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const bgm = await prisma.supplier.upsert({
    where: { code: 'bgm' },
    update: {},
    create: {
      code: 'bgm',
      name: 'BoardGamesMaker',
      baseUrl: 'https://www.boardgamesmaker.com',
      isActive: true,
    },
  });

  const tgc = await prisma.supplier.upsert({
    where: { code: 'tgc' },
    update: {},
    create: {
      code: 'tgc',
      name: 'The Game Crafter',
      baseUrl: 'https://www.thegamecrafter.com',
      isActive: true,
    },
  });

  console.log('Successfully seeded database with:', bgm.name, '&', tgc.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
