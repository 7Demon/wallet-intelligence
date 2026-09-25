interface Props {
  type: "performance" | "style" | "capital" | "activity";
  value?: string | null;
}

export function ClassificationBadge({ type, value }: Props) {
  if (!value) return null;

  const getBadgeDetails = () => {
    switch (value.toUpperCase()) {
      case "MEGA_WHALE":
      case "WHALE":
      case "VERY_LARGE":
      case "LARGE":
        return {
          icon: "🐋",
          label: "WHALE",
          style: "bg-purple-500/20 text-purple-300 border-purple-500/40",
        };
      case "DOLPHIN":
      case "MEDIUM":
        return {
          icon: "🐬",
          label: "DOLPHIN",
          style: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
        };
      case "FISH":
      case "SMALL":
        return {
          icon: "🐟",
          label: "FISH",
          style: "bg-blue-500/20 text-blue-300 border-blue-500/40",
        };
      case "SHRIMP":
      case "MICRO":
        return {
          icon: "🦐",
          label: "SHRIMP",
          style: "bg-slate-700/50 text-slate-400 border-slate-600",
        };
      case "SMART_MONEY":
        return {
          icon: "🧠",
          label: "SMART MONEY",
          style: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold",
        };
      case "HIGHLY_PROFITABLE":
      case "PROFITABLE":
        return {
          icon: "🏆",
          label: value.replace(/_/g, " "),
          style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        };
      case "HIGHLY_UNPROFITABLE":
      case "UNPROFITABLE":
        return {
          icon: "🔻",
          label: value.replace(/_/g, " "),
          style: "bg-rose-500/10 text-rose-400 border-rose-500/30",
        };
      case "BREAK_EVEN":
        return {
          icon: "⚖️",
          label: "BREAK EVEN",
          style: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        };
      case "SCALPER":
        return {
          icon: "⚡",
          label: "SCALPER",
          style: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
        };
      case "SHORT_TERM_TRADER":
        return {
          icon: "⏱️",
          label: "SHORT TERM",
          style: "bg-sky-500/10 text-sky-400 border-sky-500/30",
        };
      case "SWING_TRADER":
        return {
          icon: "🌊",
          label: "SWING TRADER",
          style: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
        };
      case "HOLDER":
        return {
          icon: "💎",
          label: "HOLDER",
          style: "bg-violet-500/10 text-violet-400 border-violet-500/30",
        };
      default:
        return {
          icon: "",
          label: value.replace(/_/g, " "),
          style: "bg-slate-800 text-slate-300 border-slate-700",
        };
    }
  };

  const { icon, label, style } = getBadgeDetails();

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border uppercase tracking-wider ${style}`}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
    </span>
  );
}
