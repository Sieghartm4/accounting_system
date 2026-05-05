// generateDisbursementPDF.js
// Place this in: src/utils/generateDisbursementPDF.js
// Install deps: npm install jspdf jspdf-autotable

export async function generateDisbursementPDF(disbursementData, copyType = 'internal') {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const disbursements = Array.isArray(disbursementData) ? disbursementData : [disbursementData];

  for (let idx = 0; idx < disbursements.length; idx++) {
    const disbursement = disbursements[idx];

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentW = pageW - margin * 2;

    // ── COLOUR PALETTE ────────────────────────────────────────────────────────
    const RED        = [204, 0, 0];
    const BLACK      = [0, 0, 0];
    const GRAY       = [240, 240, 240];
    const DGRAY      = [100, 100, 100];
    const WHITE      = [255, 255, 255];
    const MGRAY      = [160, 160, 160];
    const NEAR_BLACK = [30, 30, 30];

    const copyLabel = copyType === 'vendor' ? 'Vendor Copy' : 'Internal Copy';
    const company   = disbursement.company || {};

    let y = margin;

    // ── LOGO ───────────────────────────────────────────────────────────────
    const LOGO_W = 52;
    const LOGO_H = 40;
    const logoX  = pageW - margin - LOGO_W;

    if (company.logo) {
      try {
        const fmt = company.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(company.logo, fmt, logoX, y - 4, LOGO_W, LOGO_H);
      } catch (e) {
        console.warn('[PDF] Logo render failed:', e.message);
      }
    }

    // ── HEADER TEXT ───────────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...RED);
    doc.text('CASH DISBURSEMENT # ' + (disbursement.id ?? ''), margin, y + 14);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...DGRAY);
    doc.text(copyLabel, margin, y + 26);

    const cBlockRightX = logoX - 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BLACK);
    doc.text(company.company_name || '', cBlockRightX, y + 10, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...DGRAY);

    const contactLine = [company.phone, company.email].filter(Boolean).join('  |  ');
    if (contactLine) doc.text(contactLine, cBlockRightX, y + 21, { align: 'right' });

    const tinWebLine = [
      company.tin     ? 'TIN: ' + company.tin : null,
      company.website ? company.website        : null,
    ].filter(Boolean).join('  |  ');
    if (tinWebLine) doc.text(tinWebLine, cBlockRightX, y + 31, { align: 'right' });

    // ── DIVIDER ───────────────────────────────────────────────────────────────
    y += 48;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.75);
    doc.line(margin, y, pageW - margin, y);
    y += 13;

    // ── PARTY / DOC INFO ──────────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);
    doc.text(disbursement.customer || '—', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...DGRAY);
    doc.text(disbursement.customer_tin || '000-000-000-00000', margin, y + 12);

    const INFO_LABEL_X = margin + contentW * 0.52;
    const INFO_VALUE_X = INFO_LABEL_X + 92;

    let paymentDate = '—';
    if (disbursement.collection_date) {
      try {
        paymentDate = new Date(disbursement.collection_date).toLocaleDateString('en-US', {
          month: 'short', day: '2-digit', year: 'numeric',
        });
      } catch (_) {}
    }

    const modeDisplay =
      disbursement.mode === 'BANK' || disbursement.bank_name
        ? 'ET : Bank/Electronic Transfer'
        : disbursement.mode
        ? 'ET : ' + disbursement.mode
        : '—';

    const infoRows = [
      ['Doc Ref:',      disbursement.doc_ref || '—'],
      ['Payment Date:', paymentDate],
      ['Mode:',         modeDisplay],
    ];

    infoRows.forEach(([lbl, val], i) => {
      const rowY = y + i * 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...BLACK);
      doc.text(lbl, INFO_LABEL_X, rowY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DGRAY);
      doc.text(String(val), INFO_VALUE_X, rowY);
    });

    y += 38;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 10;

    // ── FORMAT HELPERS ────────────────────────────────────────────────────────
    const fmt2 = (v) =>
      parseFloat(v || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });

    const fmt1 = (v) =>
      parseFloat(v || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      });

    const fmtJ = (v) =>
      v != null && v !== '' && parseFloat(v) !== 0
        ? parseFloat(v).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';

    // ── ITEMS TABLE ───────────────────────────────────────────────────────────
    const items = Array.isArray(disbursement.items) ? disbursement.items : [];

    const itemRows = items.map((item, i) => {
      const qty  = parseFloat(item.quantity        || 1);
      const pp   = parseFloat(item.purchase_price  || 0);
      const tp   = parseFloat(item.total_price     || pp * qty);
      const disc = parseFloat(item.discount_amount || 0);
      const vatP = item.vat_percentage != null ? item.vat_percentage + '%' : '0%';
      const vatA = parseFloat(item.vat_amount      || 0);
      const whtP = item.wht_percentage != null ? item.wht_percentage + '%' : '0%';
      const whtA = parseFloat(item.wht_amount      || 0);
      const due  = parseFloat(item.amount_due      || tp);
      return [
        i + 1,
        item.product_name || '—',
        item.description  || '—',
        item.unit         || '—',
        fmt2(qty),
        fmt2(pp),
        fmt2(tp),
        fmt2(disc),
        vatP,
        fmt2(vatA),
        whtP,
        fmt2(whtA),
        fmt2(due),
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [[
        '#', 'Product or\nService', 'Description', 'Unit', 'Quantity',
        'Purchase\nPrice', 'Total\nPrice', 'Discount\nAmount',
        'VAT', 'VAT\nAmount', 'WHT', 'WHT\nAmount', 'Amount\nDue',
      ]],
      body: itemRows.length > 0 ? itemRows : [Array(13).fill('')],
      styles: {
        fontSize: 6.5,
        cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
        textColor: BLACK,
        lineColor: [210, 210, 210],
        lineWidth: 0.4,
        overflow: 'linebreak',
        font: 'helvetica',
      },
      headStyles: {
        fillColor: BLACK,
        textColor: WHITE,
        fontStyle: 'bold',
        fontSize: 6.5,
        halign: 'center',
        valign: 'middle',
        minCellHeight: 24,
      },
      columnStyles: {
        0:  { halign: 'center', cellWidth: 16 },
        1:  { halign: 'left',   cellWidth: 58 },
        2:  { halign: 'left',   cellWidth: 55 },
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
      tableLineColor: [210, 210, 210],
      tableLineWidth: 0.4,
    });

    y = doc.lastAutoTable.finalY + 10;

    // ── REMARKS ───────────────────────────────────────────────────────────────
    if (disbursement.remarks) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...BLACK);
      doc.text('Remarks:', margin, y + 10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DGRAY);
      const wrapped = doc.splitTextToSize(disbursement.remarks, contentW * 0.5);
      doc.text(wrapped, margin, y + 21);
      y += 16 + wrapped.length * 10;
    } else {
      y += 6;
    }

    // ── TOTALS BLOCK ──────────────────────────────────────────────────────────
    const totals = items.reduce(
      (acc, item) => {
        const qty = parseFloat(item.quantity || 1);
        acc.purchasePrice += parseFloat(item.purchase_price   || 0) * qty;
        acc.totalDiscount += parseFloat(item.discount_amount  || 0);
        acc.totalVAT      += parseFloat(item.vat_amount       || 0);
        acc.vatableSales  += parseFloat(item.vatable_sales    || 0);
        acc.vatExempt     += parseFloat(item.vat_exempt_sales || 0);
        acc.zeroRated     += parseFloat(item.zero_rated_sales || 0);
        acc.totalWHT      += parseFloat(item.wht_amount       || 0);
        return acc;
      },
      { purchasePrice: 0, totalDiscount: 0, totalVAT: 0,
        vatableSales: 0, vatExempt: 0, zeroRated: 0, totalWHT: 0 }
    );

    const amtDueTotal      = parseFloat(disbursement.amount_due || 0);
    const discountedAmount = totals.purchasePrice - totals.totalDiscount;
    const netOfVAT         = discountedAmount - totals.totalVAT;

    const TOTALS_W = contentW * 0.46;
    const TOTALS_X = margin + contentW - TOTALS_W;
    const LABEL_X  = TOTALS_X + 6;
    const VALUE_X  = TOTALS_X + TOTALS_W - 6;
    const ROW_H    = 12;

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
    totalsRows.forEach((row) => {
      if (!row) { ty += 6; return; }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...DGRAY);
      doc.text(row[0], LABEL_X, ty);
      doc.setTextColor(...BLACK);
      doc.text(row[1], VALUE_X, ty, { align: 'right' });
      ty += ROW_H;
    });

    // Total Amount Due highlighted row
    ty += 3;
    const DUE_ROW_H = 15;
    doc.setFillColor(...GRAY);
    doc.rect(TOTALS_X, ty - DUE_ROW_H + 4, TOTALS_W, DUE_ROW_H, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...BLACK);
    doc.text('Total Amount Due', LABEL_X, ty);
    doc.setTextColor(...RED);
    doc.text(fmt1(amtDueTotal), VALUE_X, ty, { align: 'right' });

    y = Math.max(ty + 20, y + 12);

    // ── JOURNAL TABLE ─────────────────────────────────────────────────────────
    const journal = Array.isArray(disbursement.journal) ? disbursement.journal : [];
    console.log('Journal data:', journal);

    if (journal.length > 0) {
      const journalRows = journal.map((j) => {
        console.log('Journal entry:', j);
        return [
          j.account_name          || '—',
          j.responsibility_center || 'Unassigned',
          fmtJ(j.debit),
          fmtJ(j.credit),
        ];
      });

      const totalDebit  = journal.reduce((s, j) => s + parseFloat(j.debit  || 0), 0);
      const totalCredit = journal.reduce((s, j) => s + parseFloat(j.credit || 0), 0);
      journalRows.push(['', '', fmtJ(totalDebit), fmtJ(totalCredit)]);

      const lastRowIdx = journalRows.length - 1;

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Chart Of Accounts', 'Responsibility Center', 'Debit', 'Credit']],
        body: journalRows,
        styles: {
          fontSize: 7.5,
          cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
          textColor: BLACK,
          lineColor: [210, 210, 210],
          lineWidth: 0.4,
          font: 'helvetica',
        },
        headStyles: {
          fillColor: NEAR_BLACK,
          textColor: WHITE,
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'center',
          valign: 'middle',
          minCellHeight: 20,
        },
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'left' },
          1: { cellWidth: 150,   halign: 'left' },
          2: { cellWidth: 80,    halign: 'right' },
          3: { cellWidth: 80,    halign: 'right' },
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        tableLineColor: [210, 210, 210],
        tableLineWidth: 0.4,
        didParseCell(data) {
          if (data.section === 'body' && data.row.index === lastRowIdx) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = BLACK;
          }
        },
      });

      y = doc.lastAutoTable.finalY + 8;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── AUTHORIZATION / SIGNATURE SECTION ────────────────────────────────────
    //    Positioned using `y` — flows right after the last content block.
    //    No more fixed footerY. No more huge gap.
    // ─────────────────────────────────────────────────────────────────────────
    y += 16;

    // "AUTHORIZATION" section label sits on the divider line
    doc.setDrawColor(...MGRAY);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageW - margin, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...MGRAY);
    doc.text('AUTHORIZATION', margin, y - 3);

    y += 8;

    const SIG_HEADER_H = 16;   // height of the dark label bar
    const SIG_BODY_H   = 60;   // height of the signature area below the bar
    const SIG_TOTAL_H  = SIG_HEADER_H + SIG_BODY_H;
    const colW         = contentW / 3;

    const signFields = [
      { label: 'SUBMITTED BY', value: disbursement.created_by },
      { label: 'CHECKED BY',   value: disbursement.checked_by },
      { label: 'APPROVED BY',  value: disbursement.approved_by },
    ];

    // Single outer border wrapping all three columns
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, contentW, SIG_TOTAL_H, 'S');

    signFields.forEach((field, i) => {
      const sx = margin + i * colW;

      // Dark header bar per column
      doc.setFillColor(...NEAR_BLACK);
      doc.rect(sx, y, colW, SIG_HEADER_H, 'F');

      // Divider line between columns (header region, slightly lighter)
      if (i > 0) {
        doc.setDrawColor(55, 55, 55);
        doc.setLineWidth(0.4);
        doc.line(sx, y, sx, y + SIG_HEADER_H);
      }

      // Column label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...WHITE);
      doc.text(field.label, sx + colW / 2, y + SIG_HEADER_H - 4, { align: 'center' });

      // Divider line between columns (body region)
      if (i > 0) {
        doc.setDrawColor(210, 210, 210);
        doc.setLineWidth(0.4);
        doc.line(sx, y + SIG_HEADER_H, sx, y + SIG_TOTAL_H);
      }

      // Signature line — sits near the bottom of the body area
      const lineY  = y + SIG_HEADER_H + SIG_BODY_H - 14;
      const lineX1 = sx + 16;
      const lineX2 = sx + colW - 16;

      // Name printed above the line
      if (field.value) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...BLACK);
        doc.text(field.value, sx + colW / 2, lineY - 5, { align: 'center' });
      }

      // The line itself
      doc.setDrawColor(...MGRAY);
      doc.setLineWidth(0.5);
      doc.line(lineX1, lineY, lineX2, lineY);

      // "Signature over Printed Name" label below the line
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...MGRAY);
      doc.text('Signature over Printed Name', sx + colW / 2, lineY + 9, { align: 'center' });
    });

    y += SIG_TOTAL_H;

    // ─────────────────────────────────────────────────────────────────────────
    // ── FOOTER BAR — always pinned to the very bottom of the page ────────────
    // ─────────────────────────────────────────────────────────────────────────
    const FOOTER_H   = 20;
    const footerBarY = pageH - margin - FOOTER_H;

    // Thin red rule directly above the bar
    doc.setDrawColor(...RED);
    doc.setLineWidth(1);
    doc.line(margin, footerBarY - 3, pageW - margin, footerBarY - 3);

    // Dark filled bar
    doc.setFillColor(...NEAR_BLACK);
    doc.rect(margin, footerBarY, contentW, FOOTER_H, 'F');

    // Left — disbursement reference + copy type
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...WHITE);
    doc.text(
      'Disbursement #' + (disbursement.id ?? '') + '  ·  ' + copyLabel,
      margin + 8,
      footerBarY + FOOTER_H / 2 + 2.5
    );

    // Right — generated timestamp
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(
      'Generated: ' + new Date().toLocaleString('en-PH'),
      margin + contentW - 8,
      footerBarY + FOOTER_H / 2 + 2.5,
      { align: 'right' }
    );

    // ── SAVE ──────────────────────────────────────────────────────────────────
    doc.save('cash_disbursement_' + (disbursement.id ?? idx) + '_' + copyType + '.pdf');
  }
}