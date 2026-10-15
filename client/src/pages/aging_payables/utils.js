export const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export const decimalFormat = (value) => {
  const number = Number(value)
  if (Number.isNaN(number)) return '0.00'
  return number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export const formatCurrency = (value) => {
  return `₱ ${decimalFormat(value)}`
}

export const handlePrint = (filteredPurchases, stats, asOfDate) => {
  const printWindow = window.open('', '', 'height=700,width=1000')
  printWindow.document.write('<html><head><title>Aging Payables Report</title>')
  printWindow.document.write(`
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #333; padding: 25px; margin: 0; }
      .header-container { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #1e293b; padding-bottom: 15px; }
      .title { font-size: 18px; font-weight: bold; color: #0f172a; letter-spacing: 0.5px; margin-bottom: 4px; }
      .subtitle { font-size: 12px; color: #475569; font-weight: 500; }
      
      .summary-box { display: flex; justify-content: space-between; margin-bottom: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 15px; }
      .summary-item { text-align: center; }
      .summary-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; margin-bottom: 2px; }
      .summary-value { font-size: 13px; font-weight: bold; color: #0f172a; }

      table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
      th { background-color: #1e293b; color: white; font-weight: bold; padding: 8px 6px; text-align: left; border: 1px solid #1e293b; }
      td { padding: 7px 6px; border: 1px solid #e2e8f0; text-align: left; color: #334155; }
      tbody tr:nth-child(even) { background-color: #f8fafc; }
      
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .total-row { background-color: #0f172a !important; color: white; font-weight: bold; font-size: 11px; }
      .total-row td { color: white; border: 1px solid #0f172a; padding: 9px 6px; }
      
      .footer { margin-top: 25px; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 10px; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
  `)
  printWindow.document.write('</head><body>')
  
  printWindow.document.write(`
    <div class="header-container">
      <div class="title">ACCOUNTS PAYABLE AGING DETAIL REPORT</div>
      <div class="subtitle">As of ${formatDate(asOfDate)} • 5L SOLUTIONS CORP. • Currency: PHP (₱)</div>
    </div>
  `)

  printWindow.document.write(`
    <div class="summary-box">
      <div class="summary-item"><div class="summary-label">Current</div><div class="summary-value">${formatCurrency(stats.bucketCurrent)}</div></div>
      <div class="summary-item"><div class="summary-label">1-30 Days</div><div class="summary-value">${formatCurrency(stats.bucket1_30)}</div></div>
      <div class="summary-item"><div class="summary-label">31-60 Days</div><div class="summary-value">${formatCurrency(stats.bucket31_60)}</div></div>
      <div class="summary-item"><div class="summary-label">61-90 Days</div><div class="summary-value">${formatCurrency(stats.bucket61_90)}</div></div>
      <div class="summary-item"><div class="summary-label">> 90 Days</div><div class="summary-value">${formatCurrency(stats.bucket90_plus)}</div></div>
      <div class="summary-item"><div class="summary-label">Total Payables</div><div class="summary-value" style="color: #dc2626;">${formatCurrency(stats.totalAmount)}</div></div>
    </div>
  `)
  
  printWindow.document.write('<table>')
  printWindow.document.write('<thead><tr>')
  printWindow.document.write('<th>PO # / Ref</th>')
  printWindow.document.write('<th>Vendor Code</th>')
  printWindow.document.write('<th>Vendor Name</th>')
  printWindow.document.write('<th class="text-center">PO Date</th>')
  printWindow.document.write('<th class="text-center">Due Date</th>')
  printWindow.document.write('<th class="text-center">Terms</th>')
  printWindow.document.write('<th class="text-right">Current</th>')
  printWindow.document.write('<th class="text-right">1-30 Days</th>')
  printWindow.document.write('<th class="text-right">31-60 Days</th>')
  printWindow.document.write('<th class="text-right">61-90 Days</th>')
  printWindow.document.write('<th class="text-right">> 90 Days</th>')
  printWindow.document.write('<th class="text-right">Total Due</th>')
  printWindow.document.write('<th class="text-center">Status</th>')
  printWindow.document.write('</tr></thead>')
  printWindow.document.write('<tbody>')
  
  filteredPurchases.forEach((item) => {
    printWindow.document.write('<tr>')
    printWindow.document.write(`<td><strong>${item.id}</strong><br><span style="color:#64748b; font-size:9px;">Ref: ${item.doc_ref || '—'}</span></td>`)
    printWindow.document.write(`<td>${item.vendor_code}</td>`)
    printWindow.document.write(`<td>${item.vendor_name}</td>`)
    printWindow.document.write(`<td class="text-center">${item.date_delivered}</td>`)
    printWindow.document.write(`<td class="text-center">${item.date_due}</td>`)
    printWindow.document.write(`<td class="text-center">${item.terms}</td>`)
    printWindow.document.write(`<td class="text-right">${item.bucket_amounts.current > 0 ? formatCurrency(item.bucket_amounts.current) : '—'}</td>`)
    printWindow.document.write(`<td class="text-right">${item.bucket_amounts.b1_30 > 0 ? formatCurrency(item.bucket_amounts.b1_30) : '—'}</td>`)
    printWindow.document.write(`<td class="text-right">${item.bucket_amounts.b31_60 > 0 ? formatCurrency(item.bucket_amounts.b31_60) : '—'}</td>`)
    printWindow.document.write(`<td class="text-right">${item.bucket_amounts.b61_90 > 0 ? formatCurrency(item.bucket_amounts.b61_90) : '—'}</td>`)
    printWindow.document.write(`<td class="text-right">${item.bucket_amounts.b90_plus > 0 ? formatCurrency(item.bucket_amounts.b90_plus) : '—'}</td>`)
    printWindow.document.write(`<td class="text-right"><strong>${formatCurrency(item.amount_due)}</strong></td>`)
    printWindow.document.write(`<td class="text-center">${item.status}</td>`)
    printWindow.document.write('</tr>')
  })
  
  printWindow.document.write('</tbody>')
  printWindow.document.write('<tfoot><tr class="total-row">')
  printWindow.document.write('<td colspan="6" class="text-right">GRAND TOTAL PAYABLES:</td>')
  printWindow.document.write(`<td class="text-right">${formatCurrency(stats.bucketCurrent)}</td>`)
  printWindow.document.write(`<td class="text-right">${formatCurrency(stats.bucket1_30)}</td>`)
  printWindow.document.write(`<td class="text-right">${formatCurrency(stats.bucket31_60)}</td>`)
  printWindow.document.write(`<td class="text-right">${formatCurrency(stats.bucket61_90)}</td>`)
  printWindow.document.write(`<td class="text-right">${formatCurrency(stats.bucket90_plus)}</td>`)
  printWindow.document.write(`<td class="text-right">${formatCurrency(stats.totalAmount)}</td>`)
  printWindow.document.write('<td></td>')
  printWindow.document.write('</tr></tfoot>')
  printWindow.document.write('</table>')
  
  printWindow.document.write(`
    <div class="footer">
      <div>Record Count: <strong>${filteredPurchases.length}</strong></div>
      <div>Generated: ${new Date().toLocaleString()}</div>
    </div>
  `)
  
  printWindow.document.write('</body></html>')
  printWindow.document.close()
  printWindow.print()
}

export const handleExportCSV = (filteredPurchases, stats, asOfDate) => {
  if (filteredPurchases.length === 0) {
    alert('No data to export')
    return
  }

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; }
        .title { font-size: 16px; font-weight: bold; text-align: center; color: #0f172a; margin-bottom: 5px; }
        .subtitle { font-size: 11px; text-align: center; color: #475569; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th { background-color: #1e293b; color: #ffffff; font-weight: bold; text-align: left; padding: 8px; border: 1px solid #1e293b; }
        td { padding: 6px 8px; border: 1px solid #cbd5e1; vertical-align: middle; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .total-row { background-color: #0f172a; color: #ffffff; font-weight: bold; }
        .total-row td { color: #ffffff; border: 1px solid #0f172a; padding: 8px; }
      </style>
    </head>
    <body>
      <div class="title">ACCOUNTS PAYABLE AGING DETAIL REPORT</div>
      <div class="subtitle">As of ${formatDate(asOfDate)} | 5L SOLUTIONS CORP. | Currency: PHP (₱)</div>
      <table>
        <thead>
          <tr>
            <th>PO # / Ref</th>
            <th>Vendor Code</th>
            <th>Vendor Name</th>
            <th class="text-center">PO Date</th>
            <th class="text-center">Due Date</th>
            <th class="text-center">Terms</th>
            <th class="text-right">Current</th>
            <th class="text-right">1-30 Days</th>
            <th class="text-right">31-60 Days</th>
            <th class="text-right">61-90 Days</th>
            <th class="text-right">> 90 Days</th>
            <th class="text-right">Total Due</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          ${filteredPurchases
            .map(
              (item) => `
            <tr>
              <td>${item.id} (Ref:${item.doc_ref || '—'})</td>
              <td>${item.vendor_code}</td>
              <td>${item.vendor_name}</td>
              <td class="text-center">${item.date_delivered}</td>
              <td class="text-center">${item.date_due}</td>
              <td class="text-center">${item.terms}</td>
              <td class="text-right">${item.bucket_amounts.current || 0}</td>
              <td class="text-right">${item.bucket_amounts.b1_30 || 0}</td>
              <td class="text-right">${item.bucket_amounts.b31_60 || 0}</td>
              <td class="text-right">${item.bucket_amounts.b61_90 || 0}</td>
              <td class="text-right">${item.bucket_amounts.b90_plus || 0}</td>
              <td class="text-right"><strong>${item.amount_due || 0}</strong></td>
              <td class="text-center">${item.status}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="6" class="text-right">GRAND TOTAL PAYABLES:</td>
            <td class="text-right">${stats.bucketCurrent}</td>
            <td class="text-right">${stats.bucket1_30}</td>
            <td class="text-right">${stats.bucket31_60}</td>
            <td class="text-right">${stats.bucket61_90}</td>
            <td class="text-right">${stats.bucket90_plus}</td>
            <td class="text-right">${stats.totalAmount}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-top: 20px; font-size: 10px; color: #64748b;">
        Record Count: ${filteredPurchases.length} | Generated: ${new Date().toLocaleString()}
      </div>
    </body>
    </html>
  `

  const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `aging_payables_${Date.now()}.xls`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}