import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  BarChart2, Download, RefreshCw, TrendingUp, ShoppingCart,
  Package, Calendar, FileText, FileSpreadsheet
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { Button } from '../components/ui/Button'
import { PageLoader } from '../components/ui/Misc'
import * as svc from '../api/services'
import { downloadFile } from '../utils/downloadFile'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`

const COLORS = ['#0D8585', '#34C5A5', '#5B8DEF', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

const PAYMENT_LABELS = {
  cash:      'Efectivo',
  transfer:  'Transferencia',
  card:      'Tarjeta',
  debit:     'Débito',
  credit:    'Crédito',
  nequi:     'Nequi',
  daviplata: 'Daviplata',
  other:     'Otro',
  mixed:     'Mixto',
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-tooltip">
      <p className="text-luma-faint text-[10px] mb-1">{label}</p>
      <p className="font-semibold text-[13px] text-luma-text">
        {typeof payload[0].value === 'number' && payload[0].value > 1000
          ? fmt(payload[0].value) : payload[0].value}
      </p>
    </div>
  )
}

export default function Reportes() {
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [range,   setRange]   = useState(30) // días
  const [tab,     setTab]     = useState('sales') // sales | inventory

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await svc.getSalesReport({ days: range })
      setReport(data)
    } catch { toast.error('Error cargando reportes') }
    finally { setLoading(false) }
  }, [range])

  useEffect(() => { load() }, [load])

  const [exporting, setExporting] = useState(false)

  const downloadReport = async (format = 'xlsx') => {
    setExporting(true)
    try {
      const ext      = format === 'xlsx' ? 'xlsx' : 'csv'
      const filename = `reporte-ventas-${range}d-${new Date().toISOString().split('T')[0]}.${ext}`
      await downloadFile('/api/v1/reports/export/sales/', { file_format: format, days: range }, filename)
      toast.success(`Reporte ${ext.toUpperCase()} descargado`)
    } catch (err) {
      if (err?.status === 401) {
        toast.error('Sesión expirada. Vuelve a iniciar sesión.')
      } else if (err?.status === 500) {
        toast.error('Error en el servidor al generar el reporte')
      } else {
        toast.error('Error al exportar el reporte')
      }
    } finally { setExporting(false) }
  }

  if (loading) return <PageLoader />

  const salesChart = (report?.sales_by_day || []).map(d => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
  }))

  const categoryChart = report?.sales_by_category || []
  const topProducts   = report?.top_products || []
  const paymentChart  = report?.payment_methods || []
  const dailyAvg      = report?.daily_average || 0
  const totalRevenue  = report?.total_revenue || 0
  const totalSales    = report?.total_sales || 0
  const topProduct    = topProducts[0]

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="page-title">Reportes</h2>
          <p className="text-[13px] text-luma-muted mt-0.5">
            Análisis de los últimos {range} días
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Range selector */}
          <div className="flex gap-1 bg-cream-200 p-0.5 rounded-xl">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all
                  ${range === d ? 'bg-white text-teal-600 shadow-sm' : 'text-luma-muted'}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" icon={FileSpreadsheet} loading={exporting} onClick={() => downloadReport('xlsx')}>
            Excel
          </Button>
          <Button variant="outline" size="sm" icon={FileText} loading={exporting} onClick={() => downloadReport('csv')}>
            CSV
          </Button>
          <button onClick={load} className="btn-ghost"><RefreshCw size={15} /></button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ingresos totales', value: fmt(totalRevenue), icon: TrendingUp, color: 'text-teal-600' },
          { label: 'Nº de ventas',     value: totalSales,           icon: ShoppingCart, color: 'text-blue-600' },
          { label: 'Promedio diario',  value: fmt(dailyAvg),        icon: Calendar,     color: 'text-amber-600' },
          { label: 'Producto líder',   value: topProduct?.name || '—', icon: Package,  color: 'text-luma-text' },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <div className="flex items-center gap-2 mb-1">
              <k.icon size={14} className="text-luma-faint" />
              <p className="section-label">{k.label}</p>
            </div>
            <p className={`text-xl font-bold mt-1 ${k.color} truncate`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-cream-200 p-0.5 rounded-xl w-fit">
        {[
          { id: 'sales',     label: 'Ventas' },
          { id: 'inventory', label: 'Inventario' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-all
              ${tab === t.id ? 'bg-white text-teal-600 shadow-sm' : 'text-luma-muted'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales' && (
        <>
          {/* Daily sales chart */}
          <div className="card p-5">
            <h3 className="text-[14px] font-semibold text-luma-text mb-4">Ingresos por día</h3>
            {salesChart.length === 0 ? (
              <p className="text-center text-luma-faint py-8 text-[12px]">Sin datos de ventas en el período</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={salesChart} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#A1A1AA' }} axisLine={false} tickLine={false} interval={Math.floor(salesChart.length / 6)} />
                  <YAxis tick={{ fontSize: 10, fill: '#A1A1AA' }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(13,133,133,0.06)', radius: 4 }} />
                  <Bar dataKey="total" fill="#0D8585" radius={[4,4,0,0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Payment methods + Category */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Payment methods */}
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold text-luma-text mb-4">Métodos de pago</h3>
              {paymentChart.length === 0 ? (
                <p className="text-center text-luma-faint py-8 text-[12px]">Sin datos</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={160}>
                    <PieChart>
                      <Pie
                        data={paymentChart.map(p => ({ ...p, name: PAYMENT_LABELS[p.payment_method] || p.payment_method }))}
                        dataKey="count"
                        nameKey="name"
                        cx="50%" cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                      >
                        {paymentChart.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {paymentChart.map((p, i) => (
                      <div key={p.payment_method} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                        <div>
                          <p className="text-[12px] font-semibold">{PAYMENT_LABELS[p.payment_method] || p.payment_method}</p>
                          <p className="text-[11px] text-luma-faint">{p.count} ventas · {fmt(p.total)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top Products */}
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold text-luma-text mb-4">Top 5 productos</h3>
              {topProducts.length === 0 ? (
                <p className="text-center text-luma-faint py-8 text-[12px]">Sin ventas en el período</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.slice(0, 5).map((p, i) => {
                    const maxRevenue = topProducts[0]?.revenue || 1
                    const pct = Math.round((p.revenue / maxRevenue) * 100)
                    return (
                      <div key={p.product_id || i} className="flex items-center gap-3">
                        <span className="text-[11px] text-luma-faint w-4 font-bold">#{i+1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold truncate">{p.name}</p>
                          <div className="h-1.5 bg-cream-200 rounded-full mt-1 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: COLORS[i] }}
                            />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[12px] font-bold">{fmt(p.revenue)}</p>
                          <p className="text-[10px] text-luma-faint">{p.units_sold} ud.</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {tab === 'inventory' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Category distribution */}
          <div className="card p-5">
            <h3 className="text-[14px] font-semibold text-luma-text mb-4">Ventas por categoría</h3>
            {categoryChart.length === 0 ? (
              <p className="text-center text-luma-faint py-8 text-[12px]">Sin datos de categorías</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={categoryChart} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#A1A1AA' }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: '#52525B' }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="revenue" fill="#0D8585" radius={[0,4,4,0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Stock summary */}
          <div className="card p-5">
            <h3 className="text-[14px] font-semibold text-luma-text mb-4">Estado del inventario</h3>
            <div className="space-y-4">
              {[
                { label: 'Total unidades en stock',  value: report?.total_stock || 0, color: 'teal' },
                { label: 'Variantes agotadas',       value: report?.out_of_stock || 0, color: 'red' },
                { label: 'Variantes con stock bajo', value: report?.low_stock || 0, color: 'amber' },
                { label: 'Valor total del inventario', value: fmt(report?.inventory_value || 0), color: 'teal' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-2.5 border-b border-luma-border last:border-0">
                  <p className="text-[13px] text-luma-muted">{s.label}</p>
                  <p className={`font-bold text-[14px] ${
                    s.color === 'teal' ? 'text-teal-600' :
                    s.color === 'red'  ? 'text-red-500' : 'text-amber-600'
                  }`}>{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
