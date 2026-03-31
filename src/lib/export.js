export function exportCSV(rows, headers, filename) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers.join(','), ...rows.map(r => r.map(esc).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = filename; a.click()
}

export async function exportPDF(rows, headers, title, filename) {
  const { default: jsPDF } = await import('jspdf')
  await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: headers.length > 6 ? 'landscape' : 'portrait' })
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(61, 55, 44)
  doc.text('adraba', 14, 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(103, 92, 71)
  doc.text(title, 14, 24)
  doc.setFontSize(8); doc.setTextColor(160, 155, 145)
  doc.text(`Generated ${new Date().toLocaleDateString()}`, 14, 30)
  doc.autoTable({
    head: [headers], body: rows, startY: 34,
    styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
    headStyles: { fillColor: [61, 55, 44], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 237, 229] },
    margin: { left: 14, right: 14 },
  })
  doc.save(filename)
}