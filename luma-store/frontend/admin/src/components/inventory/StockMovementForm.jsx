import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { ArrowUp, Settings, Package, AlertTriangle } from 'lucide-react'
import Modal from '../ui/Modal'
import { Select } from '../ui/Input'
import { Button } from '../ui/Button'
import * as svc from '../../api/services'

const fmt = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`

const MOVEMENT_TYPES = [
  { value: 'entry',  label: 'Entrada de inventario',  icon: ArrowUp,        sign: +1, color: 'text-teal-600' },
  { value: 'adjust', label: 'Ajuste manual (+/-)',    icon: Settings,       sign: 0,  color: 'text-blue-600' },
  { value: 'damage', label: 'Dano / Merma',           icon: AlertTriangle,  sign: -1, color: 'text-red-500' },
]

export default function StockMovementForm({ product, onClose }) {
  const [variants,  setVariants]  = useState([])
  const [variantId, setVariantId] = useState('')
  const [type,      setType]      = useState('entry')
  const [quantity,  setQuantity]  = useState(1)
  const [note,      setNote]      = useState('')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    svc.getVariants(product.id).then(({ data }) => {
      const list = data?.results ?? data ?? []
      setVariants(list)
      if (list.length > 0) setVariantId(String(list[0].id))
    })
  }, [product.id])

  const selectedVariant = variants.find(v => String(v.id) === String(variantId))
  const movType = MOVEMENT_TYPES.find(t => t.value === type) || MOVEMENT_TYPES[0]

  // Para "adjust" el sign depende si qty es positivo o negativo
  const signedQty = (() => {
    const abs = Math.abs(quantity)
    if (type === 'entry')  return abs
    if (type === 'damage') return -abs
    // adjust: tal cual lo ingresa el usuario (puede ser negativo)
    return quantity
  })()

  const projectedStock = selectedVariant
    ? Math.max(0, selectedVariant.stock + signedQty)
    : null

  const handleSave = async () => {
    if (!variantId)  { toast.error('Selecciona una variante'); return }
    if (!quantity || quantity === 0) { toast.error('La cantidad no puede ser 0'); return }
    if (type === 'damage' && selectedVariant && Math.abs(quantity) > selectedVariant.stock) {
      toast.error(`No puedes restar mas de ${selectedVariant.stock} unidades en stock`)
      return
    }
    setSaving(true)
    try {
      await svc.createMovement({
        variant:  parseInt(variantId),
        type:     type === 'damage' ? 'adjust' : type,  // el modelo usa 'adjust' para todo lo manual
        quantity: signedQty,
        note:     note || movType.label,
      })
      toast.success('Movimiento registrado correctamente')
      onClose()
    } catch (e) {
      const msg = Object.values(e.response?.data || {}).flat()[0] || 'Error al registrar'
      toast.error(String(msg))
    } finally { setSaving(false) }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Registrar movimiento: ${product.name}`}
      size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="teal" loading={saving} onClick={handleSave} icon={Package}>
            Registrar movimiento
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Stock actual */}
        {selectedVariant && (
          <div className="p-3 bg-cream-100 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] text-luma-faint uppercase tracking-wide">Stock actual</p>
              <p className="text-xl font-bold text-luma-text">{selectedVariant.stock} ud.</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-luma-faint uppercase tracking-wide">Variante</p>
              <p className="text-[12px] font-semibold">
                {[selectedVariant.size, selectedVariant.color].filter(Boolean).join(' / ') || 'Unica'}
              </p>
            </div>
          </div>
        )}

        {/* Variante */}
        {variants.length > 1 && (
          <Select label="Variante" value={variantId} onChange={e => setVariantId(e.target.value)}>
            {variants.map(v => (
              <option key={v.id} value={v.id}>
                {[v.size, v.color].filter(Boolean).join(' / ') || 'Unica'} — {v.sku} ({v.stock} ud.)
              </option>
            ))}
          </Select>
        )}

        {/* Tipo de movimiento */}
        <div>
          <label className="text-[12px] font-semibold text-luma-text block mb-2">Tipo de movimiento</label>
          <div className="grid grid-cols-3 gap-2">
            {MOVEMENT_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={`p-3 rounded-xl border text-center transition-all duration-150
                  ${type === t.value
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-luma-border bg-cream-100 text-luma-muted hover:bg-cream-200'}`}
              >
                <t.icon size={16} className="mx-auto mb-1" />
                <p className="text-[10px] font-semibold leading-tight">{t.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Cantidad */}
        <div>
          <label className="text-[12px] font-semibold text-luma-text block mb-1.5">
            Cantidad
            {type === 'damage' && <span className="text-red-500 ml-1">(se restara del stock)</span>}
            {type === 'entry'  && <span className="text-teal-600 ml-1">(se sumara al stock)</span>}
            {type === 'adjust' && <span className="text-blue-500 ml-1">(positivo suma, negativo resta)</span>}
          </label>
          <input
            type="number"
            min={type === 'adjust' ? undefined : 1}
            value={quantity}
            onChange={e => setQuantity(Number(e.target.value))}
            className="input-base"
          />
          {projectedStock !== null && (
            <div className="mt-2 flex items-center gap-2 text-[12px]">
              <span className="text-luma-muted">Stock resultante:</span>
              <span className={`font-bold ${projectedStock === 0 ? 'text-red-500' : projectedStock <= (product.min_stock || 3) ? 'text-amber-500' : 'text-teal-600'}`}>
                {projectedStock} ud.
              </span>
              {projectedStock === 0 && (
                <span className="text-[10px] text-red-500 font-medium">(se marcara como agotado)</span>
              )}
            </div>
          )}
        </div>

        {/* Nota */}
        <div>
          <label className="text-[12px] font-semibold text-luma-text block mb-1.5">
            Nota <span className="text-luma-faint font-normal">(opcional)</span>
          </label>
          <textarea
            rows={2}
            placeholder="Motivo del ajuste, numero de guia, etc..."
            value={note}
            onChange={e => setNote(e.target.value)}
            className="input-base resize-none"
          />
        </div>
      </div>
    </Modal>
  )
}
