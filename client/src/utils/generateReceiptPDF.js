// generateReceiptPDF.js
// Place this in: src/utils/generateReceiptPDF.js
// Install deps: npm install jspdf jspdf-autotable

export async function generateReceiptPDF(receiptData, copyType = 'internal') {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  // API returns an array of grouped receipt objects
  const receipts = Array.isArray(receiptData) ? receiptData : [receiptData];

  for (let idx = 0; idx < receipts.length; idx++) {
    const receipt = receipts[idx];

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentW = pageW - margin * 2;

    const RED   = [204, 0, 0];
    const BLACK = [0, 0, 0];
    const GRAY  = [240, 240, 240];
    const DGRAY = [100, 100, 100];
    const WHITE = [255, 255, 255];
    const MGRAY = [160, 160, 160];

    let y = margin;

    // ── LOGO ──────────────────────────────────────────────────────────────────
    const company = receipt.company || {};
    if (company.logo) {
      try {
        const fmt = company.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(company.logo, fmt, pageW - margin - 52, y - 4, 52, 40);
      } catch (e) {
        console.warn('[PDF] Logo render failed:', e.message);
      }
    }

    // ── HEADER ────────────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...RED);
    doc.text('CASH DISBURSEMENTS # ' + (receipt.id ?? ''), margin, y + 14);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...DGRAY);
    const copyLabel = copyType === 'vendor' ? 'Vendor Copy' : 'Internal Copy';
    doc.text(copyLabel, margin, y + 26);

    // Company text block (right side, left of logo)
    const cBlockX = pageW - margin - 52 - 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);
    doc.text(company.company_name || '', cBlockX, y + 10, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...DGRAY);
    const contactLine = [company.phone, company.email].filter(Boolean).join('  |  ');
    if (contactLine) doc.text(contactLine, cBlockX, y + 20, { align: 'right' });
    if (company.tin) doc.text('TIN: ' + company.tin, cBlockX, y + 29, { align: 'right' });
    if (company.website) doc.text(company.website, cBlockX, y + 38, { align: 'right' });

    // ── DIVIDER ───────────────────────────────────────────────────────────────
    y += 50;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.75);
    doc.line(margin, y, pageW - margin, y);
    y += 12;

    // ── PARTY / DOC INFO ──────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
    doc.text(receipt.customer || '\u2014', margin, y + 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DGRAY);
    doc.text('000-000-000-00000', margin, y + 13);

    const rightColX = margin + contentW * 0.52;
    const valueColX = rightColX + 90;

    let collectionDate = '\u2014';
    if (receipt.collection_date) {
      try {
        collectionDate = new Date(receipt.collection_date).toLocaleDateString('en-US', {
          month: 'short', day: '2-digit', year: 'numeric'
        });
      } catch (_) {}
    }

    const modeDisplay = (receipt.mode === 'BANK' || receipt.bank_name)
      ? 'ET : Bank/Electronic Transfer'
      : receipt.mode ? ('ET : ' + receipt.mode) : '\u2014';

    const infoRows = [
      ['Doc Ref:', receipt.doc_ref || '\u2014'],
      ['Payment Date:', collectionDate],
      ['Mode:', modeDisplay],
    ];

    doc.setFontSize(8);
    infoRows.forEach(function(row, i) {
      const rowY = y + 2 + i * 11;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BLACK);
      doc.text(row[0], rightColX, rowY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DGRAY);
      doc.text(String(row[1]), valueColX, rowY);
    });

    y += 36;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 10;

    // ── ITEMS TABLE ───────────────────────────────────────────────────────────
    const items = Array.isArray(receipt.items) ? receipt.items : [];

    function fmt(v, d) {
      return parseFloat(v || 0).toLocaleString('en-PH', {
        minimumFractionDigits: d != null ? d : 2,
        maximumFractionDigits: d != null ? d : 2,
      });
    }

    const itemRows = items.map(function(item, i) {
      const qty  = parseFloat(item.quantity || 1);
      const pp   = parseFloat(item.purchase_price || 0);
      const tp   = parseFloat(item.total_price || pp * qty);
      const disc = parseFloat(item.discount_amount || 0);
      const vatP = item.vat_percentage != null ? item.vat_percentage + '%' : '0%';
      const vatA = parseFloat(item.vat_amount || 0);
      const whtP = item.wht_percentage != null ? item.wht_percentage + '%' : '0%';
      const whtA = parseFloat(item.wht_amount || 0);
      const due  = parseFloat(item.amount_due || tp);
      return [i + 1, item.product_name || '\u2014', item.description || '\u2014',
              item.unit || '\u2014', fmt(qty), fmt(pp), fmt(tp), fmt(disc),
              vatP, fmt(vatA), whtP, fmt(whtA), fmt(due)];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['#', 'Product or\nService', 'Description', 'Unit', 'Quantity',
              'Purchase\nPrice', 'Total\nPrice', 'Discount\nAmount',
              'VAT', 'VAT\nAmount', 'WHT', 'WHT\nAmount', 'Amount\nDue']],
      body: itemRows.length > 0 ? itemRows : [Array(13).fill('')],
      styles: { fontSize: 6.5, cellPadding: 3, textColor: BLACK,
                lineColor: [210, 210, 210], lineWidth: 0.4, overflow: 'linebreak' },
      headStyles: { fillColor: BLACK, textColor: WHITE, fontStyle: 'bold',
                    fontSize: 6.5, halign: 'center', valign: 'middle', minCellHeight: 22 },
      columnStyles: {
        0:  { halign: 'center', cellWidth: 16 },
        1:  { cellWidth: 58 },
        2:  { cellWidth: 55 },
        3:  { halign: 'center', cellWidth: 24 },
        4:  { halign: 'right',  cellWidth: 36 },
        5:  { halign: 'right',  cellWidth: 46 },
        6:  { halign: 'right',  cellWidth: 44 },
        7:  { halign: 'right',  cellWidth: 40 },
        8:  { halign: 'center', cellWidth: 24 },
        9:  { halign: 'right',  cellWidth: 40 },
        10: { halign: 'center', cellWidth: 24 },
        11: { halign: 'right',  cellWidth: 40 },
        12: { halign: 'right',  cellWidth: 46 },
      },
      alternateRowStyles: { fillColor: [252, 252, 252] },
    });

    y = doc.lastAutoTable.finalY + 8;

    // ── REMARKS ───────────────────────────────────────────────────────────────
    if (receipt.remarks) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...BLACK);
      doc.text('Remarks:', margin, y + 10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DGRAY);
      const wrapped = doc.splitTextToSize(receipt.remarks, contentW * 0.5);
      doc.text(wrapped, margin, y + 20);
      y += 14 + wrapped.length * 10;
    } else {
      y += 6;
    }

    // ── TOTALS BLOCK ──────────────────────────────────────────────────────────
    const totals = items.reduce(function(acc, item) {
      const qty = parseFloat(item.quantity || 1);
      acc.purchasePrice += parseFloat(item.purchase_price  || 0) * qty;
      acc.totalDiscount += parseFloat(item.discount_amount || 0);
      acc.totalVAT      += parseFloat(item.vat_amount      || 0);
      acc.vatableSales  += parseFloat(item.vatable_sales   || 0);
      acc.vatExempt     += parseFloat(item.vat_exempt_sales || 0);
      acc.zeroRated     += parseFloat(item.zero_rated_sales || 0);
      acc.totalWHT      += parseFloat(item.wht_amount      || 0);
      return acc;
    }, { purchasePrice: 0, totalDiscount: 0, totalVAT: 0,
         vatableSales: 0, vatExempt: 0, zeroRated: 0, totalWHT: 0 });

    const amtDueTotal      = parseFloat(receipt.amount_due || 0);
    const discountedAmount = totals.purchasePrice - totals.totalDiscount;
    const netOfVAT         = discountedAmount - totals.totalVAT;

    function fmt1(v) {
      return parseFloat(v || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 1, maximumFractionDigits: 1
      });
    }

    const totalsBlockW = contentW * 0.46;
    const totalsStartX = margin + contentW - totalsBlockW;
    const labelX = totalsStartX + 6;
    const valX   = totalsStartX + totalsBlockW - 6;
    let ty = y + 4;

    const totalsRows = [
      ['Total Purchase Price',    fmt1(totals.purchasePrice)],
      ['Total Discount',          fmt1(totals.totalDiscount)],
      ['Total Discounted Amount', fmt1(discountedAmount)],
      ['Total VAT',               fmt1(totals.totalVAT)],
      null,
      ['VATable Sales',           fmt1(totals.vatableSales)],
      ['VAT-Exempt Sales',        fmt1(totals.vatExempt)],
      ['Zero Rated Sales',        fmt1(totals.zeroRated)],
      null,
      ['Total NOV Discount',      fmt1(0)],
      ['Total Net of VAT',        fmt1(netOfVAT)],
      ['Total WHT',               fmt1(totals.totalWHT)],
    ];

    doc.setFontSize(7.5);
    totalsRows.forEach(function(row) {
      if (!row) { ty += 5; return; }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DGRAY);
      doc.text(row[0], labelX, ty);
      doc.setTextColor(...BLACK);
      doc.text(row[1], valX, ty, { align: 'right' });
      ty += 11;
    });

    // Total Amount Due row
    ty += 2;
    doc.setFillColor(...GRAY);
    doc.rect(totalsStartX, ty - 9, totalsBlockW, 13, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...BLACK);
    doc.text('Total Amount Due', labelX, ty);
    doc.setTextColor(...RED);
    doc.text(fmt1(amtDueTotal), valX, ty, { align: 'right' });

    y = Math.max(ty + 18, y + 10);

    // ── JOURNAL TABLE ─────────────────────────────────────────────────────────
    const journal = Array.isArray(receipt.journal) ? receipt.journal : [];

    if (journal.length > 0) {
      function fmtJ(v) {
        return v ? parseFloat(v).toLocaleString('en-PH', {
          minimumFractionDigits: 2, maximumFractionDigits: 2
        }) : '';
      }

      const journalRows = journal.map(function(j) {
        return [j.account_name || '\u2014', j.responsibility_center || 'Unassigned',
                fmtJ(j.debit), fmtJ(j.credit)];
      });

      const totalDebit  = journal.reduce(function(s, j) { return s + parseFloat(j.debit  || 0); }, 0);
      const totalCredit = journal.reduce(function(s, j) { return s + parseFloat(j.credit || 0); }, 0);
      journalRows.push(['', '', fmtJ(totalDebit), fmtJ(totalCredit)]);

      const lastRowIdx = journalRows.length - 1;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Chart Of Accounts', 'Responsibility Center', 'Debit', 'Credit']],
        body: journalRows,
        styles: { fontSize: 7.5, cellPadding: 4, textColor: BLACK,
                  lineColor: [210, 210, 210], lineWidth: 0.4 },
        headStyles: { fillColor: [30, 30, 30], textColor: WHITE,
                      fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 150 },
          2: { halign: 'right', cellWidth: 80 },
          3: { halign: 'right', cellWidth: 80 },
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        didParseCell: function(data) {
          if (data.row.index === lastRowIdx) {
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });
    }

    // ── FOOTER ────────────────────────────────────────────────────────────────
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 30, pageW - margin, pageH - 30);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...MGRAY);
    doc.text(
      'Generated on ' + new Date().toLocaleString('en-PH') + '  \u00b7  ' + copyLabel + '  \u00b7  Receipt #' + (receipt.id ?? ''),
      pageW / 2, pageH - 18, { align: 'center' }
    );

    // ── SAVE ──────────────────────────────────────────────────────────────────
    doc.save('cash_disbursement_' + (receipt.id ?? idx) + '_' + copyType + '.pdf');
  }
}