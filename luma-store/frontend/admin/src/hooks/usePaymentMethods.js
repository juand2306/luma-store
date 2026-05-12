/**
 * usePaymentMethods — hook compartido con caché a nivel de módulo.
 *
 * Evita múltiples peticiones al mismo endpoint: la primera llamada
 * fetcha /config/payment-methods/ y el resultado se guarda en `_cache`.
 * Las llamadas posteriores (desde cualquier componente) obtienen los datos
 * de la caché de forma síncrona, sin petición adicional.
 *
 * Exportaciones:
 *   methods        — lista completa  [{ key, label, enabled }]
 *   enabledMethods — solo los activos (para botones de selección)
 *   labelsMap      — { key: label }  (para mostrar etiquetas en tablas)
 *   loading        — true solo en la primera carga
 *   reload         — fuerza recarga desde el servidor
 */

import { useState, useEffect } from 'react'
import { getPaymentMethods } from '../api/services'

// Caché a nivel de módulo — sobrevive entre re-renders y re-mounts
let _cache   = null   // array de métodos, o null si no se ha cargado
let _promise = null   // promesa en vuelo para evitar peticiones duplicadas

function fetchMethods() {
  if (_promise) return _promise
  _promise = getPaymentMethods()
    .then(r => {
      _cache = r.data
      return r.data
    })
    .catch(() => {
      _promise = null   // permite reintentar si falla
      return []
    })
  return _promise
}

export function usePaymentMethods() {
  const [methods, setMethods] = useState(_cache || [])
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    if (_cache) {
      setMethods(_cache)
      setLoading(false)
      return
    }
    fetchMethods().then(m => {
      setMethods(m)
      setLoading(false)
    })
  }, [])

  const enabledMethods = methods.filter(m => m.enabled)
  const labelsMap      = Object.fromEntries(methods.map(m => [m.key, m.label]))

  const reload = () => {
    _cache   = null
    _promise = null
    setLoading(true)
    fetchMethods().then(m => {
      setMethods(m)
      setLoading(false)
    })
  }

  return { methods, enabledMethods, labelsMap, loading, reload }
}

/** Invalidar caché desde fuera (ej: al guardar cambios en Configuracion) */
export function invalidatePaymentMethodsCache() {
  _cache   = null
  _promise = null
}
