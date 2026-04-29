import api from '../api/client'

// ── Categorías ────────────────────────────────────────────────────────────────
export const getCategories  = ()          => api.get('/inventory/categories/')
export const createCategory = (data)      => api.post('/inventory/categories/', data)
export const updateCategory = (id, data)  => api.patch(`/inventory/categories/${id}/`, data)
export const deleteCategory = (id)        => api.delete(`/inventory/categories/${id}/`)

// ── Productos ─────────────────────────────────────────────────────────────────
export const getProducts    = (params)    => api.get('/inventory/products/', { params })
export const getProduct     = (id)        => api.get(`/inventory/products/${id}/`)
export const createProduct  = (data)      => api.post('/inventory/products/', data)
export const updateProduct  = (id, data)  => api.patch(`/inventory/products/${id}/`, data)
export const deleteProduct  = (id)        => api.delete(`/inventory/products/${id}/`)
// Búsqueda optimizada para POS: retorna variantes con stock listas para carrito
export const searchProductsForSale = (q, limit = 30) =>
  api.get('/inventory/products/search-for-sale/', { params: { q, limit } })
export const importProducts = (file)      => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/inventory/products/import/', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// ── Variantes ─────────────────────────────────────────────────────────────────
export const getVariants   = (productId) => api.get('/inventory/variants/', { params: { product: productId } })
export const createVariant = (data)      => api.post('/inventory/variants/', data)
export const updateVariant = (id, data)  => api.patch(`/inventory/variants/${id}/`, data)
export const deleteVariant = (id)        => api.delete(`/inventory/variants/${id}/`)

// ── Movimientos de stock ──────────────────────────────────────────────────────
export const getMovements   = (params)   => api.get('/inventory/movements/', { params })
export const createMovement = (data)     => api.post('/inventory/movements/', data)

// ── Caja ──────────────────────────────────────────────────────────────────────
export const getSessions     = (params) => api.get('/cash/sessions/', { params })
export const getSession      = (id)     => api.get(`/cash/sessions/${id}/`)
export const openSession     = (data)   => api.post('/cash/sessions/', data)
export const closeSession    = (id, data) => api.post(`/cash/sessions/${id}/close/`, data)
export const getCashMovements = (params) => api.get('/cash/movements/', { params })
export const createCashMovement = (data) => api.post('/cash/movements/', data)

// ── Ventas ────────────────────────────────────────────────────────────────────
export const getSales      = (params)   => api.get('/sales/', { params })
export const createSale    = (data)     => api.post('/sales/', data)
export const getReturns    = (params)   => api.get('/sales/returns/', { params })
export const createReturn  = (data)     => api.post('/sales/returns/', data)

// ── Pedidos ───────────────────────────────────────────────────────────────────
export const getOrders     = (params)   => api.get('/orders/', { params })
export const getOrder      = (id)       => api.get(`/orders/${id}/`)
export const updateOrder   = (id, data) => api.patch(`/orders/${id}/`, data)

// ── Clientes ──────────────────────────────────────────────────────────────────
export const getCustomers    = (params) => api.get('/customers/', { params })
export const createCustomer  = (data)  => api.post('/customers/', data)
export const updateCustomer  = (id, d) => api.patch(`/customers/${id}/`, d)
export const getLoyaltyConfig = ()     => api.get('/customers/loyalty/')
export const updateLoyaltyConfig = (d)=> api.patch('/customers/loyalty/', d)

// ── Configuración ─────────────────────────────────────────────────────────────
export const getConfig    = ()      => api.get('/config/store/')
export const updateConfig = (data)  => api.patch('/config/store/', data)
// Métodos de pago
export const getPaymentMethods    = ()     => api.get('/config/payment-methods/')
export const updatePaymentMethods = (data) => api.put('/config/payment-methods/', data)

// ── Usuarios ──────────────────────────────────────────────────────────────────
export const getUsers     = ()      => api.get('/auth/users/')
export const createUser   = (data)  => api.post('/auth/users/', data)
export const updateUser   = (id, d) => api.patch(`/auth/users/${id}/`, d)
export const deleteUser   = (id)    => api.delete(`/auth/users/${id}/`)

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboard    = ()       => api.get('/reports/dashboard/')
export const getSalesReport  = (params) => api.get('/reports/sales/', { params })
export const exportSalesReport = (params) => api.get('/reports/export/sales/', {
  params,
  responseType: 'blob',   // 'blob' evita corrupción de binarios en el proxy de Vite
  validateStatus: (status) => status < 500,
})

// ── Aliases para Configuracion.jsx ────────────────────────────────────────────
export const getStoreConfig    = ()     => api.get('/config/store/')
export const updateStoreConfig = (data) => api.patch('/config/store/', data)

// ── Venta detalle ─────────────────────────────────────────────────────────────
export const getSale = (id) => api.get(`/sales/${id}/`)

// ── Imágenes de producto ──────────────────────────────────────────────────────
export const uploadProductImage = (formData) => api.post('/inventory/images/', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
export const deleteProductImage = (id) => api.delete(`/inventory/images/${id}/`)
export const setMainImage = (id) => api.patch(`/inventory/images/${id}/`, { is_main: true })

