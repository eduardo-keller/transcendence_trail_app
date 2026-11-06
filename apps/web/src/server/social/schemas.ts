import { z } from 'zod';

export const userIdSchema = z.object({ userId: z.string().min(1).max(64) });
