'use server';

import {
	type CreateActivityInput,
	createActivitySchema,
	type UpdateActivityInput,
	updateActivitySchema,
} from '@/lib/validation/activity';
import { parseWith, withAction } from '@/server/api';
import { requireUser } from '@/server/auth/session';
import { activityIdSchema } from './schemas';
import { createActivity, deleteActivity, updateActivity } from './service';

// Escritas de atividade (formato: docs/TECNICO.md, "Convenções").
// Cada action devolve ActionResult: { ok: true, data } ou { ok: false, error }.
// As páginas de atividades são dinâmicas (dependem do usuário): depois da action, router.refresh() basta.

export const createActivityAction = withAction(async (input: CreateActivityInput) => {
	const user = await requireUser();
	return createActivity(parseWith(createActivitySchema, input), user.id);
});

export const updateActivityAction = withAction(async (id: string, input: UpdateActivityInput) => {
	const user = await requireUser();
	const params = parseWith(activityIdSchema, { id });
	return updateActivity(params.id, parseWith(updateActivitySchema, input), user.id);
});

export const deleteActivityAction = withAction(async (id: string) => {
	const user = await requireUser();
	const params = parseWith(activityIdSchema, { id });
	return deleteActivity(params.id, user.id);
});
