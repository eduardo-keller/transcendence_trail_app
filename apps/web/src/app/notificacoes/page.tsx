import { prisma } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import { markAllAsRead } from "@/server/notification/action";

export default async function NotificationsPage() {
  const user = await requirePageUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto max-w-2x1 p-4">
      <h1 className="text-xl font-bold">Notificacoes</h1>

      {notifications.some((n) => !n.isRead) && (
        <form action={markAllAsRead} className="my-4">
          <button type="submit">Marcar todas como lidas</button>
        </form>
      )}

      {notifications.length === 0 ?
        (
          <p>Voce nao tem notificacoes</p>
        ) : (
          <ul className="divide-y">
            {notifications.map((n) => (
              <li key={n.id} className={n.isRead ? "py-3" : "py-3 font-semibold"}>
                <p>{n.message}</p>
                <time dateTime={n.createdAt.toISOString()} className="text-sm text-gray-500">
                  { n.createdAt.toLocaleString("pt-BR")}
                </time>
              </li>
            ))}
          </ul>
      )}
    </main>
  );
}
