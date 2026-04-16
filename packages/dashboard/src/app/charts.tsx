'use client'
/**
 * Client-side recharts visualisations. Server components pass already-shaped
 * data; this module only handles rendering.
 */

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const PALETTE = [
  '#007aff',
  '#34c759',
  '#ff9500',
  '#af52de',
  '#ff3b30',
  '#5ac8fa',
  '#ffcc00',
  '#a2845e',
]

export interface TimeSeriesPoint {
  bucket: string
  calls: number
  tokens: number
}

export function CallsOverTime({ data }: { data: TimeSeriesPoint[] }) {
  if (data.length === 0) {
    return <Empty message="Once Scouts start emitting events this will fill in automatically." />
  }
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e5e5ea" strokeDasharray="3 3" />
          <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#86868b' }} />
          <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#86868b' }} />
          <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: '#86868b' }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="l"
            type="monotone"
            dataKey="calls"
            stroke="#007aff"
            strokeWidth={2}
            dot={false}
            name="Calls"
          />
          <Line
            yAxisId="r"
            type="monotone"
            dataKey="tokens"
            stroke="#ff9500"
            strokeWidth={2}
            dot={false}
            name="Tokens"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface ProviderBarPoint {
  provider: string
  calls: number
  tokens: number
}

export function ProviderBar({ data }: { data: ProviderBarPoint[] }) {
  if (data.length === 0) return <Empty message="No provider data yet." />
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e5e5ea" strokeDasharray="3 3" />
          <XAxis dataKey="provider" tick={{ fontSize: 11, fill: '#86868b' }} />
          <YAxis tick={{ fontSize: 11, fill: '#86868b' }} />
          <Tooltip />
          <Bar dataKey="calls" name="Calls" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export interface DeptPiePoint {
  name: string
  value: number
}

export function DeptPie({ data }: { data: DeptPiePoint[] }) {
  if (data.length === 0) return <Empty message="Tag events with a department to see the split." />
  return (
    <div style={{ width: '100%', height: 240 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={90}
            innerRadius={50}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div
      style={{
        height: 240,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#86868b',
        fontSize: 13,
        border: '1px dashed #e5e5ea',
        borderRadius: 10,
      }}
    >
      {message}
    </div>
  )
}
