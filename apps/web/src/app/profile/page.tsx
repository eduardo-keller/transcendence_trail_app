import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { PeopleList } from "@/components/people-list";
import { requirePageUser } from '@/server/auth/session';
import { listFriendRequests, listFriends } from '@/server/social/friendship';

type Props = { searchParams: Promise<{ tab?: string }> };

const tabs = [
  { id: "friends", label: "Amigos" },
  { id: "requests", label: "Pedidos" },
  { id: "activities", label: "Atividades" },
] as const;

export default async function ProfilePage({ searchParams }: Props) {
  const user = await requirePageUser();
  const { tab: requested } = await searchParams;
  // ?tab= desconhecido ou ausente cai em "activities"
  const tab = tabs.find((t) => t.id === requested)?.id ?? "activities";

  return (
    <>
      <nav className="inline-flex gap-1 rounded-full bg-sand p-1">
        {tabs.map((a) => (
          <Link
            key={a.id}
            href={`/profile?tab=${a.id}`}
            aria-current={tab === a.id ? "page" : undefined}
            className={tab === a.id ? "rounded-full bg-paper px-4 py-2 font-extrabold" : "rounded-full px-4 py-2"}
          >
            {a.label}
          </Link>
        ))}
      </nav>
      {tab === 'activities' && <ActivityList />}
      {tab === 'friends' && (
        <PeopleList people={await listFriends(user.id)} status="friends" empty="Você ainda não tem amigos." />
      )}
      {tab === 'requests' && <Requests userId={user.id} />}
    </>
  );
}

async function Requests({ userId }: { userId: string }) {
  const { received, sent } = await listFriendRequests(userId);
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 font-bold">Recebidos</h2>
        <PeopleList people={received} status="received" empty="Nenhum pedido recebido." />
      </section>
      <section>
        <h2 className="mb-2 font-bold">Enviados</h2>
        <PeopleList people={sent} status="sent" empty="Nenhum pedido enviado." />
      </section>
    </div>
  );
}
