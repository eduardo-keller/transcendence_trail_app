// Cria os usuários de teste (alice, bruno, carla, diego, eva) com a senha SEED_PASSWORD.
// Idempotente: quem já existe só tem o username acertado.
//
// uso: docker compose -f docker/docker-compose.yml exec nextjs node scripts/seed-users.mts
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const SEED_PASSWORD = 'trilhas-dev-123';
const USERS = [
	{ name: 'Alice Souza', email: 'alice@example.com', username: 'alice' },
	{ name: 'Bruno Lima', email: 'bruno@example.com', username: 'bruno' },
	{ name: 'Carla Mendes', email: 'carla@example.com', username: 'carla' },
	{ name: 'Diego Teruya', email: 'diego@example.com', username: 'diego' },
	{ name: 'Eva Rocha', email: 'eva@example.com', username: 'eva' },
];

// Num "docker compose exec" o DATABASE_URL não existe (só no processo do entrypoint)
function databaseUrl() {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	const password = readFileSync('/run/secrets/db_password', 'utf8').trim();
	return `postgresql://${process.env.POSTGRES_USER}:${password}@postgres:5432/${process.env.POSTGRES_DB}?schema=public`;
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });

try {
	// O mesmo hash (scrypt com salt) que o cadastro gera; um por usuário, porque o salt muda
	for (const { name, email, username } of USERS) {
		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) {
			await prisma.user.update({ where: { email }, data: { username } });
			console.log(`  ${email} já existe (@${username})`);
			continue;
		}
		const id = randomUUID();
		await prisma.user.create({
			data: {
				id,
				name,
				email,
				username,
				accounts: {
					create: { id: randomUUID(), accountId: id, providerId: 'credential', password: await hashPassword(SEED_PASSWORD) },
				},
			},
		});
		console.log(`  ${email} criado`);
	}
	console.log(`seed-users: senha de todos = ${SEED_PASSWORD}`);
} finally {
	await prisma.$disconnect();
}
