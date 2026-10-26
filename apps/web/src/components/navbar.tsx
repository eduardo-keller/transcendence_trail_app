import Link from "next/link";

import { NotificationBell } from "@/components/notification-bell";
import { prisma } from "@/lib/db";
import { getSession } from "@/server/auth/session";

export async function NavBar() {
  const session = await getSession();

  const unread = session ? await prisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  }) : 0;

  return (
      <nav>
        <ul className="flex justify-end gap-4 p-4">
        {session ?
          (
            <>
              <li>
                <NotificationBell unread={ unread } />
              </li>
              <li>
                <Link href="/profile" aria-label="Meu perfil">
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt="profile image"
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-grey-300"
                    >
                      {session.user.name[0].toUpperCase()}
                    </span>
                  )}
                </Link>
              </li>
            </>
          ) : (
            <>
              <li><Link href="/login">Entrar</Link></li>
              <li><Link href="/cadastro">Cadastro</Link></li>
            </>
          )}
          <li><Link href="/conta">Conta</Link></li>
          <li><Link href="/profile">Perfil</Link></li>
          <li><Link href="/termos">Termos</Link></li>
          <li><Link href="/privacidade">Privacidade</Link></li>
        </ul>
      </nav>
  );
}
