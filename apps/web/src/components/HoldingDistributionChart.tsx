"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { HoldingBucket } from "@/lib/api";

interface Props {
  data: HoldingBucket[];
}

export function HoldingDistributionChart({ data }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-64 flex items-center justify-center text-slate-500 font-mono text-xs">Loading chart...</div>;
  }

  const hasData = data && data.some((item) => item.count > 0);

  if (!hasData) {
    return (
      <div className="h-64 flex items-center justify-center text-zinc-500 font-sans text-xs border border-dashed border-zinc-800 rounded-xl">
        No completed trades to compute holding period distribution.
      </div>
    );
  }

  return (
    <div className="w-full h-64 font-sans">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="bucket"
            stroke="#71717a"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#27272a" }}
            fontFamily="monospace"
          />
          <YAxis
            stroke="#71717a"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#27272a" }}
            fontFamily="monospace"
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              borderColor: "#27272a",
              borderRadius: "0.5rem",
              fontSize: "12px",
              fontFamily: "sans-serif",
              color: "#f4f4f5",
            }}
            cursor={{ fill: "rgba(255, 255, 255, 0.04)" }}
            formatter={(value: any) => [`${value} closed trades`, "Trades"]}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#3b82f6" opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
