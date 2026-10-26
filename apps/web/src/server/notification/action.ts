'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireUser } from '@/server/auth/session';

export async function markAllAsRead() {
  const user = await requireUser();

  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: {isRead: true},
  });
  revalidatePath('/', 'layout');
}
