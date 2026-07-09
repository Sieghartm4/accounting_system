export function renderPDFCompanyHeader(
  doc,
  company = {},
  pageW,
  margin,
  startY = 36,
) {
  const LOGO_W = 60
  const LOGO_H = 50
  const contentWidth = pageW - margin * 2
  const leftBlockWidth = Math.round(contentWidth * 0.45)
  const rightBlockWidth = contentWidth - leftBlockWidth
  const leftStartX = margin
  const rightEndX = pageW - margin
  const rightAlignX = rightEndX
  const leftTextX = leftStartX + (company.logo ? LOGO_W + 10 : 0)
  const leftTextMaxWidth = leftBlockWidth - (company.logo ? LOGO_W + 10 : 0)
  const rightTextMaxWidth = rightBlockWidth - 8

  const leftLines = []
  if (company.company_name) leftLines.push(String(company.company_name))
  if (company.owner_name) leftLines.push(String(company.owner_name))

  const rightLines = []
  if (company.address) rightLines.push(String(company.address))
  const contactLine = [company.phone, company.email].filter(Boolean).join('  |  ')
  if (contactLine) rightLines.push(contactLine)
  const tinWebLine = [company.tin ? `TIN: ${company.tin}` : null, company.website]
    .filter(Boolean)
    .join('  |  ')
  if (tinWebLine) rightLines.push(tinWebLine)

  if (company.logo) {
    try {
      const fmt = company.logo.startsWith('data:image/png')
        ? 'PNG'
        : company.logo.startsWith('data:image/jpeg')
          ? 'JPEG'
          : 'PNG'
      doc.addImage(company.logo, fmt, leftStartX, startY, LOGO_W, LOGO_H)
    } catch (err) {
      console.warn('[PDF] Company logo render failed:', err.message)
    }
  }

  const titleY = startY + 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(17, 24, 39)
  if (leftLines[0]) {
    doc.text(leftLines[0], leftTextX, titleY, {
      align: 'left',
      maxWidth: leftTextMaxWidth,
    })
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  leftLines.slice(1).forEach((line, idx) => {
    doc.text(line, leftTextX, titleY + 12 + idx * 10, {
      align: 'left',
      maxWidth: leftTextMaxWidth,
    })
  })

  rightLines.forEach((line, idx) => {
    doc.text(line, rightAlignX, titleY + idx * 10, {
      align: 'right',
      maxWidth: rightTextMaxWidth,
    })
  })

  const leftHeight = company.logo ? LOGO_H : leftLines.length * 10 + 16
  const rightHeight = rightLines.length * 10 + 12
  const height = Math.max(leftHeight, rightHeight)

  const dividerY = startY + height + 12
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.75)
  doc.line(margin, dividerY, pageW - margin, dividerY)

  return dividerY + 12
}
