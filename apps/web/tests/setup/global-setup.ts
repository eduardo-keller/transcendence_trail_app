import { execSync } from 'node:child_process';
import { Client } from 'pg';

// Roda uma vez antes de todos os testes: cria o banco de teste (se não existir) e aplica as migrations.
// Os testes de integração APAGAM as tabelas: por isso só rodam num banco cujo nome termina em _test.
export default async function setup() {
	const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalido');
	const dbName = url.pathname.slice(1);
	if (!dbName.endsWith('_test')) {
		throw new Error(
			`Os testes apagam o banco: DATABASE_URL precisa apontar para um banco *_test (veio "${dbName}"). Rode com "make test".`,
		);
	}

	const admin = new URL(url);
	admin.pathname = '/postgres';
	admin.search = '';
	const client = new Client({ connectionString: admin.toString() });
	await client.connect();
	try {
		const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
		// Nome validado acima (termina em _test e veio do nosso próprio Makefile)
		if (!rowCount) await client.query(`CREATE DATABASE "${dbName}"`);
	} finally {
		await client.end();
	}

	execSync('npx prisma migrate deploy', { stdio: 'pipe', env: process.env });
}
