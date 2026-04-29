/**
 * Descarga un archivo cuyo contenido viene codificado en base64 dentro de un JSON.
 * El endpoint devuelve: { format, filename, data: "<base64>" }
 *
 * Ventaja: evita completamente los problemas de corrupción de binarios
 * que ocurren cuando axios/fetch pasan archivos binarios por el proxy de Vite.
 */
export async function downloadFile(path, params = {}, _filename) {
  const token = localStorage.getItem('luma_access')

  const searchParams = new URLSearchParams(params)
  const url = `${path}?${searchParams.toString()}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`)
    err.status = response.status
    throw err
  }

  // El backend devuelve JSON con el archivo codificado en base64
  const json = await response.json()
  const { data: b64, filename, format } = json

  // Decodificar base64 → bytes
  const byteChars  = atob(b64)
  const byteArrays = []
  for (let offset = 0; offset < byteChars.length; offset += 512) {
    const slice = byteChars.slice(offset, offset + 512)
    const bytes = new Uint8Array(slice.length)
    for (let i = 0; i < slice.length; i++) {
      bytes[i] = slice.charCodeAt(i)
    }
    byteArrays.push(bytes)
  }

  const mimeType = format === 'xlsx'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv;charset=utf-8'

  const blob      = new Blob(byteArrays, { type: mimeType })
  const objectUrl = URL.createObjectURL(blob)
  const a         = document.createElement('a')
  a.href          = objectUrl
  a.download      = filename || _filename || `reporte.${format}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)
}
