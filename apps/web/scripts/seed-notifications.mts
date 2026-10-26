import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const UNREAD = 12;
const READ = 3;

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const password = readFileSync('/run/secrets/db_password', 'utf8').trim();
  return (`postgresql://${process.env.POSTGRES_USER}:${password}@postgres:5432/${process.env.POSTGRES_DB}?schema=public`);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });

try {
  const email = process.argv[2];
  const users = await prisma.user.findMany({ where: email ? { email } : {}, select: { id: true, email: true } });
  if (users.length === 0) {
    console.log('seed-notifications: nenhum usuario encontrado (rode seed-users antes)');
  }

  for (const user of users) {
    const now = Date.now();
    const data = Array.from({ length: UNREAD + READ }, (_, i) => ({
      id: `seed-notification-${user.id} - ${i}`,
      message: `Notificacao de teste ${i + 1}`,
      isRead: i >= UNREAD,
      createdAt: new Date(now - i * 60_000),
      userId: user.id,
    }));
    const { count } = await prisma.notification.createMany({ data, skipDuplicates: true });
    console.log(` ${user.email}:${count} criadas`);
  }
} finally {
  await prisma.$disconnect();
}
