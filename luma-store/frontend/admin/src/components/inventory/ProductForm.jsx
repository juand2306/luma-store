import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { Upload, X, ImagePlus, Star, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import Modal from '../ui/Modal'
import { Input, Select, Textarea } from '../ui/Input'
import { Button } from '../ui/Button'
import * as svc from '../../api/services'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function ProductForm({ product, categories, onSave, onClose }) {
  const isEdit = !!product?.id
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    name:        '',
    sku_base:    '',
    description: '',
    category:    '',
    price:       '',
    cost:        '',
    margin:      '',
    min_stock:   3,
    is_visible:  false,
    is_featured: false,
    status:      'active',
    initial_stock: 0,
    initial_size:  '',
    initial_color: '',
  })

  // Track which price field was last changed to decide recalc direction
  const [lastChanged, setLastChanged] = useState(null) // 'price' | 'margin' | 'cost'

  // Imágenes existentes (edición) + nuevas a subir
  const [existingImages, setExistingImages] = useState([])
  const [newImages, setNewImages]           = useState([])   // File[]
  const [previewUrls, setPreviewUrls]       = useState([])   // string[]
  const [deletingImages, setDeletingImages] = useState([])   // ids a eliminar
  const [saving, setSaving]                 = useState(false)

  useEffect(() => {
    if (isEdit && product) {
      const price = Number(product.price || 0)
      const cost  = Number(product.cost  || 0)
      const margin = price > 0 ? Math.round(((price - cost) / price) * 100 * 100) / 100 : 0
      setForm({
        name:        product.name        || '',
        sku_base:    product.sku_base    || '',
        description: product.description || '',
        category:    product.category    || '',
        price:       product.price       || '',
        cost:        product.cost        || '',
        margin:      String(margin),
        min_stock:   product.min_stock   ?? 3,
        is_visible:  product.is_visible  ?? false,
        is_featured: product.is_featured ?? false,
        status:      product.status      || 'active',
        initial_stock: 0,
        initial_size:  '',
        initial_color: '',
      })
      setExistingImages(product.images || [])
    }
  }, [product, isEdit])

  // Real-time price interdependence (spec 6.2)
  useEffect(() => {
    const cost   = parseFloat(form.cost)   || 0
    const price  = parseFloat(form.price)  || 0
    const margin = parseFloat(form.margin) || 0

    if (lastChanged === 'margin' && cost > 0 && margin > 0 && margin < 100) {
      // Costo + Margen → recalcula Precio
      const newPrice = cost / (1 - margin / 100)
      setForm(prev => ({ ...prev, price: String(Math.round(newPrice)) }))
    } else if (lastChanged === 'price' && cost > 0 && price > cost) {
      // Costo + Precio → recalcula Margen
      const newMargin = ((price - cost) / price) * 100
      setForm(prev => ({ ...prev, margin: String(Math.round(newMargin * 100) / 100) }))
    } else if (lastChanged === 'cost') {
      if (price > 0 && price > cost) {
        const newMargin = ((price - cost) / price) * 100
        setForm(prev => ({ ...prev, margin: String(Math.round(newMargin * 100) / 100) }))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cost, form.price, form.margin])

  // Cleanup preview URLs
  useEffect(() => {
    return () => previewUrls.forEach(url => URL.revokeObjectURL(url))
  }, [previewUrls])

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const MAX_IMAGES = 8

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const valid = files.filter(f => f.type.startsWith('image/'))
    if (valid.length < files.length) toast.error('Solo se permiten imágenes')

    const currentTotal = existingImages.length + newImages.length
    const remaining    = MAX_IMAGES - currentTotal
    if (remaining <= 0) {
      toast.error(`Límite de ${MAX_IMAGES} imágenes por producto alcanzado`)
      e.target.value = ''
      return
    }
    const toAdd = valid.slice(0, remaining)
    if (toAdd.length < valid.length) {
      toast.error(`Se agregaron ${toAdd.length} de ${valid.length} imágenes (máximo ${MAX_IMAGES} por producto)`)
    }
    setNewImages(prev  => [...prev,  ...toAdd])
    setPreviewUrls(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))])
    e.target.value = ''
  }

  const removeNewImage = (idx) => {
    URL.revokeObjectURL(previewUrls[idx])
    setNewImages(prev => prev.filter((_, i) => i !== idx))
    setPreviewUrls(prev => prev.filter((_, i) => i !== idx))
  }

  const markDeleteExisting = (imgId) => {
    setDeletingImages(prev => [...prev, imgId])
    setExistingImages(prev => prev.filter(i => i.id !== imgId))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('El nombre es requerido'); return }
    if (!form.price)        { toast.error('El precio es requerido'); return }

    setSaving(true)
    try {
      // 1. Guardar datos del producto
      const productData = {
        name:        form.name,
        sku_base:    form.sku_base || undefined,  // empty = auto-generated by backend
        description: form.description,
        category:    form.category || null,
        price:       form.price,
        cost:        form.cost || 0,
        min_stock:   form.min_stock,
        is_visible:  form.is_visible,
        is_featured: form.is_featured,
        status:      form.status,
      }

      let savedProduct
      if (isEdit) {
        const r = await svc.updateProduct(product.id, productData)
        savedProduct = r.data
      } else {
        const r = await svc.createProduct(productData)
        savedProduct = r.data
      }

      // 2. Si es nuevo y hay stock inicial, crear variante por defecto
      if (!isEdit && Number(form.initial_stock) > 0) {
        await svc.createVariant({
          product:  savedProduct.id,
          size:     form.initial_size  || 'ÚNICA',
          color:    form.initial_color || 'Único',
          stock:    Number(form.initial_stock),
          is_active: true,
        })
      }

      // 3. Subir imágenes nuevas (multipart)
      for (let i = 0; i < newImages.length; i++) {
        const fd = new FormData()
        fd.append('image', newImages[i])
        fd.append('product', savedProduct.id)
        fd.append('order', existingImages.length + i)
        fd.append('is_main', i === 0 && existingImages.length === 0 ? 'true' : 'false')
        await svc.uploadProductImage(fd)
      }

      // 4. Eliminar imágenes marcadas (edición)
      for (const imgId of deletingImages) {
        await svc.deleteProductImage(imgId).catch(() => {})
      }

      onSave(savedProduct, isEdit)
    } catch (e) {
      const msg = Object.values(e.response?.data || {}).flat()[0] || 'Error al guardar'
      toast.error(String(msg))
    } finally { setSaving(false) }
  }

  const allImages = [
    ...existingImages.map(img => ({ type: 'existing', id: img.id, url: img.image })),
    ...previewUrls.map((url, i) => ({ type: 'new', idx: i, url })),
  ]

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Editar: ${product.name}` : 'Nuevo producto'}
      size="lg"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="teal" loading={saving} onClick={handleSubmit}>
            {isEdit ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </div>
      }
    >
      <form onSubmit={(e) => e.preventDefault()} className="space-y-5">

        {/* ── INFORMACIÓN GENERAL ─────────────────────────────────── */}
        <div>
          <p className="section-label mb-3">Información general</p>
          <div className="space-y-3">
            <Input
              label="Nombre del producto *"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="Ej: Blusa de algodón manga larga"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Referencia / SKU base"
                value={form.sku_base}
                onChange={e => set('sku_base', e.target.value.toUpperCase())}
                placeholder="Auto-generado si se deja vacío"
              />
              <Select label="Estado" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Categoría" value={form.category} onChange={e => set('category', e.target.value)}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.displayName || c.name}</option>)}
              </Select>
              <div className="flex items-end pb-0.5">
                <p className="text-[11px] text-luma-faint">
                  Si dejas el SKU vacío, el sistema genera uno automáticamente al guardar.
                </p>
              </div>
            </div>
            <Textarea
              label="Descripción"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Descripción del producto para la tienda online..."
              rows={3}
            />
          </div>
        </div>

        {/* ── PRECIOS Y COSTOS ─────────────────────────────────────── */}
        <div>
          <p className="section-label mb-3">Precios y costos</p>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Costo"
              type="number"
              value={form.cost}
              onChange={e => { set('cost', e.target.value); setLastChanged('cost') }}
              placeholder="20000"
            />
            <div>
              <label className="block text-[12px] font-medium text-luma-text mb-1.5">
                Margen de ganancia (%)
              </label>
              <input
                type="number"
                min={0} max={99.99} step={0.1}
                value={form.margin}
                onChange={e => { set('margin', e.target.value); setLastChanged('margin') }}
                placeholder="40"
                className="input-base w-full"
              />
            </div>
            <Input
              label="Precio de venta *"
              type="number"
              value={form.price}
              onChange={e => { set('price', e.target.value); setLastChanged('price') }}
              placeholder="45000"
              required
            />
          </div>
          {form.price && form.cost && (
            <div className="flex gap-4 mt-1.5">
              <p className="text-[11px] text-teal-600">
                Margen real: <strong>{Math.round(((form.price - form.cost) / form.price) * 100 * 10) / 10}%</strong>
              </p>
              <p className="text-[11px] text-luma-muted">
                Ganancia: <strong>${(form.price - form.cost).toLocaleString('es-CO')}</strong> por unidad
              </p>
            </div>
          )}
          <p className="text-[10px] text-luma-faint mt-1">
            Edita Costo + Margen → se recalcula el Precio · Edita Costo + Precio → se recalcula el Margen
          </p>
        </div>

        {/* ── IMÁGENES ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">Imágenes del producto</p>
            <span className={`text-[11px] font-semibold ${allImages.length >= MAX_IMAGES ? 'text-amber-600' : 'text-luma-faint'}`}>
              {allImages.length}/{MAX_IMAGES} imágenes
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {allImages.map((img, i) => (
              <div key={i} className="relative aspect-square bg-cream-100 rounded-xl overflow-hidden group">
                <img src={img.url} alt="" className="w-full h-full object-cover" />
                {i === 0 && (
                  <div className="absolute top-1 left-1 bg-teal-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    Principal
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => img.type === 'existing' ? markDeleteExisting(img.id) : removeNewImage(img.idx)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {/* Botón agregar — oculto cuando se alcanza el límite */}
            {allImages.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square bg-cream-100 border-2 border-dashed border-luma-border rounded-xl flex flex-col items-center justify-center gap-1 hover:border-teal-400 hover:bg-teal-50 transition-colors text-luma-faint hover:text-teal-500"
              >
                <ImagePlus size={20} />
                <span className="text-[10px] font-medium">Agregar</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <p className="text-[11px] text-luma-faint mt-1.5">
            La primera imagen sera la principal. Formatos: JPG, PNG, WEBP. Máximo 8 imágenes.
          </p>
        </div>

        {/* ── STOCK INICIAL (solo creación) ────────────────────────── */}
        {!isEdit && (
          <div>
            <p className="section-label mb-3">Stock inicial</p>
            <div className="bg-cream-100 rounded-xl p-3 space-y-3">
              <p className="text-[11px] text-luma-muted">
                Puedes agregar un stock inicial. Si el producto tiene variantes (tallas/colores), gestionalas después desde "Variantes".
              </p>
              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="Cantidad inicial"
                  type="number"
                  min={0}
                  value={form.initial_stock}
                  onChange={e => set('initial_stock', Number(e.target.value))}
                  placeholder="0"
                />
                <Input
                  label="Talla"
                  value={form.initial_size}
                  onChange={e => set('initial_size', e.target.value)}
                  placeholder="ÚNICA"
                />
                <Input
                  label="Color"
                  value={form.initial_color}
                  onChange={e => set('initial_color', e.target.value)}
                  placeholder="Único"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIGURACIÓN DE ALERTAS (6.2) ───────────────────────── */}
        <div>
          <p className="section-label mb-3">Configuración de alertas</p>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-[12px] font-semibold text-amber-700 mb-2">Stock mínimo de alerta</p>
            <p className="text-[11px] text-amber-600 mb-3">
              Cuando el stock baje de este número, el producto aparecerá en el panel de alertas del dashboard.
            </p>
            <div className="w-40">
              <Input
                type="number"
                min={0}
                value={form.min_stock}
                onChange={e => set('min_stock', Number(e.target.value))}
                placeholder="3"
              />
            </div>
            <p className="text-[10px] text-amber-500 mt-2">Por defecto: 3 unidades</p>
          </div>
        </div>

        {/* ── CONFIGURACIÓN DE PUBLICACIÓN ──────────────────────────── */}
        <div>
          <p className="section-label mb-3">Configuración de publicación</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'is_visible',  label: 'Visible en tienda',     desc: 'El producto aparece en el portal de clientes', icon: Eye },
              { key: 'is_featured', label: 'Producto destacado',    desc: 'Aparece en la sección de destacados del portal', icon: Star },
            ].map(({ key, label, desc, icon: Icon }) => (
              <label
                key={key}
                className="flex items-start gap-3 p-3 bg-cream-100 rounded-xl cursor-pointer hover:bg-cream-200 transition-colors"
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={form[key]}
                  onClick={() => set(key, !form[key])}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0 mt-0.5
                    ${form[key] ? 'bg-teal-500' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
                    ${form[key] ? 'translate-x-5' : 'translate-x-0'}`}
                  />
                </button>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Icon size={12} className="text-luma-faint" />
                    <span className="text-[12px] font-semibold text-luma-text">{label}</span>
                  </div>
                  <p className="text-[10px] text-luma-faint mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

      </form>
    </Modal>
  )
}
