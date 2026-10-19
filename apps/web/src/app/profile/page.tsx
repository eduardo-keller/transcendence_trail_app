import Link from "next/link";
import { ActivityList } from "@/components/activity-list";
import { PeopleList } from "@/components/people-list";

type Props = { searchParams: Promise<{ aba?: string }> };

const tabs = [
  { id: "following", label: "Following" },
  { id: "followers", label: "Followers" },
  { id: "activities", label: "Activities" },
] as const;

export default async function ProfilePage({ searchParams }: Props) {
  const { tab = "activities" } = await searchParams;

  return (
    <>
      <nav role="tablist" className="inline-flex gap-1 rounded-full bg-sand p-1">
        {tabs.map((a) => (
          <Link
            key={a.id}
            href={`/profile?tab=${a.id}`}
            role="tab"
            aria-selected={tab === a.id}
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
