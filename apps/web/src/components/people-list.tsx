import Link from "next/link";
import { Avatar } from "@/app/(conta)/_components/avatar";
import { FriendButton } from "@/components/friend-button";
import type { FriendshipStatusView } from "@/server/social/friendship";

type Person = {
	id: string;
	name: string;
	username: string;
	image: string | null;
};
type Props = { people: Person[]; status: FriendshipStatusView; empty: string };

export function PeopleList({ people, status, empty }: Props) {
	if (people.length === 0) return <p className="text-stone">{empty}</p>;
	return (
		<ul className="flex flex-col gap-3">
			{people.map((p) => (
				<li
					key={p.id}
					className="flex items-center gap-3 rounded-[20px] border border-[rgba(91,70,50,0.18)] bg-paper p-4"
				>
					<Avatar id={p.id} name={p.name} image={p.image} size={40} />
					<div className="min-w-0 flex-1">
						<Link
							href={`/u/${p.username}`}
							className="font-bold hover:underline"
						>
							{p.name}
						</Link>
						<p className="text-sm text-stone">{p.username}</p>
					</div>
					<FriendButton userId={p.id} status={status} />
				</li>
			))}
		</ul>
	);
}
