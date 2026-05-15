'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface LeadRow {
  id: string;
  data_entrada_etapa: string;
  classificacao: string;
}

interface PipelineChartProps {
  leads: LeadRow[];
}

export default function PipelineChart({ leads }: PipelineChartProps) {
  const chartData = useMemo(() => {
    // Group leads by week for the last 8 weeks
    const now = new Date();
    const weeks: { label: string; total: number; quentes: number; mornos: number; frios: number }[] = [];

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      const weekLeads = leads.filter(l => {
        if (!l.data_entrada_etapa) return false;
        const d = new Date(l.data_entrada_etapa);
        return d >= weekStart && d < weekEnd;
      });

      const day = weekStart.getDate().toString().padStart(2, '0');
      const month = (weekStart.getMonth() + 1).toString().padStart(2, '0');

      weeks.push({
        label: `${day}/${month}`,
        total: weekLeads.length,
        quentes: weekLeads.filter(l => l.classificacao === 'QUENTE').length,
        mornos: weekLeads.filter(l => l.classificacao === 'MORNO').length,
        frios: weekLeads.filter(l => l.classificacao === 'FRIO').length,
      });
    }

    return weeks;
  }, [leads]);

  const hasData = chartData.some(d => d.total > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600 text-sm">Sem dados suficientes para gerar o gráfico</p>
      </div>
    );
  }

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={100}>
        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradQuentes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="label"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0d1117',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              boxShadow: '0 15px 35px rgba(0,0,0,0.5)',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#9ca3af', fontWeight: 700, marginBottom: 4 }}
            itemStyle={{ color: '#e5e7eb', padding: 2 }}
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Total"
            stroke="#6366f1"
            strokeWidth={2}
            fill="url(#gradTotal)"
          />
          <Area
            type="monotone"
            dataKey="quentes"
            name="Quentes"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#gradQuentes)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
