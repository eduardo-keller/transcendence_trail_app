import { describe, expect, it } from 'vitest';
import { detectImageType } from '@/lib/validation/avatar';

const bytes = (...values: (number | string)[]) =>
	new Uint8Array(values.flatMap((v) => (typeof v === 'string' ? [...v].map((c) => c.charCodeAt(0)) : [v])));

describe('detectImageType (magic bytes)', () => {
	it('reconhece JPEG, PNG e WebP pelo começo do arquivo', () => {
		expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
		expect(detectImageType(bytes(0x89, 'PNG', 0x0d, 0x0a))).toBe('image/png');
		expect(detectImageType(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('image/webp');
	});

	it('recusa o que não é imagem, qualquer que seja o nome do arquivo', () => {
		expect(detectImageType(bytes('MZ', 0x90, 0x00))).toBeNull(); // executável do Windows
		expect(detectImageType(bytes('<svg onload=alert(1)>'))).toBeNull(); // SVG pode ter script
		expect(detectImageType(bytes('GIF89a'))).toBeNull();
		expect(detectImageType(new Uint8Array())).toBeNull();
	});
});
