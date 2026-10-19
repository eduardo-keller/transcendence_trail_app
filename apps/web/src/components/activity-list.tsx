const activities = [
  { id: "1", date: "12 out", trail: "Trilha da cachoeira", distance: 12.4, incline: 93, duration: "4 h 10" },
  { id: "2", date: "05 out", trail: "Mirante do vale", distance: 6.1, incline: 310, duration: "2 h 05" },
];

export function ActivityList() {
  return (
    <ul className="flex flex-col gap-3">
      {activities.map((a) => (
        <li key={a.id} className="rounded-[20px] border border-[rgba(91,70,50,.18)] bg-paper p-4">
          <p className="text-sm text-stone">{a.date}</p>
          <h3 className="text-lg font-bold">{a.trail}</h3>
          <p className="text-sm tabular-nums text-bark">
            {a.distance} km * {a.incline} m of inclination * {a.duration}
          </p>
        </li>
      ))}
    </ul>
  );
}
