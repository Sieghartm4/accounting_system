export function renderPDFCompanyHeader(
  doc,
  company = {},
  pageW,
  margin,
  startY = 36,
) {
  const contentWidth = pageW - margin * 2
  const rightEndX = pageW - margin
  const currentY = startY

  // Exact square 50x50 aspect ratio
  const LOGO_W = 50
  const LOGO_H = 50
  const hasLogo = Boolean(company.logo)

  const leftX = margin + (hasLogo ? LOGO_W + 12 : 0)
  const COLUMN_GAP = 16 // minimum space between the left and the right column
  const rightMaxWidth = contentWidth * 0.42

  // Line heights (text is drawn with baseline: 'top')
  const TITLE_LINE = 15
  const BODY_LINE = 11
  // Empty space under the last line of text (line advance minus glyph size), so the
  // *visible* text is centered and not the text plus its trailing gap
  const TITLE_GAP = 2
  const BODY_GAP = 2.5

  // 1. Right column first: its real width decides how much room the left column has
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)

  const rightSource = []
  const contactLine = [company.phone, company.email].filter(Boolean).join('  |  ')
  if (contactLine) rightSource.push(contactLine)

  const tinWebLine = [company.tin ? `TIN: ${company.tin}` : null, company.website]
    .filter(Boolean)
    .join('  |  ')
  if (tinWebLine) rightSource.push(tinWebLine)

  // Wrap long lines ourselves so the measured height is the real height
  const rightLines = rightSource.flatMap((line) => doc.splitTextToSize(line, rightMaxWidth))
  const rightWidth = rightLines.reduce((max, line) => Math.max(max, doc.getTextWidth(line)), 0)

  // 2. Left column gets everything that is left, so it can never run into the right column
  const leftMaxWidth = Math.max(
    contentWidth * 0.3,
    contentWidth - (hasLogo ? LOGO_W + 12 : 0) - rightWidth - COLUMN_GAP,
  )

  // Title wraps onto as many lines as it needs (measured with the bold title font)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  const titleLines = company.company_name
    ? doc.splitTextToSize(String(company.company_name), leftMaxWidth)
    : []

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  const addressLines = company.address
    ? doc.splitTextToSize(String(company.address), leftMaxWidth)
    : []

  const leftTextHeight = Math.max(
    0,
    titleLines.length * TITLE_LINE +
      addressLines.length * BODY_LINE -
      (addressLines.length ? BODY_GAP : titleLines.length ? TITLE_GAP : 0),
  )
  const rightTextHeight = Math.max(
    0,
    rightLines.length * BODY_LINE - (rightLines.length ? BODY_GAP : 0),
  )

  // 3. The header block is as tall as its tallest part; everything else is centered inside it
  const blockHeight = Math.max(hasLogo ? LOGO_H : 0, leftTextHeight, rightTextHeight)
  const centerOffset = (height) => (blockHeight - height) / 2

  // 4. Logo - vertically centered with the text columns
  if (hasLogo) {
    try {
      const fmt = company.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG'
      doc.addImage(
        company.logo,
        fmt,
        margin,
        currentY + centerOffset(LOGO_H),
        LOGO_W,
        LOGO_H,
      )
    } catch (err) {
      console.warn('[PDF] Logo render failed:', err.message)
    }
  }

  // 5. Left column: company name (wrapped) & address - centered
  let leftCursorY = currentY + centerOffset(leftTextHeight)

  if (titleLines.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(15, 23, 42) // Slate 900
    titleLines.forEach((line) => {
      doc.text(line, leftX, leftCursorY, { baseline: 'top' })
      leftCursorY += TITLE_LINE
    })
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139) // Slate 500
  addressLines.forEach((line) => {
    doc.text(line, leftX, leftCursorY, { baseline: 'top' })
    leftCursorY += BODY_LINE
  })

  // 6. Right column: contacts, TIN & website - centered
  let rightCursorY = currentY + centerOffset(rightTextHeight)

  rightLines.forEach((line) => {
    doc.text(line, rightEndX, rightCursorY, { align: 'right', baseline: 'top' })
    rightCursorY += BODY_LINE
  })

  // 7. Divider line below the header block
  const dividerY = currentY + blockHeight + 8

  doc.setDrawColor(203, 213, 225) // Slate 300
  doc.setLineWidth(0.75)
  doc.line(margin, dividerY, rightEndX, dividerY)

  return dividerY + 14
}