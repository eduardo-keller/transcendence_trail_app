type Props = { type: "following" | "followers" };

const people = [
  { id: "1", name: "Ana Souza", city: "Sao Paulo", state: "SP" },
  { id: "2", name: "Bruno Lima", city: "Sao Bernardo do Campo", state: "SP" },
];

export function PeopleList({ type }: Props) {
  return (
    <ul className="flex flex-col gap-3">
      {people.map((p) => (
        <li key={p.id} className="flex items-center gap-3 rounded-[20px] border border-[rgba(91,70,50,0.18)] bg-paper p-4">
          <div className="h-10 w-10 rounded-full bg-sand" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">{p.name}</p>
            <p className="text-sm text-stone">{p.city}</p>
          </div>
          <button type="button" className="rounded-full bg-forest px-4 py-2 text-sm font-bold text-paper">
            {type === "following" ? "Following" : "Following back"}
          </button>
        </li>
      ))}
    </ul>
  );
}
