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
          dotColor: "bg-purple-400",
          label: "Whale",
          style: "bg-purple-500/10 text-purple-300 border-purple-500/20",
        };
      case "DOLPHIN":
      case "MEDIUM":
        return {
          dotColor: "bg-blue-400",
          label: "Dolphin",
          style: "bg-blue-500/10 text-blue-300 border-blue-500/20",
        };
      case "FISH":
      case "SMALL":
        return {
          dotColor: "bg-zinc-400",
          label: "Fish",
          style: "bg-zinc-800 text-zinc-300 border-zinc-700/60",
        };
      case "SHRIMP":
      case "MICRO":
        return {
          dotColor: "bg-zinc-500",
          label: "Shrimp",
          style: "bg-zinc-800/80 text-zinc-400 border-zinc-800",
        };
      case "SMART_MONEY":
        return {
          dotColor: "bg-emerald-400",
          label: "Smart Money",
          style: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25 font-semibold",
        };
      case "HIGHLY_PROFITABLE":
      case "PROFITABLE":
        return {
          dotColor: "bg-emerald-400",
          label: value === "HIGHLY_PROFITABLE" ? "High Profit" : "Profitable",
          style: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        };
      case "HIGHLY_UNPROFITABLE":
      case "UNPROFITABLE":
        return {
          dotColor: "bg-rose-400",
          label: value === "HIGHLY_UNPROFITABLE" ? "Heavy Loss" : "Unprofitable",
          style: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        };
      case "BREAK_EVEN":
        return {
          dotColor: "bg-amber-400",
          label: "Break Even",
          style: "bg-amber-500/10 text-amber-300 border-amber-500/20",
        };
      case "SCALPER":
        return {
          dotColor: "bg-sky-400",
          label: "Scalper",
          style: "bg-sky-500/10 text-sky-300 border-sky-500/20",
        };
      case "SHORT_TERM_TRADER":
        return {
          dotColor: "bg-sky-400",
          label: "Short Term",
          style: "bg-sky-500/10 text-sky-300 border-sky-500/20",
        };
      case "SWING_TRADER":
        return {
          dotColor: "bg-indigo-400",
          label: "Swing Trader",
          style: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
        };
      case "HOLDER":
        return {
          dotColor: "bg-teal-400",
          label: "Position Holder",
          style: "bg-teal-500/10 text-teal-300 border-teal-500/20",
        };
      default:
        return {
          dotColor: "bg-zinc-400",
          label: value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
          style: "bg-zinc-800 text-zinc-300 border-zinc-700/60",
        };
    }
  };

  const { dotColor, label, style } = getBadgeDetails();

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-sans font-medium border tracking-tight ${style}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span>{label}</span>
    </span>
  );
}

