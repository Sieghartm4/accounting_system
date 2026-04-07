const Accounting = {
  cash_disbursements: {
    tablename: "cash_disbursements",
    prefix: "cd",
    prefix_: "cd_",
    insertColumns: [
      "vendor_id",
      "document_reference",
      "payment_date",
      "mode_of_payment",
      "bank_name",
      "check_number",
      "remarks",
      "total_amount_due",
      "status",
      "state",
      "created_date",
      "created_by"
    ],
    selectColumns: [
      "cd_id",
      "cd_vendor_id",
      "cd_document_reference",
      "cd_payment_date",
      "cd_mode_of_payment",
      "cd_bank_name",
      "cd_check_number",
      "cd_remarks",
      "cd_total_amount_due",
      "cd_status",
      "cd_state",
      "cd_created_date",
      "cd_created_by"
    ],
    selectOptionColumns: {
      id: "cd_id",
      vendor_id: "cd_vendor_id",
      document_reference: "cd_document_reference",
      payment_date: "cd_payment_date",
      mode_of_payment: "cd_mode_of_payment",
      bank_name: "cd_bank_name",
      check_number: "cd_check_number",
      remarks: "cd_remarks",
      total_amount_due: "cd_total_amount_due",
      status: "cd_status",
      state: "cd_state",
      created_date: "cd_created_date",
      created_by: "cd_created_by"
    },
    updateOptionColumns: {
      id: "id",
      vendor_id: "vendor_id",
      document_reference: "document_reference",
      payment_date: "payment_date",
      mode_of_payment: "mode_of_payment",
      bank_name: "bank_name",
      check_number: "check_number",
      remarks: "remarks",
      total_amount_due: "total_amount_due",
      status: "status",
      state: "state",
      created_date: "created_date",
      created_by: "created_by"
    },
    selectDateFormatColumns: {

    },
    selectMiscColumns: {
  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    vendor_id: "INTEGER",
    document_reference: "STRING",
    payment_date: "STRING",
    mode_of_payment: "STRING",
    bank_name: "STRING",
    check_number: "STRING",
    remarks: "TEXT",
    total_amount_due: "DECIMAL",
    status: "ENUM",
    state: "ENUM",
    created_date: "STRING",
    created_by: "STRING"
  }
},
	receipts: {
  tablename: "receipts",
  prefix: "r",
  prefix_: "r_",
  insertColumns: [
      "customer_id",
      "document_reference",
      "collection_date",
      "mode_of_payment",
      "bank_name",
      "check_number",
      "remarks",
      "total_amount_due",
      "status",
      "state",
      "created_date",
      "created_by"
    ],
  selectColumns: [
      "r_id",
      "r_customer_id",
      "r_document_reference",
      "r_collection_date",
      "r_mode_of_payment",
      "r_bank_name",
      "r_check_number",
      "r_remarks",
      "r_total_amount_due",
      "r_status",
      "r_state",
      "r_created_date",
      "r_created_by"
    ],
  selectOptionColumns: {
    id: "r_id",
    customer_id: "r_customer_id",
    document_reference: "r_document_reference",
    collection_date: "r_collection_date",
    mode_of_payment: "r_mode_of_payment",
    bank_name: "r_bank_name",
    check_number: "r_check_number",
    remarks: "r_remarks",
    total_amount_due: "r_total_amount_due",
    status: "r_status",
    state: "r_state",
    created_date: "r_created_date",
    created_by: "r_created_by"
  },
  updateOptionColumns: {
    id: "id",
    customer_id: "customer_id",
    document_reference: "document_reference",
    collection_date: "collection_date",
    mode_of_payment: "mode_of_payment",
    bank_name: "bank_name",
    check_number: "check_number",
    remarks: "remarks",
    total_amount_due: "total_amount_due",
    status: "status",
    state: "state",
    created_date: "created_date",
    created_by: "created_by"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    customer_id: "INTEGER",
    document_reference: "STRING",
    collection_date: "STRING",
    mode_of_payment: "STRING",
    bank_name: "STRING",
    check_number: "STRING",
    remarks: "TEXT",
    total_amount_due: "DECIMAL",
    status: "ENUM",
    state: "ENUM",
    created_date: "STRING",
    created_by: "STRING"
  }
},
	sales: {
  tablename: "sales",
  prefix: "s",
  prefix_: "s_",
  insertColumns: [
      "customer_id",
      "document_reference",
      "terms",
      "date_delivered",
      "date_due",
      "category",
      "remarks",
      "total_amount_due",
      "status",
      "state",
      "created_date",
      "created_by"
    ],
  selectColumns: [
      "s_id",
      "s_customer_id",
      "s_document_reference",
      "s_terms",
      "s_date_delivered",
      "s_date_due",
      "s_category",
      "s_remarks",
      "s_total_amount_due",
      "s_status",
      "s_state",
      "s_created_date",
      "s_created_by"
    ],
  selectOptionColumns: {
    id: "s_id",
    customer_id: "s_customer_id",
    document_reference: "s_document_reference",
    terms: "s_terms",
    date_delivered: "s_date_delivered",
    date_due: "s_date_due",
    category: "s_category",
    remarks: "s_remarks",
    total_amount_due: "s_total_amount_due",
    status: "s_status",
    state: "s_state",
    created_date: "s_created_date",
    created_by: "s_created_by"
  },
  updateOptionColumns: {
    id: "id",
    customer_id: "customer_id",
    document_reference: "document_reference",
    terms: "terms",
    date_delivered: "date_delivered",
    date_due: "date_due",
    category: "category",
    remarks: "remarks",
    total_amount_due: "total_amount_due",
    status: "status",
    state: "state",
    created_date: "created_date",
    created_by: "created_by"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    customer_id: "INTEGER",
    document_reference: "STRING",
    terms: "ENUM",
    date_delivered: "STRING",
    date_due: "STRING",
    category: "STRING",
    remarks: "TEXT",
    total_amount_due: "DECIMAL",
    status: "ENUM",
    state: "ENUM",
    created_date: "STRING",
    created_by: "STRING"
  }
},
	collections: {
  tablename: "collections",
  prefix: "c",
  prefix_: "c_",
  insertColumns: [
      "customer_id",
      "document_reference",
      "mode_of_payment",
      "bank_name",
      "check_number",
      "collection_date",
      "remarks",
      "status",
      "state",
      "created_date",
      "created_by"
    ],
  selectColumns: [
      "c_id",
      "c_customer_id",
      "c_document_reference",
      "c_mode_of_payment",
      "c_bank_name",
      "c_check_number",
      "c_collection_date",
      "c_remarks",
      "c_status",
      "c_state",
      "c_created_date",
      "c_created_by"
    ],
  selectOptionColumns: {
    id: "c_id",
    customer_id: "c_customer_id",
    document_reference: "c_document_reference",
    mode_of_payment: "c_mode_of_payment",
    bank_name: "c_bank_name",
    check_number: "c_check_number",
    collection_date: "c_collection_date",
    remarks: "c_remarks",
    status: "c_status",
    state: "c_state",
    created_date: "c_created_date",
    created_by: "c_created_by"
  },
  updateOptionColumns: {
    id: "id",
    customer_id: "customer_id",
    document_reference: "document_reference",
    mode_of_payment: "mode_of_payment",
    bank_name: "bank_name",
    check_number: "check_number",
    collection_date: "collection_date",
    remarks: "remarks",
    status: "status",
    state: "state",
    created_date: "created_date",
    created_by: "created_by"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    customer_id: "INTEGER",
    document_reference: "STRING",
    mode_of_payment: "ENUM",
    bank_name: "STRING",
    check_number: "TEXT",
    collection_date: "STRING",
    remarks: "TEXT",
    status: "ENUM",
    state: "ENUM",
    created_date: "STRING",
    created_by: "STRING"
  }
},
	cash_disbursement_items: {
  tablename: "cash_disbursement_items",
  prefix: "cdi",
  prefix_: "cdi_",
  insertColumns: [
      "cash_disbursement_id",
      "product_service",
      "charts_of_accounts",
      "description",
      "unit",
      "quantity",
      "purchase_price",
      "discount",
      "vat",
      "witholding_tax",
      "responsibility_center"
    ],
  selectColumns: [
      "cdi_id",
      "cdi_cash_disbursement_id",
      "cdi_product_service",
      "cdi_charts_of_accounts",
      "cdi_description",
      "cdi_unit",
      "cdi_quantity",
      "cdi_purchase_price",
      "cdi_discount",
      "cdi_vat",
      "cdi_witholding_tax",
      "cdi_responsibility_center"
    ],
  selectOptionColumns: {
    id: "cdi_id",
    cash_disbursement_id: "cdi_cash_disbursement_id",
    product_service: "cdi_product_service",
    charts_of_accounts: "cdi_charts_of_accounts",
    description: "cdi_description",
    unit: "cdi_unit",
    quantity: "cdi_quantity",
    purchase_price: "cdi_purchase_price",
    discount: "cdi_discount",
    vat: "cdi_vat",
    witholding_tax: "cdi_witholding_tax",
    responsibility_center: "cdi_responsibility_center"
  },
  updateOptionColumns: {
    id: "id",
    cash_disbursement_id: "cash_disbursement_id",
    product_service: "product_service",
    charts_of_accounts: "charts_of_accounts",
    description: "description",
    unit: "unit",
    quantity: "quantity",
    purchase_price: "purchase_price",
    discount: "discount",
    vat: "vat",
    witholding_tax: "witholding_tax",
    responsibility_center: "responsibility_center"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    cash_disbursement_id: "INTEGER",
    product_service: "STRING",
    charts_of_accounts: "INTEGER",
    description: "TEXT",
    unit: "STRING",
    quantity: "INTEGER",
    purchase_price: "DECIMAL",
    discount: "DECIMAL",
    vat: "DECIMAL",
    witholding_tax: "DECIMAL",
    responsibility_center: "STRING"
  }
},
	receipt_items: {
  tablename: "receipt_items",
  prefix: "ri",
  prefix_: "ri_",
  insertColumns: [
      "receipts_id",
      "product_service",
      "charts_of_accounts",
      "description",
      "unit",
      "quantity",
      "sales_price",
      "discount",
      "vat",
      "witholding_tax",
      "responsibility_center"
    ],
  selectColumns: [
      "ri_id",
      "ri_receipts_id",
      "ri_product_service",
      "ri_charts_of_accounts",
      "ri_description",
      "ri_unit",
      "ri_quantity",
      "ri_sales_price",
      "ri_discount",
      "ri_vat",
      "ri_witholding_tax",
      "ri_responsibility_center"
    ],
  selectOptionColumns: {
    id: "ri_id",
    receipts_id: "ri_receipts_id",
    product_service: "ri_product_service",
    charts_of_accounts: "ri_charts_of_accounts",
    description: "ri_description",
    unit: "ri_unit",
    quantity: "ri_quantity",
    sales_price: "ri_sales_price",
    discount: "ri_discount",
    vat: "ri_vat",
    witholding_tax: "ri_witholding_tax",
    responsibility_center: "ri_responsibility_center"
  },
  updateOptionColumns: {
    id: "id",
    receipts_id: "receipts_id",
    product_service: "product_service",
    charts_of_accounts: "charts_of_accounts",
    description: "description",
    unit: "unit",
    quantity: "quantity",
    sales_price: "sales_price",
    discount: "discount",
    vat: "vat",
    witholding_tax: "witholding_tax",
    responsibility_center: "responsibility_center"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    receipts_id: "INTEGER",
    product_service: "STRING",
    charts_of_accounts: "INTEGER",
    description: "TEXT",
    unit: "STRING",
    quantity: "INTEGER",
    sales_price: "DECIMAL",
    discount: "DECIMAL",
    vat: "DECIMAL",
    witholding_tax: "DECIMAL",
    responsibility_center: "STRING"
  }
},
	sales_items: {
  tablename: "sales_items",
  prefix: "si",
  prefix_: "si_",
  insertColumns: [
      "sales_id",
      "product_service",
      "charts_of_accounts",
      "description",
      "unit",
      "quantity",
      "purchase_price",
      "discount",
      "vat",
      "witholding_tax",
      "responsibility_center"
    ],
  selectColumns: [
      "si_id",
      "si_sales_id",
      "si_product_service",
      "si_charts_of_accounts",
      "si_description",
      "si_unit",
      "si_quantity",
      "si_purchase_price",
      "si_discount",
      "si_vat",
      "si_witholding_tax",
      "si_responsibility_center"
    ],
  selectOptionColumns: {
    id: "si_id",
    sales_id: "si_sales_id",
    product_service: "si_product_service",
    charts_of_accounts: "si_charts_of_accounts",
    description: "si_description",
    unit: "si_unit",
    quantity: "si_quantity",
    purchase_price: "si_purchase_price",
    discount: "si_discount",
    vat: "si_vat",
    witholding_tax: "si_witholding_tax",
    responsibility_center: "si_responsibility_center"
  },
  updateOptionColumns: {
    id: "id",
    sales_id: "sales_id",
    product_service: "product_service",
    charts_of_accounts: "charts_of_accounts",
    description: "description",
    unit: "unit",
    quantity: "quantity",
    purchase_price: "purchase_price",
    discount: "discount",
    vat: "vat",
    witholding_tax: "witholding_tax",
    responsibility_center: "responsibility_center"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    sales_id: "INTEGER",
    product_service: "STRING",
    charts_of_accounts: "INTEGER",
    description: "TEXT",
    unit: "STRING",
    quantity: "INTEGER",
    purchase_price: "DECIMAL",
    discount: "DECIMAL",
    vat: "DECIMAL",
    witholding_tax: "DECIMAL",
    responsibility_center: "STRING"
  }
},
	collection_items: {
  tablename: "collection_items",
  prefix: "ci",
  prefix_: "ci_",
  insertColumns: [
      "collection_id",
      "sales_id",
      "amount",
      "witholding_tax"
    ],
  selectColumns: [
      "ci_id",
      "ci_collection_id",
      "ci_sales_id",
      "ci_amount",
      "ci_witholding_tax"
    ],
  selectOptionColumns: {
    id: "ci_id",
    collection_id: "ci_collection_id",
    sales_id: "ci_sales_id",
    amount: "ci_amount",
    witholding_tax: "ci_witholding_tax"
  },
  updateOptionColumns: {
    id: "id",
    collection_id: "collection_id",
    sales_id: "sales_id",
    amount: "amount",
    witholding_tax: "witholding_tax"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    collection_id: "INTEGER",
    sales_id: "INTEGER",
    amount: "DECIMAL",
    witholding_tax: "DECIMAL"
  }
},
	cash_disbursement_attachments: {
  tablename: "cash_disbursement_attachments",
  prefix: "a",
  prefix_: "a_",
  insertColumns: [
      "cash_disburssement_id",
      "file",
      "name",
      "remarks",
      "uploaded_by",
      "uploaded_date"
    ],
  selectColumns: [
      "a_id",
      "a_cash_disburssement_id",
      "a_file",
      "a_name",
      "a_remarks",
      "a_uploaded_by",
      "a_uploaded_date"
    ],
  selectOptionColumns: {
    id: "a_id",
    cash_disburssement_id: "a_cash_disburssement_id",
    file: "a_file",
    name: "a_name",
    remarks: "a_remarks",
    uploaded_by: "a_uploaded_by",
    uploaded_date: "a_uploaded_date"
  },
  updateOptionColumns: {
    id: "id",
    cash_disburssement_id: "cash_disburssement_id",
    file: "file",
    name: "name",
    remarks: "remarks",
    uploaded_by: "uploaded_by",
    uploaded_date: "uploaded_date"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    cash_disburssement_id: "INTEGER",
    file: "TEXT",
    name: "STRING",
    remarks: "TEXT",
    uploaded_by: "STRING",
    uploaded_date: "STRING"
  }
},
	receipt_attachments: {
  tablename: "receipt_attachments",
  prefix: "ra",
  prefix_: "ra_",
  insertColumns: [
      "receipt_id",
      "file",
      "name",
      "remarks",
      "uploaded_by",
      "uploaded_date"
    ],
  selectColumns: [
      "ra_id",
      "ra_receipt_id",
      "ra_file",
      "ra_name",
      "ra_remarks",
      "ra_uploaded_by",
      "ra_uploaded_date"
    ],
  selectOptionColumns: {
    id: "ra_id",
    receipt_id: "ra_receipt_id",
    file: "ra_file",
    name: "ra_name",
    remarks: "ra_remarks",
    uploaded_by: "ra_uploaded_by",
    uploaded_date: "ra_uploaded_date"
  },
  updateOptionColumns: {
    id: "id",
    receipt_id: "receipt_id",
    file: "file",
    name: "name",
    remarks: "remarks",
    uploaded_by: "uploaded_by",
    uploaded_date: "uploaded_date"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    receipt_id: "INTEGER",
    file: "TEXT",
    name: "STRING",
    remarks: "TEXT",
    uploaded_by: "STRING",
    uploaded_date: "STRING"
  }
},
	sales_attachments: {
  tablename: "sales_attachments",
  prefix: "sa",
  prefix_: "sa_",
  insertColumns: [
      "sales_id",
      "file",
      "name",
      "remarks",
      "uploaded_by",
      "uploaded_date"
    ],
  selectColumns: [
      "sa_id",
      "sa_sales_id",
      "sa_file",
      "sa_name",
      "sa_remarks",
      "sa_uploaded_by",
      "sa_uploaded_date"
    ],
  selectOptionColumns: {
    id: "sa_id",
    sales_id: "sa_sales_id",
    file: "sa_file",
    name: "sa_name",
    remarks: "sa_remarks",
    uploaded_by: "sa_uploaded_by",
    uploaded_date: "sa_uploaded_date"
  },
  updateOptionColumns: {
    id: "id",
    sales_id: "sales_id",
    file: "file",
    name: "name",
    remarks: "remarks",
    uploaded_by: "uploaded_by",
    uploaded_date: "uploaded_date"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    sales_id: "INTEGER",
    file: "TEXT",
    name: "STRING",
    remarks: "TEXT",
    uploaded_by: "STRING",
    uploaded_date: "STRING"
  }
},
	collection_attachments: {
  tablename: "collection_attachments",
  prefix: "ca",
  prefix_: "ca_",
  insertColumns: [
      "collection_id",
      "file",
      "name",
      "remarks",
      "uploaded_by",
      "uploaded_date"
    ],
  selectColumns: [
      "ca_id",
      "ca_collection_id",
      "ca_file",
      "ca_name",
      "ca_remarks",
      "ca_uploaded_by",
      "ca_uploaded_date"
    ],
  selectOptionColumns: {
    id: "ca_id",
    collection_id: "ca_collection_id",
    file: "ca_file",
    name: "ca_name",
    remarks: "ca_remarks",
    uploaded_by: "ca_uploaded_by",
    uploaded_date: "ca_uploaded_date"
  },
  updateOptionColumns: {
    id: "id",
    collection_id: "collection_id",
    file: "file",
    name: "name",
    remarks: "remarks",
    uploaded_by: "uploaded_by",
    uploaded_date: "uploaded_date"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    collection_id: "INTEGER",
    file: "TEXT",
    name: "STRING",
    remarks: "TEXT",
    uploaded_by: "STRING",
    uploaded_date: "STRING"
  }
},
	journal_entries: {
  tablename: "journal_entries",
  prefix: "je",
  prefix_: "je_",
  insertColumns: [
      "db_name",
      "db_id",
      "coa_id",
      "responsibility_center",
      "type",
      "amount",
      "date"
    ],
  selectColumns: [
      "je_id",
      "je_db_name",
      "je_db_id",
      "je_coa_id",
      "je_responsibility_center",
      "je_type",
      "je_amount",
      "je_date"
    ],
  selectOptionColumns: {
    id: "je_id",
    db_name: "je_db_name",
    db_id: "je_db_id",
    coa_id: "je_coa_id",
    responsibility_center: "je_responsibility_center",
    type: "je_type",
    amount: "je_amount",
    date: "je_date"
  },
  updateOptionColumns: {
    id: "id",
    db_name: "db_name",
    db_id: "db_id",
    coa_id: "coa_id",
    responsibility_center: "responsibility_center",
    type: "type",
    amount: "amount",
    date: "date"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    db_name: "STRING",
    db_id: "INTEGER",
    coa_id: "INTEGER",
    responsibility_center: "STRING",
    type: "ENUM",
    amount: "DECIMAL",
    date: "STRING"
  }
},
};

exports.Accounting = Accounting;
