import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus, Trash2, Tag } from 'lucide-react'
import Modal from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/Misc'
import * as svc from '../../api/services'

export default function VariantManager({ product, onClose }) {
  const [variants, setVariants] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [newVar,   setNewVar]   = useState({ size: '', color: '', price: '', stock: 0 })
  const [saving,   setSaving]   = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await svc.getVariants(product.id)
      setVariants(data?.results ?? data ?? [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [product.id])

  const addVariant = async () => {
    if (!newVar.size && !newVar.color) {
      toast.error('Ingresa talla o color')
      return
    }
    setSaving(true)
    try {
      await svc.createVariant({ ...newVar, product: product.id, stock: Number(newVar.stock) })
      setNewVar({ size: '', color: '', price: '', stock: 0 })
      toast.success('Variante creada')
      load()
    } catch (e) {
      toast.error(Object.values(e.response?.data || {}).flat()[0] || 'Error')
    } finally { setSaving(false) }
  }

  const removeVariant = async (id) => {
    try {
      await svc.deleteVariant(id)
      setVariants(prev => prev.filter(v => v.id !== id))
      toast.success('Variante eliminada')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'No se puede eliminar')
    }
  }

  const updateStock = async (variant, delta) => {
    const newStock = Math.max(0, variant.stock + delta)
    try {
      await svc.updateVariant(variant.id, { stock: newStock })
      setVariants(prev => prev.map(v => v.id === variant.id ? { ...v, stock: newStock } : v))
    } catch { toast.error('Error') }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Variantes: ${product.name}`}
      size="lg"
      footer={
        <div className="flex justify-end">
          <Button variant="teal" onClick={onClose}>Listo</Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Existing variants */}
        {loading ? (
          <p className="text-[13px] text-luma-muted text-center py-4">Cargando...</p>
        ) : variants.length === 0 ? (
          <p className="text-[13px] text-luma-muted text-center py-4">Sin variantes. Crea la primera abajo.</p>
        ) : (
          <div className="space-y-2">
            <p className="section-label">Variantes existentes</p>
            {variants.map(v => (
              <div key={v.id} className="flex items-center gap-3 p-3 bg-cream-100 rounded-xl group">
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
                  <div>
                    <span className="text-luma-faint block text-[10px]">Talla</span>
                    <span className="font-semibold">{v.size || '—'}</span>
                  </div>
                  <div>
                    <span className="text-luma-faint block text-[10px]">Color</span>
                    <span className="font-semibold">{v.color || '—'}</span>
                  </div>
                  <div>
                    <span className="text-luma-faint block text-[10px]">SKU</span>
                    <span className="font-mono text-[11px]">{v.sku}</span>
                  </div>
                  <div>
                    <span className="text-luma-faint block text-[10px]">Stock</span>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => updateStock(v, -1)} className="w-5 h-5 rounded bg-white border border-luma-border text-xs flex items-center justify-center hover:bg-cream-200">−</button>
                      <span className="font-bold w-6 text-center">{v.stock}</span>
                      <button onClick={() => updateStock(v, +1)} className="w-5 h-5 rounded bg-white border border-luma-border text-xs flex items-center justify-center hover:bg-cream-200">+</button>
                    </div>
                    <ProgressBar value={v.stock} max={Math.max(v.stock, 20)} className="mt-1" />
                  </div>
                </div>
                <button
                  onClick={() => removeVariant(v.id)}
                  className="opacity-0 group-hover:opacity-100 text-luma-faint hover:text-red-500 transition-all p-1"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new variant */}
        <div>
          <p className="section-label mb-3">Nueva variante</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input
              label="Talla"
              placeholder="S, M, L, XL..."
              value={newVar.size}
              onChange={e => setNewVar(p => ({ ...p, size: e.target.value }))}
            />
            <Input
              label="Color"
              placeholder="Negro, Azul..."
              value={newVar.color}
              onChange={e => setNewVar(p => ({ ...p, color: e.target.value }))}
            />
            <Input
              label="Precio (opcional)"
              type="number"
              placeholder={product.price}
              value={newVar.price}
              onChange={e => setNewVar(p => ({ ...p, price: e.target.value }))}
            />
            <Input
              label="Stock inicial"
              type="number"
              min={0}
              value={newVar.stock}
              onChange={e => setNewVar(p => ({ ...p, stock: e.target.value }))}
            />
          </div>
          <Button
            variant="teal"
            size="sm"
            icon={Plus}
            loading={saving}
            onClick={addVariant}
            className="mt-3"
          >
            Agregar variante
          </Button>
        </div>
      </div>
    </Modal>
  )
}
