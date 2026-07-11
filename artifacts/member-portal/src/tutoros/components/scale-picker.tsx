interface ScalePickerProps {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  lowLabel?: string;
  highLabel?: string;
}

export function ScalePicker({
  label,
  value,
  onChange,
  lowLabel = "1",
  highLabel = "5",
}: ScalePickerProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-800">{label}</span>
        <span className="text-xs text-slate-500">
          {lowLabel} → {highLabel}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`rounded-xl border py-2.5 text-sm font-bold transition ${
              value === n
                ? "border-[#1865F2] bg-blue-50 text-[#1865F2]"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
