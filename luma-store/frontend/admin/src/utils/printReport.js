/**
 * Abre una ventana de impresión con el reporte HTML.
 * El usuario hace clic en "Guardar como PDF" en el diálogo de impresión del navegador.
 */
export function printReport({ title, storeName, subtitle, sections }) {
  const html = buildHtml({ title, storeName, subtitle, sections })
  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    alert('El navegador bloqueó la ventana emergente. Permite ventanas emergentes para este sitio e intenta de nuevo.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

function fmt(n) {
  return `$${Number(n || 0).toLocaleString('es-CO')}`
}

function buildHtml({ title, storeName, subtitle, sections }) {
  const today = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })

  const sectionsHtml = sections.map(s => {
    if (!s || !s.rows || s.rows.length === 0) return ''
    const headerRow = s.headers.map(h => `<th>${h}</th>`).join('')
    const bodyRows = s.rows.map(row => {
      const cells = row.map((cell, idx) => {
        const align = typeof cell === 'number' ? 'right' : 'left'
        const val = typeof cell === 'number' && s.moneyColumns?.includes(idx)
          ? fmt(cell)
          : cell ?? '—'
        return `<td style="text-align:${align}">${val}</td>`
      }).join('')
      return `<tr>${cells}</tr>`
    }).join('')

    return `
      <div class="section">
        <h3>${s.title}</h3>
        <table>
          <thead><tr>${headerRow}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${title} — ${storeName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 24px; }
    .header { border-bottom: 2px solid #0d8585; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 20px; color: #0d8585; }
    .header p  { font-size: 11px; color: #666; margin-top: 2px; }
    .kpis { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
    .kpi  { background: #f5f0e8; border-radius: 8px; padding: 10px 16px; min-width: 130px; }
    .kpi .label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: .5px; }
    .kpi .value { font-size: 16px; font-weight: 700; color: #1a1a1a; margin-top: 2px; }
    .section { margin-bottom: 24px; }
    .section h3 { font-size: 13px; color: #0d8585; margin-bottom: 6px; border-left: 3px solid #0d8585; padding-left: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    thead tr { background: #0d8585; color: #fff; }
    thead th { padding: 6px 8px; text-align: left; font-weight: 600; }
    tbody tr:nth-child(even) { background: #f9f5ee; }
    tbody td { padding: 5px 8px; border-bottom: 1px solid #e8e3d8; }
    .footer { margin-top: 24px; font-size: 10px; color: #aaa; text-align: center; border-top: 1px solid #e0dbd0; padding-top: 8px; }
    @media print {
      body { padding: 0; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <p>${storeName} · ${subtitle} · Generado el ${today}</p>
  </div>
  ${sectionsHtml}
  <div class="footer">Reporte generado por LUMA Store · ${storeName}</div>
</body>
</html>`
}
