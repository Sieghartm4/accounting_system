export const formatCurrency = (value) => {
  const amount = Number(value) || 0
  const absValue = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return amount < 0 ? `($${absValue})` : `$${absValue}`
}

const formatPeriodLabel = (startDate, endDate) => {
  try {
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth()
    ) {
      return start.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    }

    return `${start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })} - ${end.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`
  } catch {
    return ''
  }
}

const renderLine = (doc, y, leftText, rightText, pageWidth, margin) => {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(leftText, margin, y)
  doc.text(rightText, pageWidth - margin, y, { align: 'right' })
}

export async function generateBankReconciliationPDF(data) {
  const { jsPDF } = await import('jspdf')

  const {
    reconData,
    summary,
    detailStartDate,
    detailEndDate,
    bankStatementEndingBalance,
    endingBookBalance,
    depositsInTransit,
    outstandingChecks,
    bankAdditions,
    bankDeductions,
    bankCardAdditions,
    bankCardDeductions,
    bankErrors,
    bookAdditions,
    bookDeductions,
    bookCardAdditions,
    bookCardDeductions,
    bookErrorAdjustments,
    bankCardErrors,
    adjustedBankBalance,
    adjustedBookBalance,
    reconDifference,
    isReconciled,
    bankAdjustments,
    bookAdjustments,
  } = data

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 35
  const contentWidth = pageWidth - 2 * margin
  let y = 40

  const bankAccount = reconData?.bank_account || 'N/A'
  const accountName = reconData?.account_name || 'N/A'
  const ledgerCode = reconData?.coa_id
    ? `${reconData.coa_id} - ${accountName}`
    : accountName
  const preparedBy = summary?.prepared_by || 'Accountant'
  const periodLabel = formatPeriodLabel(detailStartDate, detailEndDate)
  const statusLabel = isReconciled
    ? '✔ RECONCILED — Adjusted balances match'
    : '✘ UNRECONCILED — Variance of ' + formatCurrency(reconDifference)

  // Helper for adding pages
  const addNewPage = () => {
    doc.addPage()
    y = margin
  }

  // Helper for checking if we need a new page
  const checkPageSpace = (spaceLinesNeeded = 3) => {
    if (y + spaceLinesNeeded * 16 > pageHeight - margin) {
      addNewPage()
    }
  }

  // HEADER
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('MONTHLY BANK RECONCILIATION WORKPAPER', pageWidth / 2, y, {
    align: 'center',
  })

  y += 16
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)
  y += 20

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Bank Account:', margin, y)
  doc.text(bankAccount, margin + 100, y)
  doc.text('Period:', pageWidth - margin - 130, y)
  doc.text(periodLabel, pageWidth - margin, y, { align: 'right' })

  y += 14
  doc.text('Ledger Code:', margin, y)
  doc.text(ledgerCode, margin + 100, y)
  doc.text('Prepared By:', pageWidth - margin - 130, y)
  doc.text(preparedBy, pageWidth - margin, y, { align: 'right' })

  y += 12
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 18

  const bankDepositTotal =
    Number(depositsInTransit || 0) + Number(bankCardAdditions || 0)
  const bankOutstandingTotal =
    Number(outstandingChecks || 0) + Number(bankCardDeductions || 0)
  const bookCreditTotal = Number(bookAdditions || 0) + Number(bookCardAdditions || 0)
  const bookDebitTotal =
    Number(bookDeductions || 0) + Number(bookCardDeductions || 0)

  // SECTION 1: BANK STATEMENT BALANCES
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('1. BANK STATEMENT BALANCES', margin, y)
  y += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  // Ending Balance per Bank Statement
  doc.text('Ending Balance per Bank Statement', margin, y)
  doc.text(formatCurrency(bankStatementEndingBalance), pageWidth - margin, y, {
    align: 'right',
  })
  y += 14

  // ADD: Deposits in Transit
  checkPageSpace(4)
  doc.text('ADD: Deposits in Transit (Itemized)', margin, y)
  y += 14

  // List individual deposit adjustments
  bankAdjustments
    .filter((adj) => adj.type === 'deposits_in_transit')
    .forEach((adj) => {
      checkPageSpace(2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`  • ${adj.description || 'Deposit in Transit'}`, margin + 10, y)
      doc.text(formatCurrency(adj.amount), pageWidth - margin, y, {
        align: 'right',
      })
      y += 11
    })

  // Subtotal for deposits
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Deposits Subtotal', margin + 20, y)
  doc.text(formatCurrency(bankDepositTotal), pageWidth - margin, y, {
    align: 'right',
  })
  y += 14

  // DEDUCT: Outstanding Checks
  checkPageSpace(4)
  doc.setFont('helvetica', 'normal')
  doc.text('DEDUCT: Outstanding Checks (Itemized)', margin, y)
  y += 14

  // List individual outstanding check adjustments
  bankAdjustments
    .filter((adj) => adj.type === 'outstanding_checks')
    .forEach((adj) => {
      checkPageSpace(2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(`  • ${adj.description || 'Outstanding Check'}`, margin + 10, y)
      doc.text(formatCurrency(-adj.amount), pageWidth - margin, y, {
        align: 'right',
      })
      y += 11
    })

  // Subtotal for outstanding checks
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Checks Subtotal', margin + 20, y)
  doc.text(formatCurrency(-bankOutstandingTotal), pageWidth - margin, y, {
    align: 'right',
  })
  y += 14

  // Bank errors (if any)
  if (
    bankAdjustments.filter((adj) => adj.type === 'error_bank').length > 0 ||
    bankCardErrors !== 0
  ) {
    checkPageSpace(4)
    doc.setFont('helvetica', 'normal')
    doc.text('ADD/DEDUCT: Bank Error Corrections', margin, y)
    y += 14

    bankAdjustments
      .filter((adj) => adj.type === 'error_bank')
      .forEach((adj) => {
        checkPageSpace(2)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        const sign = parseFloat(adj.amount) >= 0 ? '+' : '−'
        doc.text(`  • ${adj.description || 'Bank Error'}`, margin + 10, y)
        doc.text(
          `${sign} ${formatCurrency(Math.abs(adj.amount))}`,
          pageWidth - margin,
          y,
          { align: 'right' },
        )
        y += 11
      })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Bank Errors Subtotal', margin + 20, y)
    doc.text(formatCurrency(bankCardErrors), pageWidth - margin, y, {
      align: 'right',
    })
    y += 14
  }

  checkPageSpace(3)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 14

  // ADJUSTED BANK STATEMENT BALANCE
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('ADJUSTED BANK STATEMENT BALANCE', margin, y)
  doc.text(formatCurrency(adjustedBankBalance), pageWidth - margin, y, {
    align: 'right',
  })
  y += 16

  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)
  y += 20

  // SECTION 2: GENERAL LEDGER BOOKS
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('2. COMPANY GENERAL LEDGER BOOKS', margin, y)
  y += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  // Ending Balance per GL
  doc.text('Ending Balance per General Ledger', margin, y)
  doc.text(formatCurrency(endingBookBalance), pageWidth - margin, y, {
    align: 'right',
  })
  y += 14

  // ADD: Book Additions
  checkPageSpace(4)
  doc.text('ADD: Unrecorded Bank Credits (Itemized)', margin, y)
  y += 14

  // List individual book credit adjustments
  bookAdjustments
    .filter((adj) => adj.type === 'interest_income' || adj.type === 'credit_memo')
    .forEach((adj) => {
      checkPageSpace(2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const label =
        adj.type === 'interest_income'
          ? 'Interest Earned'
          : adj.type === 'credit_memo'
            ? 'Bank Credit Memo / EFT'
            : adj.description || 'Credit'
      doc.text(`  • ${label}`, margin + 10, y)
      doc.text(formatCurrency(adj.amount), pageWidth - margin, y, {
        align: 'right',
      })
      y += 11
    })

  // Subtotal for additions
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Credits Subtotal', margin + 20, y)
  doc.text(formatCurrency(bookCreditTotal), pageWidth - margin, y, {
    align: 'right',
  })
  y += 14

  // DEDUCT: Book Deductions
  checkPageSpace(4)
  doc.setFont('helvetica', 'normal')
  doc.text('DEDUCT: Unrecorded Bank Charges (Itemized)', margin, y)
  y += 14

  // List individual book debit adjustments
  bookAdjustments
    .filter(
      (adj) =>
        adj.type === 'bank_charges' ||
        adj.type === 'nsf_checks' ||
        adj.type === 'debit_memo',
    )
    .forEach((adj) => {
      checkPageSpace(2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      const label =
        adj.type === 'bank_charges'
          ? 'Bank Service Fee'
          : adj.type === 'nsf_checks'
            ? 'NSF / Bounced Check'
            : adj.type === 'debit_memo'
              ? 'Bank Debit Memo'
              : adj.description || 'Charge'
      doc.text(`  • ${label}`, margin + 10, y)
      doc.text(formatCurrency(-adj.amount), pageWidth - margin, y, {
        align: 'right',
      })
      y += 11
    })

  // Subtotal for deductions
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('Charges Subtotal', margin + 20, y)
  doc.text(formatCurrency(-bookDebitTotal), pageWidth - margin, y, {
    align: 'right',
  })
  y += 14

  // Book errors (if any)
  if (
    bookAdjustments.filter((adj) => adj.type === 'error_book').length > 0 ||
    bookErrorAdjustments !== 0
  ) {
    checkPageSpace(4)
    doc.setFont('helvetica', 'normal')
    doc.text('ADD/DEDUCT: Book Error Corrections', margin, y)
    y += 14

    bookAdjustments
      .filter((adj) => adj.type === 'error_book')
      .forEach((adj) => {
        checkPageSpace(2)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        const sign = parseFloat(adj.amount) >= 0 ? '+' : '−'
        doc.text(`  • ${adj.description || 'Book Error'}`, margin + 10, y)
        doc.text(
          `${sign} ${formatCurrency(Math.abs(adj.amount))}`,
          pageWidth - margin,
          y,
          { align: 'right' },
        )
        y += 11
      })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text('Book Errors Subtotal', margin + 20, y)
    doc.text(
      formatCurrency(bookErrorAdjustments + bookCardErrors),
      pageWidth - margin,
      y,
      { align: 'right' },
    )
    y += 14
  }

  checkPageSpace(3)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 14

  // ADJUSTED BOOK BALANCE
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('ADJUSTED BOOK BALANCE', margin, y)
  doc.text(formatCurrency(adjustedBookBalance), pageWidth - margin, y, {
    align: 'right',
  })
  y += 16

  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)
  y += 20

  // SECTION 3: BALANCE CHECKER
  checkPageSpace(4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('3. BALANCE CHECKER', margin, y)
  y += 16

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Reconciliation Status:', margin, y)
  doc.text(statusLabel, margin, y + 14)
  y += 30
  doc.setLineWidth(0.8)
  doc.line(margin, y, pageWidth - margin, y)

  const filePeriod = periodLabel.replace(/\s+/g, '_')
  const fileName = `Bank_Reconciliation_${filePeriod}.pdf`

  doc.save(fileName)
}
