// Regras do avatar compartilhadas entre o navegador e o servidor.

export const AVATAR_SIZE = 256; // px; o navegador redimensiona antes de enviar
export const AVATAR_MAX_BYTES = 512 * 1024; // depois de redimensionada
export const AVATAR_ORIGINAL_MAX_BYTES = 10 * 1024 * 1024; // a foto escolhida
export const AVATAR_ACCEPT = ['image/jpeg', 'image/png', 'image/webp'];

// Tipo da imagem pelos primeiros bytes ("magic bytes"), não pela extensão nem pelo
// Content-Type, que quem envia pode falsificar. null = não é uma imagem aceita.
export function detectImageType(bytes: Uint8Array): string | null {
	const ascii = (start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
	if (bytes[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
	if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
	return null;
}
