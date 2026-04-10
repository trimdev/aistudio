interface Props {
  days: { label: string; count: number }[];
}

export function MiniTrendChart({ days }: Props) {
  const maxCount = Math.max(...days.map((d) => d.count), 1);

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-end gap-2 h-20">
        {days.map((day) => {
          const heightPct = Math.round((day.count / maxCount) * 100);
          return (
            <div key={day.label} className="flex-1 flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-500">
                {day.count > 0 ? day.count : ""}
              </span>
              <div className="w-full rounded-t-md bg-violet-100 relative" style={{ height: "48px" }}>
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-t-md bg-violet-500 transition-all"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400">{day.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
