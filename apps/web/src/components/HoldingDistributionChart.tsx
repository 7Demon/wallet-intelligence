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
      <div className="h-64 flex items-center justify-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-lg">
        No completed trades to compute holding period distribution.
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="bucket"
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#334155" }}
            fontFamily="monospace"
          />
          <YAxis
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: "#334155" }}
            fontFamily="monospace"
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              borderColor: "#334155",
              borderRadius: "0.5rem",
              fontSize: "12px",
              fontFamily: "monospace",
              color: "#f8fafc",
            }}
            cursor={{ fill: "rgba(139, 92, 246, 0.08)" }}
            formatter={(value: any) => [`${value} closed trades`, "Count"]}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={index < 2 ? "#06b6d4" : index < 4 ? "#3b82f6" : index < 6 ? "#8b5cf6" : "#a855f7"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
