import { prisma } from "@/lib/db";
import { requirePageUser } from "@/server/auth/session";
import {
	markAllAsRead,
	openNotification,
	sendTestNotification,
} from "@/server/notification/action";
import { notificationHref } from "@/server/notification/routes";
import { usernameMap } from "@/server/notification/service";

export default async function NotificationsPage() {
	const user = await requirePageUser();

	const notifications = await prisma.notification.findMany({
		where: { userId: user.id },
		orderBy: { createdAt: "desc" },
		take: 50,
	});
	const usernames = await usernameMap(notifications);

	return (
		<main className="mx-auto max-w-2xl p-4">
			<h1 className="text-xl font-bold">Notificacões</h1>
			<form action={sendTestNotification} className="my-4">
				<button type="submit">Criar notificacão de teste</button>
			</form>
			{notifications.some((n) => !n.isRead) && (
				<form action={markAllAsRead} className="my-4">
					<button type="submit">Marcar todas como lidas</button>
				</form>
			)}
			{notifications.length === 0 ? (
				<p>Você não tem notificacões!</p>
			) : (
				<ul className="divide-y">
					{notifications.map((n) => {
						const href = notificationHref(n, usernames);
						const content = (
							<>
								<span className="block">{n.message}</span>
								<time
									dateTime={n.createdAt.toISOString()}
									className="block text-sm text-gray-500"
								>
									{n.createdAt.toLocaleString("pt-BR")}
								</time>
							</>
						);
						if (n.isRead && !href) {
							return (
								<li key={n.id} className="py-3">
									{content}
								</li>
							);
						}
						return (
							<li key={n.id} className="py-3">
								<form action={openNotification.bind(null, n.id)}>
									<button
										type="submit"
										className={
											n.isRead
												? "w-full text-left"
												: "w-full text-left font-semibold"
										}
									>
										{content}
									</button>
								</form>
							</li>
						);
					})}
				</ul>
			)}
		</main>
	);
}
