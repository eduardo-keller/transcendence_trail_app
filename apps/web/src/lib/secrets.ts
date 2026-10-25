import { readFileSync } from 'node:fs';

// Segredo pelo Docker secret (/run/secrets/<nome>) ou, em dev, pela variável de ambiente (NOME em maiúsculas).
// Sem nenhum dos dois: undefined (a funcionalidade que depende dele fica desligada).
export function readSecret(name: string): string | undefined {
	const fromEnv = process.env[name.toUpperCase()];
	if (fromEnv) return fromEnv;
	try {
		return readFileSync(`/run/secrets/${name}`, 'utf8').trim() || undefined;
	} catch {
		return undefined;
	}
}
