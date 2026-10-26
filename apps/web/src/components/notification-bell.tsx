import Link from "next/link";

export function NotificationBell({ unread }: { unread: number }) {
  const label = unread > 0 ? `Notificacoes, ${unread} não lidas` : "Notificacoes";
  return (
    <Link href="/notificacoes" aria-label={label} className="relative inline-block">
      <span aria-hidden="true">🔔</span>
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-2 -top-2 rounded-full bg-red-600 px-1.5 text-xs text-white">
          { unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
