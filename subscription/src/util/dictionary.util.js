const statusMap = {
  // Statuses
  WH: 'WAREHOUSE',
  DLV: 'TO BE DELIVER TO CLIENT',
  NPD: 'NOT PAID',
  SLD: 'SOLD',
  PIC: 'FOR PICKUP TO WAREHOUSE',
  PD: 'PAID',
  NSTK: 'NO STOCKS AVAILABLE',
  REQ: 'REQUEST',
  PND: 'PENDING',
  APD: 'APPROVED',
  ALLOC: 'ALLOCATE SERIALS',
  ALLOCP: 'ALLOCATE PRICE',
  REQB: 'REQUEST BUDGET',
  WAIT: 'WAITING',
  RES: 'RESTOCK',
  FAPR: 'FOR APPROVAL',
  SPR: 'SPARE',
  DLY: 'DEPLOYED',
  RET: 'RETURNED',
  ACT: 'ACTIVE',
  INACT: 'INACTIVE',
  CND: 'CANCELLED',
  STR: 'START',
  CLD: 'CLOSED',
  INP: 'IN PROGRESS',
  DND: 'DONE',
  CMP: 'COMPLETED',
  RFND: 'REFUNDED',

  // Actions
  REM: 'REMOVE',
  UPD: 'UPDATE',
  INST: 'INST',
  INSD: 'INSERT DATA',
  UPDT: 'UPDATE DATA',
  SYNC: 'SYNCHRONIZE',

  // Modules / Categories
  MSTR: 'MASTERS',
  SALES: 'SALES',
  LOGIN: 'LOGIN',
  TRN: 'TRANSACTION',
  INV: 'INVENTORY',
  PRD: 'PRODUCTION',
  PO: 'PURCHASE ORDER',
  TRF: 'TRANSFER',
  TRFR: 'TRANSFER REPORT',

  // Log Types
  INF: 'INFO',
  WRN: 'WARNING',
  ERR: 'ERROR',
}

// --- GetValue Function ---
/**
 * Gets the full description for a status abbreviation.
 * @param {string} abr - The status abbreviation (e.g., 'WH', 'PD').
 * @returns {string} The full description or the original code if not found.
 */
exports.GetValue = (abr) => {
  return statusMap[abr] || abr
}

Object.keys(statusMap).forEach((key) => {
  exports[key] = statusMap[key]
})
