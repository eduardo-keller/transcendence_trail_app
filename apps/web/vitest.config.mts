import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Testes: tests/unit (sem banco) e tests/integration (Postgres real, banco *_test).
// Rode com `make test`: ele aponta o DATABASE_URL para o banco de teste.
export default defineConfig({
	resolve: {
		alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
	},
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		globalSetup: ['tests/setup/global-setup.ts'],
		// Os testes de integração limpam o banco entre um teste e outro: um arquivo por vez
		fileParallelism: false,
	},
});
