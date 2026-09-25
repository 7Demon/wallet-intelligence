interface Props {
  type: "performance" | "style" | "capital" | "activity";
  value?: string | null;
}

export function ClassificationBadge({ type, value }: Props) {
  if (!value) return null;

  const getStyle = () => {
    switch (value.toUpperCase()) {
      case "HIGHLY_PROFITABLE":
      case "PROFITABLE":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "HIGHLY_UNPROFITABLE":
      case "UNPROFITABLE":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "BREAK_EVEN":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "INSUFFICIENT_DATA":
        return "bg-slate-800 text-slate-400 border-slate-700";
      case "SCALPER":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      case "SHORT_TERM_TRADER":
        return "bg-sky-500/10 text-sky-400 border-sky-500/30";
      case "SWING_TRADER":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
      case "HOLDER":
        return "bg-violet-500/10 text-violet-400 border-violet-500/30";
      case "LARGE":
      case "VERY_LARGE":
        return "bg-purple-500/10 text-purple-300 border-purple-500/30";
      case "MEDIUM":
        return "bg-blue-500/10 text-blue-300 border-blue-500/30";
      case "SMALL":
      case "MICRO":
        return "bg-slate-700/50 text-slate-300 border-slate-600";
      case "ACTIVE":
      case "HIGH_FREQUENCY":
        return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
      case "INACTIVE":
        return "bg-slate-800 text-slate-500 border-slate-700";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  const formatText = (text: string) => {
    return text.replace(/_/g, " ");
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-medium border uppercase tracking-wider ${getStyle()}`}
    >
      {formatText(value)}
    </span>
  );
}
