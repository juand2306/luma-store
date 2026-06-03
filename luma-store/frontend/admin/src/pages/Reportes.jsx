import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  BarChart2, RefreshCw, TrendingUp, ShoppingCart, Package, Calendar,
  FileText, FileSpreadsheet, Printer, Users, Landmark,
  AlertTriangle, SlidersHorizontal,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { Button }     from '../components/ui/Button'
import { PageLoader } from '../components/ui/Misc'
import { Badge }      from '../components/ui/Badge'
import * as svc       from '../api/services'
import { downloadFile } from '../utils/downloadFile'
import { printReport }  from '../utils/printReport'
import { usePaymentMethods } from '../hooks/usePaymentMethods'

// ─── helpers ────────────────────────────────────────────────
const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`

const COLORS = ['#0D8585','#34C5A5','#5B8DEF','#F59E0B','#EF4444','#8B5CF6','#EC4899']

// PAYMENT_LABELS se obtiene dinámicamente desde el hook usePaymentMethods

const SEGMENT_LABELS = { new:'Nuevo', frequent:'Frecuente', regular:'Regular', inactive:'Inactivo' }

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

// ─── RangePicker ────────────────────────────────────────────
function RangePicker({ value, onChange }) {
  return (
    <div className="flex gap-1 bg-cream-200 p-0.5 rounded-xl">
      {[7, 30, 90].map(d => (
        <button key={d} onClick={() => onChange(d)}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all
            ${value === d ? 'bg-white text-teal-600 shadow-sm' : 'text-luma-muted'}`}>
          {d}d
        </button>
      ))}
    </div>
  )
}

// ─── ExportBar ──────────────────────────────────────────────
function ExportBar({ onExcel, onCsv, onPdf, onRefresh, loading }) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <Button variant="outline" size="sm" icon={FileSpreadsheet} loading={loading} onClick={onExcel}>
        <span className="hidden sm:inline">Excel</span>
      </Button>
      <Button variant="outline" size="sm" icon={FileText} loading={loading} onClick={onCsv}>
        <span className="hidden sm:inline">CSV</span>
      </Button>
      <Button variant="outline" size="sm" icon={Printer} onClick={onPdf}>
        <span className="hidden sm:inline">PDF</span>
      </Button>
      <div className="w-px h-5 bg-luma-border mx-0.5" />
      <button onClick={onRefresh} className="btn-ghost p-2" title="Actualizar">
        <RefreshCw size={15}/>
      </button>
    </div>
  )
}

// ─── KPI card ───────────────────────────────────────────────
const KPI_STYLES = {
  'text-teal-600':  { bg: 'bg-teal-50',   ic: 'text-teal-500'  },
  'text-blue-600':  { bg: 'bg-blue-50',   ic: 'text-blue-500'  },
  'text-amber-600': { bg: 'bg-amber-50',  ic: 'text-amber-500' },
  'text-red-500':   { bg: 'bg-red-50',    ic: 'text-red-400'   },
  'text-green-600': { bg: 'bg-green-50',  ic: 'text-green-500' },
  'text-luma-text': { bg: 'bg-cream-200', ic: 'text-luma-muted'},
}

function KpiCard({ label, value, icon: Icon, color = 'text-teal-600', pulse = false }) {
  const { bg, ic } = KPI_STYLES[color] || { bg: 'bg-cream-200', ic: 'text-luma-muted' }
  return (
    <div className="card p-4 flex items-center gap-3 hover:shadow-card-md transition-all duration-200">
      {Icon && (
        <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <Icon size={17} className={ic} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="section-label">{label}</p>
        <p className={`text-[19px] font-bold leading-tight mt-0.5 truncate ${color}`}>{value}</p>
      </div>
      {pulse && <span className="ml-auto w-2 h-2 bg-amber-400 rounded-full animate-pulse flex-shrink-0" />}
    </div>
  )
}

// ─── TOP PRODUCTS mini bar ───────────────────────────────────
function TopProductsBar({ products }) {
  if (!products?.length)
    return <p className="text-center text-luma-faint py-8 text-[12px]">Sin ventas en el período</p>
  const max = products[0]?.revenue || 1
  return (
    <div className="space-y-3">
      {products.slice(0,8).map((p,i) => (
        <div key={p.product_id ?? i} className="flex items-center gap-3">
          <span className="text-[11px] text-luma-faint w-4 font-bold">#{i+1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold truncate">{p.name}</p>
            <div className="h-1.5 bg-cream-200 rounded-full mt-1 overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width:`${Math.round(p.revenue/max*100)}%`, background:COLORS[i%COLORS.length] }}/>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-[12px] font-bold">{fmt(p.revenue)}</p>
            <p className="text-[10px] text-luma-faint">{p.units_sold} ud.</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TAB: VENTAS
// ═══════════════════════════════════════════════════════════
function TabVentas({ days, onDaysChange }) {
  const [data,       setData]      = useState(null)
  const [loading,    setLoading]   = useState(true)
  const [exporting,  setExporting] = useState(false)
  const [payment,    setPayment]   = useState('')
  const [fromDate,   setFromDate]  = useState('')
  const [toDate,     setToDate]    = useState('')
  const { methods, labelsMap: PAYMENT_LABELS } = usePaymentMethods()

  // Build query params: custom date range takes priority over `days`
  const buildParams = useCallback(() => {
    const params = {}
    if (fromDate && toDate) {
      params.from_date = fromDate
      params.to_date   = toDate
    } else {
      params.days = days
    }
    if (payment) params.payment_method = payment
    return params
  }, [days, payment, fromDate, toDate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: d } = await svc.getSalesReport(buildParams())
      setData(d)
    } catch { toast.error('Error cargando reporte de ventas') }
    finally { setLoading(false) }
  }, [buildParams])

  useEffect(() => { load() }, [load])

  const doExport = async (format) => {
    setExporting(true)
    try {
      await downloadFile('/api/v1/reports/export/sales/', { file_format: format, ...buildParams() })
      toast.success(format === 'csv' ? 'CSV descargado' : 'Excel descargado')
    } catch { toast.error('Error al exportar') }
    finally { setExporting(false) }
  }

  const doPdf = () => {
    if (!data) return
    const topRows = (data.top_products||[]).map((p,i) => [i+1, p.name, p.units_sold, p.revenue])
    const payRows = (data.payment_methods||[]).map(p => [
      PAYMENT_LABELS[p.payment_method]||p.payment_method, p.count, p.total
    ])
    const catRows = (data.sales_by_category||[]).map(c => [c.category, c.count, c.revenue])
    printReport({
      title: `Reporte de Ventas — últimos ${days} días`,
      storeName: '',
      subtitle: payment ? `Filtro: ${PAYMENT_LABELS[payment]||payment}` : 'Todos los métodos',
      sections: [
        {
          title: 'Top Productos por Ingresos',
          headers: ['#','Producto','Unidades','Ingresos'],
          rows: topRows,
          moneyColumns: [3],
        },
        {
          title: 'Métodos de Pago',
          headers: ['Método','Ventas','Total'],
          rows: payRows,
          moneyColumns: [2],
        },
        {
          title: 'Ventas por Categoría',
          headers: ['Categoría','Items','Total'],
          rows: catRows,
          moneyColumns: [2],
        },
      ],
    })
  }

  const salesChart = (data?.sales_by_day||[]).map(d => ({
    ...d,
    // IMPORTANTE: agregar T12:00:00 evita que el navegador parsee la fecha
    // como UTC midnight y la desplace al día anterior en timezones UTC-N.
    label: new Date(d.date + 'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short'}),
  }))

  return (
    <div className="space-y-5">
      {/* Sub-toolbar */}
      <div className="card p-3 flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <RangePicker value={fromDate ? null : days} onChange={(d) => { onDaysChange(d); setFromDate(''); setToDate('') }}/>
          {/* Custom date range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="input-base w-36 text-[12px]"
              title="Desde"
            />
            <span className="text-[11px] text-luma-faint">–</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="input-base w-36 text-[12px]"
              title="Hasta"
            />
            {(fromDate || toDate) && (
              <button onClick={() => { setFromDate(''); setToDate('') }} className="text-xs text-luma-faint hover:text-red-500 px-1" title="Limpiar">✕</button>
            )}
          </div>
          <div className="relative">
            <SlidersHorizontal size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
            <select value={payment} onChange={e=>setPayment(e.target.value)} className="input-base !pl-9 w-full sm:w-44 appearance-none">
              <option value="">Todos los métodos</option>
              {methods.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
        </div>
        <ExportBar loading={exporting} onExcel={()=>doExport('xlsx')} onCsv={()=>doExport('csv')} onPdf={doPdf} onRefresh={load}/>
      </div>

      {loading ? <PageLoader/> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Ingresos totales"  value={fmt(data?.total_revenue)} icon={TrendingUp}  color="text-teal-600"/>
            <KpiCard label="Nº de ventas"       value={data?.total_sales??0}    icon={ShoppingCart} color="text-blue-600"/>
            <KpiCard label="Promedio diario"    value={fmt(data?.daily_average)} icon={Calendar}    color="text-amber-600"/>
            <KpiCard label="Producto líder"     value={data?.top_products?.[0]?.name||'—'} icon={Package} color="text-luma-text"/>
          </div>

          {/* Gráfica diaria */}
          <div className="card p-5">
            <h3 className="text-[14px] font-semibold text-luma-text mb-4">Ingresos por día</h3>
            {salesChart.length===0
              ? <p className="text-center text-luma-faint py-8 text-[12px]">Sin datos en el período</p>
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={salesChart} margin={{left:-10}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D9" vertical={false}/>
                    <XAxis dataKey="label" tick={{fontSize:10,fill:'#A1A1AA'}} axisLine={false} tickLine={false}
                      interval={Math.floor(salesChart.length/6)}/>
                    <YAxis tick={{fontSize:10,fill:'#A1A1AA'}} axisLine={false} tickLine={false}
                      tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                    <Tooltip content={<CustomTooltip/>} cursor={{fill:'rgba(13,133,133,0.06)',radius:4}}/>
                    <Bar dataKey="total" fill="#0D8585" radius={[4,4,0,0]} maxBarSize={40}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>

          {/* Métodos + Top productos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold text-luma-text mb-4">Métodos de pago</h3>
              {!(data?.payment_methods?.length)
                ? <p className="text-center text-luma-faint py-8 text-[12px]">Sin datos</p>
                : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={160}>
                      <PieChart>
                        <Pie data={data.payment_methods.map(p=>({...p,name:PAYMENT_LABELS[p.payment_method]||p.payment_method}))}
                          dataKey="count" nameKey="name" cx="50%" cy="50%"
                          innerRadius={45} outerRadius={70} paddingAngle={3}>
                          {data.payment_methods.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                        </Pie>
                        <Tooltip/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {data.payment_methods.map((p,i)=>(
                        <div key={p.payment_method} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:COLORS[i%COLORS.length]}}/>
                          <div>
                            <p className="text-[12px] font-semibold">{PAYMENT_LABELS[p.payment_method]||p.payment_method}</p>
                            <p className="text-[11px] text-luma-faint">{p.count} ventas · {fmt(p.total)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold text-luma-text mb-4">Top productos</h3>
              <TopProductsBar products={data?.top_products}/>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TAB: INVENTARIO
// ═══════════════════════════════════════════════════════════
function TabInventario() {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const [category,  setCategory]  = useState('')
  const [status,    setStatus]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (category) params.category = category
      if (status)   params.status   = status
      const { data: d } = await svc.getInventoryReport(params)
      setData(d)
    } catch { toast.error('Error cargando inventario') }
    finally { setLoading(false) }
  }, [category, status])

  useEffect(() => { load() }, [load])

  const doExport = async (format) => {
    setExporting(true)
    try {
      const params = { file_format: format }
      if (category) params.category = category
      if (status)   params.status   = status
      await downloadFile('/api/v1/reports/export/inventory/', params)
      toast.success('Descargado')
    } catch { toast.error('Error al exportar') }
    finally { setExporting(false) }
  }

  const doPdf = () => {
    if (!data) return
    printReport({
      title: 'Reporte de Inventario',
      storeName: '',
      subtitle: [
        category ? `Cat: ${data.categories?.find(c=>String(c.id)===category)?.name||category}` : '',
        status    ? `Estado: ${status}` : '',
      ].filter(Boolean).join(' · ') || 'Todos los productos',
      sections: [{
        title: 'Productos en Inventario',
        headers: ['#','Producto','Categoría','Estado','Stock','Precio','Valor Stock','Stock Mín.'],
        rows: (data.products||[]).map((p,i)=>[i+1,p.name,p.category,p.status,p.stock,p.price,p.sale_value,p.min_stock]),
        moneyColumns: [5,6],
      }],
    })
  }

  return (
    <div className="space-y-5">
      {/* Sub-toolbar */}
      <div className="card p-3 flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <SlidersHorizontal size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
            <select value={category} onChange={e=>setCategory(e.target.value)} className="input-base !pl-9 w-full sm:w-44 appearance-none">
              <option value="">Todas las categorías</option>
              {(data?.categories||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="relative">
            <SlidersHorizontal size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
            <select value={status} onChange={e=>setStatus(e.target.value)} className="input-base !pl-9 w-full sm:w-40 appearance-none">
              <option value="">Todos los estados</option>
              <option value="active">Activo</option>
              <option value="out">Agotado</option>
              <option value="inactive">Inactivo</option>
            </select>
          </div>
        </div>
        <ExportBar loading={exporting} onExcel={()=>doExport('xlsx')} onCsv={()=>doExport('csv')} onPdf={doPdf} onRefresh={load}/>
      </div>

      {loading ? <PageLoader/> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Productos"          value={data?.total_products??0}          icon={Package}     color="text-teal-600"/>
            <KpiCard label="Stock total"         value={data?.total_stock??0}             icon={BarChart2}   color="text-blue-600"/>
            <KpiCard label="Valor de venta"      value={fmt(data?.total_sale_value)}      icon={TrendingUp}  color="text-teal-600"/>
            <KpiCard label="Margen potencial"    value={fmt(data?.potential_margin)}      icon={TrendingUp}  color="text-green-600"/>
          </div>

          {/* Alertas rápidas */}
          {(data?.out_of_stock > 0 || data?.low_stock > 0) && (
            <div className="flex gap-3 flex-wrap">
              {data.out_of_stock > 0 && (
                <div className="card p-3 flex items-center gap-2.5 relative overflow-hidden ring-1 ring-red-200 bg-gradient-to-br from-red-50/50 to-white flex-1 min-w-[200px]">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 rounded-l-xl" />
                  <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={14} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-red-700">
                      {data.out_of_stock} producto{data.out_of_stock > 1 ? 's' : ''} agotado{data.out_of_stock > 1 ? 's' : ''}
                    </p>
                    <p className="text-[10px] text-red-500">Sin stock disponible</p>
                  </div>
                </div>
              )}
              {data.low_stock > 0 && (
                <div className="card p-3 flex items-center gap-2.5 relative overflow-hidden ring-1 ring-amber-200 bg-gradient-to-br from-amber-50/50 to-white flex-1 min-w-[200px]">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 rounded-l-xl" />
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={14} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-amber-700">
                      {data.low_stock} producto{data.low_stock > 1 ? 's' : ''} con stock bajo
                    </p>
                    <p className="text-[10px] text-amber-500">Revisar reabastecimiento</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tabla de productos */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="luma-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="hidden sm:table-cell">Categoría</th>
                    <th>Estado</th>
                    <th className="text-right">Stock</th>
                    <th className="hidden md:table-cell text-right">Precio</th>
                    <th className="text-right">Valor stock</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.products||[]).map(p => (
                    <tr key={p.id}>
                      <td className="font-semibold text-[13px]">{p.name}</td>
                      <td className="hidden sm:table-cell text-[12px] text-luma-muted">{p.category}</td>
                      <td>
                        <Badge variant={p.status==='active'?'teal':p.status==='out'?'red':'gray'} dot>
                          {p.status==='active'?'Activo':p.status==='out'?'Agotado':'Inactivo'}
                        </Badge>
                      </td>
                      <td className={`text-right font-semibold text-[13px] ${p.stock===0?'text-red-500':p.stock<=p.min_stock?'text-amber-600':'text-luma-text'}`}>
                        {p.stock}
                      </td>
                      <td className="hidden md:table-cell text-right text-[13px]">{fmt(p.price)}</td>
                      <td className="text-right font-semibold text-[13px] text-teal-600">{fmt(p.sale_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TAB: PRODUCTOS
// ═══════════════════════════════════════════════════════════
function TabProductos({ days, onDaysChange }) {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const [category,  setCategory]  = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { days }
      if (category) params.category = category
      const { data: d } = await svc.getProductsReport(params)
      setData(d)
    } catch { toast.error('Error cargando reporte de productos') }
    finally { setLoading(false) }
  }, [days, category])

  useEffect(() => { load() }, [load])

  const doExport = async (format) => {
    setExporting(true)
    try {
      const params = { file_format: format, days }
      if (category) params.category = category
      await downloadFile('/api/v1/reports/export/products/', params)
      toast.success('Descargado')
    } catch { toast.error('Error al exportar') }
    finally { setExporting(false) }
  }

  const doPdf = () => {
    if (!data) return
    printReport({
      title: `Reporte de Productos — últimos ${days} días`,
      storeName: '',
      subtitle: 'Top ventas y productos lentos',
      sections: [
        {
          title: 'Top por Ingresos',
          headers: ['#','Producto','Categoría','Unidades','Ingresos'],
          rows: (data.top_by_revenue||[]).map((p,i)=>[i+1,p.name,p.category,p.units_sold,p.revenue]),
          moneyColumns: [4],
        },
        {
          title: 'Top por Unidades Vendidas',
          headers: ['#','Producto','Unidades','Ingresos'],
          rows: (data.top_by_units||[]).map((p,i)=>[i+1,p.name,p.units_sold,p.revenue]),
          moneyColumns: [3],
        },
        {
          title: 'Productos sin Movimiento (stock en bodega)',
          headers: ['Producto','Stock','Precio'],
          rows: (data.slow_movers||[]).map(p=>[p.name,p.stock,p.price]),
          moneyColumns: [2],
        },
      ],
    })
  }

  const catChart = (data?.by_category||[]).map(c=>({
    ...c,
    category: c.category?.length>15 ? c.category.slice(0,13)+'…' : c.category,
  }))

  return (
    <div className="space-y-5">
      <div className="card p-3 flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <RangePicker value={days} onChange={onDaysChange}/>
          <div className="relative">
            <SlidersHorizontal size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-luma-faint pointer-events-none z-10" />
            <select value={category} onChange={e=>setCategory(e.target.value)} className="input-base !pl-9 w-full sm:w-44 appearance-none">
              <option value="">Todas las categorías</option>
              {(data?.categories||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <ExportBar loading={exporting} onExcel={()=>doExport('xlsx')} onCsv={()=>doExport('csv')} onPdf={doPdf} onRefresh={load}/>
      </div>

      {loading ? <PageLoader/> : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top por ingresos */}
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold text-luma-text mb-4">Top productos por ingresos</h3>
              <TopProductsBar products={data?.top_by_revenue}/>
            </div>

            {/* Top por unidades */}
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold text-luma-text mb-4">Top productos por unidades</h3>
              {!(data?.top_by_units?.length)
                ? <p className="text-center text-luma-faint py-8 text-[12px]">Sin datos</p>
                : (
                  <div className="space-y-2">
                    {data.top_by_units.slice(0,8).map((p,i)=>(
                      <div key={p.product_id??i} className="flex items-center justify-between py-1.5 border-b border-luma-border last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] text-luma-faint font-bold w-4">#{i+1}</span>
                          <p className="text-[12px] font-semibold truncate">{p.name}</p>
                        </div>
                        <span className="text-[13px] font-bold text-teal-600 flex-shrink-0 ml-2">{p.units_sold} ud.</span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* Por categoría */}
          <div className="card p-5">
            <h3 className="text-[14px] font-semibold text-luma-text mb-4">Ventas por categoría</h3>
            {!catChart.length
              ? <p className="text-center text-luma-faint py-8 text-[12px]">Sin datos de categorías</p>
              : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={catChart} layout="vertical" margin={{left:10}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E4E0D9" horizontal={false}/>
                    <XAxis type="number" tick={{fontSize:10,fill:'#A1A1AA'}} axisLine={false} tickLine={false}
                      tickFormatter={v=>fmt(v)}/>
                    <YAxis type="category" dataKey="category" tick={{fontSize:11,fill:'#52525B'}}
                      axisLine={false} tickLine={false} width={90}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Bar dataKey="revenue" fill="#0D8585" radius={[0,4,4,0]} maxBarSize={28}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>

          {/* Productos lentos */}
          {data?.slow_movers?.length > 0 && (
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold text-luma-text mb-0.5">Productos sin movimiento</h3>
              <p className="text-[11px] text-luma-faint mb-4">Con stock disponible pero sin ventas en el período</p>
              {/* Header row */}
              <div className="hidden sm:grid sm:grid-cols-3 gap-2 px-3 mb-1">
                <span className="section-label">Producto</span>
                <span className="section-label text-center">Stock</span>
                <span className="section-label text-right">Precio</span>
              </div>
              <div className="space-y-1.5">
                {data.slow_movers.map(p=>(
                  <div key={p.product_id}
                    className="flex items-center justify-between sm:grid sm:grid-cols-3 gap-2 bg-cream-100 rounded-xl px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-luma-text truncate">{p.name}</p>
                    <p className="text-[13px] font-bold text-amber-600 sm:text-center flex-shrink-0 mx-2 sm:mx-0">
                      <span className="sm:hidden text-luma-faint font-normal text-[11px]">Stock: </span>{p.stock}
                    </p>
                    <p className="text-[13px] font-semibold text-luma-text sm:text-right flex-shrink-0">
                      {fmt(p.price)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TAB: CLIENTES
// ═══════════════════════════════════════════════════════════
function TabClientes({ days, onDaysChange }) {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: d } = await svc.getCustomersReport({ days })
      setData(d)
    } catch { toast.error('Error cargando reporte de clientes') }
    finally { setLoading(false) }
  }, [days])

  useEffect(() => { load() }, [load])

  const doExport = async (format) => {
    setExporting(true)
    try {
      await downloadFile('/api/v1/reports/export/customers/', { file_format: format, days })
      toast.success('Descargado')
    } catch { toast.error('Error al exportar') }
    finally { setExporting(false) }
  }

  const doPdf = () => {
    if (!data) return
    printReport({
      title: `Reporte de Clientes — últimos ${days} días`,
      storeName: '',
      subtitle: `${data.total_customers} clientes registrados`,
      sections: [
        {
          title: 'Top Compradores del Período',
          headers: ['Nombre','Teléfono','Compras','Total Gastado'],
          rows: (data.top_buyers||[]).map(b=>[b.name,b.phone||'—',b.purchase_count,b.total_spent]),
          moneyColumns: [3],
        },
        {
          title: 'Segmentación',
          headers: ['Segmento','Cantidad'],
          rows: (data.segments||[]).map(s=>[SEGMENT_LABELS[s.segment]||s.segment, s.count]),
        },
      ],
    })
  }

  const segChartData = (data?.segments||[]).map(s=>({
    name: SEGMENT_LABELS[s.segment]||s.segment, value: s.count,
  }))

  return (
    <div className="space-y-5">
      <div className="card p-3 flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between">
        <RangePicker value={days} onChange={onDaysChange}/>
        <ExportBar loading={exporting} onExcel={()=>doExport('xlsx')} onCsv={()=>doExport('csv')} onPdf={doPdf} onRefresh={load}/>
      </div>

      {loading ? <PageLoader/> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total clientes"    value={data?.total_customers??0}                icon={Users}       color="text-teal-600"/>
            <KpiCard label={`Nuevos (${days}d)`} value={data?.new_in_period??0}                icon={Users}       color="text-blue-600"/>
            <KpiCard label={`Activos (${days}d)`} value={data?.active_in_period??0}            icon={Users}       color="text-green-600"/>
            <KpiCard label="Tasa de retención" value={`${data?.retention_rate??0}%`}           icon={TrendingUp}  color="text-amber-600"/>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Segmentos */}
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold text-luma-text mb-4">Segmentación</h3>
              {!segChartData.length
                ? <p className="text-center text-luma-faint py-8 text-[12px]">Sin datos</p>
                : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={160}>
                      <PieChart>
                        <Pie data={segChartData} dataKey="value" nameKey="name"
                          cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                          {segChartData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                        </Pie>
                        <Tooltip/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2">
                      {segChartData.map((s,i)=>(
                        <div key={s.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{background:COLORS[i%COLORS.length]}}/>
                          <p className="text-[12px] font-semibold">{s.name}</p>
                          <p className="text-[12px] text-luma-faint ml-auto">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Top compradores */}
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold text-luma-text mb-4">Top compradores del período</h3>
              {!data?.top_buyers?.length
                ? <p className="text-center text-luma-faint py-8 text-[12px]">Sin compras en el período</p>
                : (
                  <div className="space-y-2">
                    {data.top_buyers.map((b,i)=>(
                      <div key={b.customer_id} className="flex items-center justify-between py-1.5 border-b border-luma-border last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] text-luma-faint font-bold w-4">#{i+1}</span>
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold truncate">{b.name}</p>
                            {b.phone && <p className="text-[10px] text-luma-faint">{b.phone}</p>}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-[13px] font-bold text-teal-600">{fmt(b.total_spent)}</p>
                          <p className="text-[10px] text-luma-faint">{b.purchase_count} compras</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* Resumen ingresos por clientes */}
          {data?.period_revenue_total > 0 && (
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold text-luma-text mb-3">Ingresos identificados vs anónimos</h3>
              <div className="flex gap-4 flex-wrap">
                {[
                  { label: 'Con cliente identificado', value: fmt(data.period_revenue_identified), color: 'text-teal-600' },
                  { label: 'Venta anónima',             value: fmt(data.period_revenue_total - data.period_revenue_identified), color: 'text-luma-muted' },
                  { label: 'Total del período',          value: fmt(data.period_revenue_total),        color: 'text-luma-text' },
                ].map(k=>(
                  <div key={k.label} className="bg-cream-100 rounded-xl p-3 flex-1 min-w-[140px]">
                    <p className="text-[10px] text-luma-faint uppercase tracking-wide">{k.label}</p>
                    <p className={`text-[16px] font-bold mt-1 ${k.color}`}>{k.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TAB: CAJA
// ═══════════════════════════════════════════════════════════
function TabCaja({ days, onDaysChange }) {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [exporting, setExporting] = useState(false)
  const { labelsMap: PAYMENT_LABELS } = usePaymentMethods()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: d } = await svc.getCashReport({ days })
      setData(d)
    } catch { toast.error('Error cargando reporte de caja') }
    finally { setLoading(false) }
  }, [days])

  useEffect(() => { load() }, [load])

  const doExport = async (format) => {
    setExporting(true)
    try {
      await downloadFile('/api/v1/reports/export/cash/', { file_format: format, days })
      toast.success('Descargado')
    } catch { toast.error('Error al exportar') }
    finally { setExporting(false) }
  }

  const doPdf = () => {
    if (!data) return
    printReport({
      title: `Reporte de Caja — últimos ${days} días`,
      storeName: '',
      subtitle: `${data.total_sessions} sesiones`,
      sections: [
        {
          title: 'Sesiones de Caja',
          headers: ['Fecha','Estado','Apertura','Cierre','Ingresos','Gastos','Devoluciones','Neto'],
          rows: (data.sessions||[]).map(s=>[
            s.date, s.status,
            s.opening_amount, s.closing_amount??'—',
            s.income, s.expense, s.refund, s.net,
          ]),
          moneyColumns: [2,3,4,5,6,7],
        },
        {
          title: 'Por Método de Pago',
          headers: ['Método','Movimientos','Total'],
          rows: (data.by_payment_method||[]).map(p=>[
            PAYMENT_LABELS[p.payment_method]||p.payment_method, p.count, p.total,
          ]),
          moneyColumns: [2],
        },
      ],
    })
  }

  const STATUS_LABELS = { open:'Abierta', closed:'Cerrada' }

  return (
    <div className="space-y-5">
      <div className="card p-3 flex flex-col sm:flex-row gap-2.5 items-start sm:items-center justify-between">
        <RangePicker value={days} onChange={onDaysChange}/>
        <ExportBar loading={exporting} onExcel={()=>doExport('xlsx')} onCsv={()=>doExport('csv')} onPdf={doPdf} onRefresh={load}/>
      </div>

      {loading ? <PageLoader/> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Ingresos totales"   value={fmt(data?.total_income)}   icon={TrendingUp}  color="text-teal-600"/>
            <KpiCard label="Gastos"              value={fmt(data?.total_expense)}  icon={Landmark}    color="text-red-500"/>
            <KpiCard label="Devoluciones"        value={fmt(data?.total_refund)}   icon={RefreshCw}   color="text-amber-600"/>
            <KpiCard label="Neto del período"    value={fmt(data?.net_cash)}       icon={BarChart2}   color="text-blue-600"/>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Métodos de pago en caja */}
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold text-luma-text mb-4">Ingresos por método de pago</h3>
              {!data?.by_payment_method?.length
                ? <p className="text-center text-luma-faint py-8 text-[12px]">Sin datos</p>
                : (
                  <div className="space-y-2">
                    {data.by_payment_method.map((p,i)=>{
                      const total = data.total_income||1
                      const pct = Math.round(p.total/total*100)
                      return (
                        <div key={p.payment_method}>
                          <div className="flex justify-between text-[12px] mb-1">
                            <span className="font-semibold">{PAYMENT_LABELS[p.payment_method]||p.payment_method}</span>
                            <span className="text-teal-600 font-bold">{fmt(p.total)}</span>
                          </div>
                          <div className="h-1.5 bg-cream-200 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{width:`${pct}%`,background:COLORS[i%COLORS.length]}}/>
                          </div>
                          <p className="text-[10px] text-luma-faint mt-0.5">{p.count} movimientos · {pct}%</p>
                        </div>
                      )
                    })}
                  </div>
                )}
            </div>

            {/* Resumen sesiones recientes */}
            <div className="card p-5">
              <h3 className="text-[14px] font-semibold text-luma-text mb-4">Sesiones recientes</h3>
              {!data?.sessions?.length
                ? <p className="text-center text-luma-faint py-8 text-[12px]">Sin sesiones en el período</p>
                : (
                  <div className="space-y-2 overflow-y-auto max-h-64">
                    {data.sessions.slice(0,10).map(s=>(
                      <div key={s.id} className="flex items-center justify-between px-3 py-2.5 bg-cream-100 rounded-xl">
                        <div>
                          <p className="text-[12px] font-semibold">{new Date(s.date+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}</p>
                          <Badge variant={s.status==='open'?'teal':'gray'} dot>
                            {STATUS_LABELS[s.status]||s.status}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-[13px] font-bold text-teal-600">{fmt(s.income)}</p>
                          <p className="text-[10px] text-luma-faint">neto {fmt(s.net)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* Tabla completa de sesiones */}
          {data?.sessions?.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="luma-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th className="hidden sm:table-cell">Estado</th>
                      <th className="hidden md:table-cell text-right">Apertura</th>
                      <th className="text-right">Ingresos</th>
                      <th className="hidden md:table-cell text-right">Gastos</th>
                      <th className="hidden lg:table-cell text-right">Devoluciones</th>
                      <th className="text-right">Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessions.map(s=>(
                      <tr key={s.id}>
                        <td className="text-[13px]">{new Date(s.date+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}</td>
                        <td className="hidden sm:table-cell"><Badge variant={s.status==='open'?'teal':'gray'} dot>{STATUS_LABELS[s.status]||s.status}</Badge></td>
                        <td className="hidden md:table-cell text-right text-[13px]">{fmt(s.opening_amount)}</td>
                        <td className="text-right font-semibold text-[13px] text-teal-600">{fmt(s.income)}</td>
                        <td className="hidden md:table-cell text-right text-[13px] text-red-500">{fmt(s.expense)}</td>
                        <td className="hidden lg:table-cell text-right text-[13px] text-amber-600">{fmt(s.refund)}</td>
                        <td className="text-right font-bold text-[13px]">{fmt(s.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL
// ═══════════════════════════════════════════════════════════
const TABS = [
  { id: 'sales',     label: 'Ventas',     icon: TrendingUp },
  { id: 'inventory', label: 'Inventario', icon: Package    },
  { id: 'products',  label: 'Productos',  icon: BarChart2  },
  { id: 'customers', label: 'Clientes',   icon: Users      },
  { id: 'cash',      label: 'Caja',       icon: Landmark   },
]

export default function Reportes() {
  const [tab,  setTab]  = useState('sales')
  const [days, setDays] = useState(30)

  return (
    <div className="space-y-4 animate-fade-up">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teal-50 rounded-2xl flex items-center justify-center flex-shrink-0">
          <BarChart2 size={20} className="text-teal-600" />
        </div>
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="text-[13px] text-luma-muted mt-0.5">Métricas y análisis del negocio</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="flex gap-0.5 bg-cream-200 p-0.5 rounded-xl min-w-max">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap flex-shrink-0
                ${tab === t.id
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-luma-muted hover:text-luma-text'}`}>
              <t.icon size={13}/>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'sales'     && <TabVentas    days={days} onDaysChange={setDays}/>}
      {tab === 'inventory' && <TabInventario/>}
      {tab === 'products'  && <TabProductos days={days} onDaysChange={setDays}/>}
      {tab === 'customers' && <TabClientes  days={days} onDaysChange={setDays}/>}
      {tab === 'cash'      && <TabCaja      days={days} onDaysChange={setDays}/>}
    </div>
  )
}
