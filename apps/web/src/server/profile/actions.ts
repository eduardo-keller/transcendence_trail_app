'use server';

import { revalidatePath } from 'next/cache';
import { type ProfileInput, profileSchema } from '@/lib/validation/profile';
import { parseWith, withAction } from '@/server/api';
import { requireUser } from '@/server/auth/session';
import { updateProfile } from './service';

// O id vem da sessão, nunca do formulário: ninguém edita o perfil de outra pessoa
export const updateProfileAction = withAction(async (input: ProfileInput) => {
	const user = await requireUser();
	const profile = await updateProfile(user.id, parseWith(profileSchema, input));
	// TODO(notify): "Editar perfil" quando o notify() do Rafa existir
	revalidatePath('/conta');
	revalidatePath(`/u/${profile.username}`);
	return profile;
});
