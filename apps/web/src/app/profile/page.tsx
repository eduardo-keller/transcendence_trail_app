import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { PeopleList } from "@/components/people-list";

type Props = { searchParams: Promise<{ tab?: string }> };

const tabs = [
  { id: "following", label: "Following" },
  { id: "followers", label: "Followers" },
  { id: "activities", label: "Activities" },
] as const;

export default async function ProfilePage({ searchParams }: Props) {
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
      {tab === "activities" ? <ActivityList /> : <PeopleList type={tab} />}
    </>
  );
}
