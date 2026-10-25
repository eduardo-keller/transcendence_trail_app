// Foto do usuário ou, sem foto, as iniciais numa cor tirada do id (sempre a mesma por pessoa)
type Props = { id: string; name: string; image?: string | null; size?: number };

export function Avatar({ id, name, image, size = 96 }: Props) {
	const style = { width: size, height: size };
	if (image) {
		// biome-ignore lint/performance/noImgElement: avatar pequeno, servido pela nossa rota com cache
		return <img src={image} alt={`Foto de ${name}`} style={style} className="rounded-full object-cover" />;
	}
	const initials = name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join('');
	const hue = [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
	return (
		<span
			role="img"
			aria-label={`Avatar padrão de ${name}`}
			style={{ ...style, backgroundColor: `hsl(${hue} 40% 35%)`, fontSize: size * 0.4 }}
			className="inline-flex items-center justify-center rounded-full font-bold text-paper"
		>
			{initials || '?'}
		</span>
	);
}
