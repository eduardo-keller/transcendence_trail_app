'use server';

import { revalidatePath } from 'next/cache';
import {
	type CreateTrailInput,
	createTrailSchema,
	type UpdateTrailInput,
	updateTrailSchema,
} from '@/lib/validation/trail';
import { parseWith, withAction } from '@/server/api';
import { requireCurrentUser } from '@/server/api/session';
import { trailIdSchema } from './schemas';
import { createTrail, deleteTrail, updateTrail } from './service';

// Escritas de trilha (contrato: docs/contracts/README.md, "Server Actions").
// Cada action devolve ActionResult: { ok: true, data } ou { ok: false, error }.
// Os tipos dos parâmetros são só para o editor: a entrada é validada de novo aqui.

export const createTrailAction = withAction(async (input: CreateTrailInput) => {
	const user = await requireCurrentUser();
	const trail = await createTrail(parseWith(createTrailSchema, input), user.id);
	revalidatePath('/trilhas');
	return trail;
});

export const updateTrailAction = withAction(async (id: string, input: UpdateTrailInput) => {
	const user = await requireCurrentUser();
	const params = parseWith(trailIdSchema, { id });
	const trail = await updateTrail(params.id, parseWith(updateTrailSchema, input), user.id);
	revalidatePath('/trilhas');
	revalidatePath(`/trilhas/${trail.id}`);
	return trail;
});

export const deleteTrailAction = withAction(async (id: string) => {
	const user = await requireCurrentUser();
	const params = parseWith(trailIdSchema, { id });
	const trail = await deleteTrail(params.id, user.id);
	revalidatePath('/trilhas');
	return trail;
});
