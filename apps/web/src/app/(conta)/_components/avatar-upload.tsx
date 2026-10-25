'use client';

import { useRef, useState, useTransition } from 'react';
import { AVATAR_ACCEPT, AVATAR_ORIGINAL_MAX_BYTES, AVATAR_SIZE } from '@/lib/validation/avatar';
import { removeAvatarAction, uploadAvatarAction } from '@/server/profile/actions';
import { FormError } from './field';

// Recorta o centro da foto em quadrado e redimensiona para AVATAR_SIZE em WebP.
// Redesenhar no canvas também descarta os metadados EXIF (que podem ter a localização GPS).
async function resize(file: File): Promise<File> {
	const bitmap = await createImageBitmap(file);
	const side = Math.min(bitmap.width, bitmap.height);
	const canvas = document.createElement('canvas');
	canvas.width = AVATAR_SIZE;
	canvas.height = AVATAR_SIZE;
	canvas
		.getContext('2d')
		?.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
	bitmap.close();
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
	if (!blob) throw new Error('canvas vazio');
	return new File([blob], 'avatar.webp', { type: blob.type });
}

export function AvatarUpload({ hasImage }: { hasImage: boolean }) {
	const input = useRef<HTMLInputElement>(null);
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string>();

	function onChange(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = '';
		setError(undefined);
		if (!file) return;
		if (!AVATAR_ACCEPT.includes(file.type)) return setError('Escolha uma imagem JPEG, PNG ou WebP.');
		if (file.size > AVATAR_ORIGINAL_MAX_BYTES) return setError('Imagem com no máximo 10 MB.');

		startTransition(async () => {
			let small: File;
			try {
				small = await resize(file);
			} catch {
				return setError('Não foi possível ler essa imagem.');
			}
			const formData = new FormData();
			formData.set('avatar', small);
			const result = await uploadAvatarAction(formData);
			if ('error' in result) setError(result.error.message);
		});
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap gap-2">
				<input ref={input} type="file" accept={AVATAR_ACCEPT.join(',')} onChange={onChange} hidden name="avatar" />
				<button
					type="button"
					disabled={pending}
					onClick={() => input.current?.click()}
					className="rounded-full border border-forest px-4 py-1 text-sm font-bold text-forest disabled:opacity-60"
				>
					{pending ? 'Enviando…' : 'Trocar foto'}
				</button>
				{hasImage && (
					<button
						type="button"
						disabled={pending}
						onClick={() => startTransition(async () => void (await removeAvatarAction()))}
						className="rounded-full px-4 py-1 text-sm font-bold text-clay disabled:opacity-60"
					>
						Remover foto
					</button>
				)}
			</div>
			<FormError message={error} />
		</div>
	);
}
