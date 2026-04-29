import { useState, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  Upload, Download, FileText, CheckCircle2,
  XCircle, AlertTriangle, ChevronRight, X, RefreshCw
} from 'lucide-react'
import Modal from '../ui/Modal'
import { Button } from '../ui/Button'
import * as svc from '../../api/services'

// ── Columnas del CSV (spec + backend) ────────────────────────────────────────
const COLUMNS = [
  { key: 'name',        label: 'name',        required: true,  desc: 'Nombre del producto',                example: 'Blusa de algodón' },
  { key: 'price',       label: 'price',       required: true,  desc: 'Precio de venta (solo números)',     example: '45000' },
  { key: 'cost',        label: 'cost',        required: false, desc: 'Costo unitario (solo números)',      example: '20000' },
  { key: 'description', label: 'description', required: false, desc: 'Descripción del producto',           example: 'Blusa manga larga...' },
  { key: 'min_stock',   label: 'min_stock',   required: false, desc: 'Umbral mínimo de alerta de stock',  example: '5' },
]

const TEMPLATE_ROWS = [
  { name: 'Blusa de algodón',    price: 45000, cost: 20000, description: 'Blusa manga larga tela suave', min_stock: 5 },
  { name: 'Jeans slim fit',      price: 89000, cost: 40000, description: 'Jeans azul oscuro corte slim',  min_stock: 3 },
  { name: 'Chaqueta de cuero',   price: 120000, cost: 55000, description: '',                              min_stock: 2 },
]

// ── Genera y descarga el CSV plantilla ────────────────────────────────────────
function downloadTemplate() {
  const headers = COLUMNS.map(c => c.key).join(',')
  const rows = TEMPLATE_ROWS.map(r =>
    COLUMNS.map(c => `"${String(r[c.key] ?? '')}"`).join(',')
  )
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'plantilla_productos_luma.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Parsea el CSV en el frontend para preview ─────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return { headers: [], rows: [], errors: [] }
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = []
  const errors = []
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row = {}
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? '' })
    const rowErrors = []
    if (!row.name?.trim()) rowErrors.push('Nombre requerido')
    if (!row.price || isNaN(Number(row.price))) rowErrors.push('Precio inválido')
    if (row.cost && isNaN(Number(row.cost))) rowErrors.push('Costo inválido')
    if (row.min_stock && isNaN(Number(row.min_stock))) rowErrors.push('min_stock inválido')
    rows.push({ ...row, _line: i + 1, _errors: rowErrors })
    if (rowErrors.length) errors.push({ line: i + 1, errors: rowErrors })
  }
  return { headers, rows, errors }
}

// ── Stages ────────────────────────────────────────────────────────────────────
// 'idle' → 'preview' → 'result'

export default function CsvImportModal({ onClose, onImported }) {
  const [stage,      setStage]      = useState('idle')   // idle | preview | importing | result
  const [file,       setFile]       = useState(null)
  const [parsed,     setParsed]     = useState(null)
  const [dragging,   setDragging]   = useState(false)
  const [result,     setResult]     = useState(null)
  const fileInputRef = useRef(null)

  const handleFile = useCallback((f) => {
    if (!f || !f.name.endsWith('.csv')) {
      toast.error('Solo se aceptan archivos .csv')
      return
    }
    setFile(f)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      const p = parseCsv(text)
      setParsed(p)
      setStage('preview')
    }
    reader.readAsText(f, 'utf-8')
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    handleFile(f)
  }, [handleFile])

  const handleImport = async () => {
    if (!file) return
    setStage('importing')
    try {
      const { data } = await svc.importProducts(file)
      setResult(data)
      setStage('result')
      if (data.created > 0) onImported?.()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Error al importar')
      setStage('preview')
    }
  }

  const reset = () => {
    setStage('idle')
    setFile(null)
    setParsed(null)
    setResult(null)
  }

  const validRows   = parsed?.rows.filter(r => r._errors.length === 0) ?? []
  const invalidRows = parsed?.rows.filter(r => r._errors.length > 0)  ?? []

  return (
    <Modal
      open
      onClose={onClose}
      title="Importar productos desde CSV"
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          {/* Left: Descargar plantilla — siempre visible */}
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-[12px] text-teal-600 hover:text-teal-700 font-semibold transition-colors"
          >
            <Download size={14} />
            Descargar plantilla CSV
          </button>

          {/* Right: acciones */}
          <div className="flex gap-2">
            {stage === 'idle' && (
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
            )}
            {stage === 'preview' && (
              <>
                <Button variant="outline" onClick={reset}>Cambiar archivo</Button>
                <Button
                  variant="teal"
                  icon={Upload}
                  disabled={validRows.length === 0}
                  onClick={handleImport}
                >
                  Importar {validRows.length} producto{validRows.length !== 1 ? 's' : ''}
                </Button>
              </>
            )}
            {stage === 'importing' && (
              <Button variant="teal" loading>Importando...</Button>
            )}
            {stage === 'result' && (
              <>
                <Button variant="outline" onClick={reset}>Importar otro archivo</Button>
                <Button variant="teal" onClick={onClose}>Listo</Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">

        {/* ── STAGE: IDLE — Instrucciones + Drop Zone ── */}
        {stage === 'idle' && (
          <>
            {/* Instrucciones de columnas */}
            <div className="bg-cream-50 border border-luma-border rounded-xl p-4 space-y-3">
              <p className="text-[13px] font-semibold text-luma-text">Formato del archivo CSV</p>
              <p className="text-[12px] text-luma-muted">
                El archivo debe tener los encabezados en la primera fila. Los productos se importan
                como <span className="font-semibold text-amber-600">borradores inactivos</span> para
                que los revises antes de publicarlos.
              </p>
              <div className="overflow-hidden rounded-xl border border-luma-border">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-cream-100">
                      <th className="px-3 py-2 text-left font-semibold text-luma-text">Columna</th>
                      <th className="px-3 py-2 text-left font-semibold text-luma-text">Requerido</th>
                      <th className="px-3 py-2 text-left font-semibold text-luma-text">Descripción</th>
                      <th className="px-3 py-2 text-left font-semibold text-luma-text">Ejemplo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-luma-border">
                    {COLUMNS.map(col => (
                      <tr key={col.key}>
                        <td className="px-3 py-2 font-mono text-teal-700 font-semibold">{col.label}</td>
                        <td className="px-3 py-2">
                          {col.required
                            ? <span className="text-red-600 font-bold">Sí</span>
                            : <span className="text-luma-faint">Opcional</span>}
                        </td>
                        <td className="px-3 py-2 text-luma-muted">{col.desc}</td>
                        <td className="px-3 py-2 font-mono text-luma-faint">{col.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-amber-700">
                  <strong>Tip:</strong> Descarga la plantilla con el botón de abajo para tener el formato
                  correcto listo para rellenar. Las imágenes y variantes se gestionan después desde el
                  detalle de cada producto.
                </p>
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                dragging
                  ? 'border-teal-400 bg-teal-50 scale-[1.01]'
                  : 'border-luma-border hover:border-teal-400 hover:bg-teal-50/50'
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                dragging ? 'bg-teal-100' : 'bg-cream-100'
              }`}>
                <FileText size={26} className={dragging ? 'text-teal-500' : 'text-luma-faint'} />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-luma-text">
                  {dragging ? 'Suelta el archivo aquí' : 'Arrastra tu archivo CSV aquí'}
                </p>
                <p className="text-[12px] text-luma-muted mt-1">
                  o <span className="text-teal-600 font-semibold underline">haz clic para seleccionarlo</span>
                </p>
                <p className="text-[11px] text-luma-faint mt-2">Solo archivos .csv · Codificación UTF-8</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => handleFile(e.target.files?.[0])}
            />
          </>
        )}

        {/* ── STAGE: PREVIEW ── */}
        {stage === 'preview' && parsed && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-cream-100 rounded-xl p-3 text-center">
                <p className="text-[11px] text-luma-faint uppercase tracking-wide">Total filas</p>
                <p className="text-[20px] font-bold text-luma-text mt-1">{parsed.rows.length}</p>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center">
                <p className="text-[11px] text-teal-600 uppercase tracking-wide">Válidos</p>
                <p className="text-[20px] font-bold text-teal-700 mt-1">{validRows.length}</p>
              </div>
              <div className={`rounded-xl p-3 text-center border ${
                invalidRows.length > 0 ? 'bg-red-50 border-red-200' : 'bg-cream-100 border-transparent'
              }`}>
                <p className={`text-[11px] uppercase tracking-wide ${invalidRows.length > 0 ? 'text-red-600' : 'text-luma-faint'}`}>Con errores</p>
                <p className={`text-[20px] font-bold mt-1 ${invalidRows.length > 0 ? 'text-red-600' : 'text-luma-text'}`}>{invalidRows.length}</p>
              </div>
            </div>

            {/* Errors */}
            {invalidRows.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-1.5">
                <p className="text-[12px] font-semibold text-red-700 flex items-center gap-1.5">
                  <XCircle size={14} /> Filas con errores (se omitirán al importar)
                </p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {invalidRows.map(r => (
                    <p key={r._line} className="text-[11px] text-red-600">
                      <strong>Fila {r._line}:</strong> {r._errors.join(' · ')}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Preview table */}
            {validRows.length > 0 && (
              <div>
                <p className="text-[12px] font-semibold text-luma-text mb-2">
                  Vista previa — primeros {Math.min(5, validRows.length)} de {validRows.length} productos válidos
                </p>
                <div className="overflow-auto rounded-xl border border-luma-border max-h-56">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-cream-100 sticky top-0">
                        {COLUMNS.map(c => (
                          <th key={c.key} className="px-3 py-2 text-left font-semibold text-luma-text whitespace-nowrap">
                            {c.key} {c.required && <span className="text-red-500">*</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-luma-border">
                      {validRows.slice(0, 5).map((r, i) => (
                        <tr key={i} className="hover:bg-cream-50">
                          {COLUMNS.map(c => (
                            <td key={c.key} className="px-3 py-2 text-luma-muted max-w-[160px] truncate">
                              {r[c.key] || <span className="text-luma-faint italic">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {validRows.length === 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <XCircle size={28} className="mx-auto text-red-400 mb-2" />
                <p className="text-[13px] font-semibold text-red-700">No hay filas válidas para importar</p>
                <p className="text-[11px] text-red-500 mt-1">Corrige los errores en el archivo y vuelve a subirlo</p>
              </div>
            )}
          </>
        )}

        {/* ── STAGE: IMPORTING ── */}
        {stage === 'importing' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-teal-50 rounded-2xl flex items-center justify-center">
              <RefreshCw size={24} className="text-teal-500 animate-spin" />
            </div>
            <p className="text-[14px] font-semibold text-luma-text">Importando productos...</p>
            <p className="text-[12px] text-luma-muted">Esto puede tomar unos segundos</p>
          </div>
        )}

        {/* ── STAGE: RESULT ── */}
        {stage === 'result' && result && (
          <div className="space-y-4">
            <div className={`rounded-2xl p-6 flex flex-col items-center gap-3 ${
              result.created > 0 ? 'bg-teal-50 border border-teal-200' : 'bg-red-50 border border-red-200'
            }`}>
              {result.created > 0
                ? <CheckCircle2 size={36} className="text-teal-500" />
                : <XCircle size={36} className="text-red-400" />}
              <p className="text-[16px] font-bold text-luma-text text-center">{result.message}</p>
              {result.created > 0 && (
                <p className="text-[12px] text-luma-muted text-center">
                  Los productos fueron importados como <strong>borradores inactivos</strong>.
                  Revísalos en el catálogo, agrega imágenes y variantes antes de publicarlos.
                </p>
              )}
            </div>
            {result.errors?.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1.5">
                <p className="text-[12px] font-semibold text-red-700 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> {result.errors.length} filas con errores omitidas
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-[11px] text-red-600">{err}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </Modal>
  )
}
