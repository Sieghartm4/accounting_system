const Master = {
 	master_access: {
  tablename: "master_access",
  prefix: "ma",
  prefix_: "ma_",
  insertColumns: [
      "access_name",
      "status"
    ],
  selectColumns: [
      "ma_access_id",
      "ma_access_name",
      "ma_status"
    ],
  selectOptionColumns: {
    access_id: "ma_access_id",
    access_name: "ma_access_name",
    status: "ma_status"
  },
  updateOptionColumns: {
    access_id: "access_id",
    access_name: "access_name",
    status: "status"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    access_id: "INTEGER",
    access_name: "STRING",
    status: "ENUM"
  }
},
 	master_user: {
  tablename: "master_user",
  prefix: "mu",
  prefix_: "mu_",
  insertColumns: [
      "fullname",
      "username",
      "password",
      "access_id"
    ],
  selectColumns: [
      "mu_id",
      "mu_fullname",
      "mu_username",
      "mu_password",
      "mu_access_id",
      "mu_status"
    ],
  selectOptionColumns: {
    id: "mu_id",
    fullname: "mu_fullname",
    username: "mu_username",
    password: "mu_password",
    access_id: "mu_access_id",
    status: "mu_status"
  },
  updateOptionColumns: {
    id: "id",
    fullname: "fullname",
    username: "username",
    password: "password",
    access_id: "access_id",
    status: "status"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    fullname: "STRING",
    username: "STRING",
    password: "TEXT",
    access_id: "INTEGER",
    status: "ENUM"
  }
},
 	master_company: {
  tablename: "master_company",
  prefix: "mc",
  prefix_: "mc_",
  insertColumns: [
      "company_name",
      "owner_name",
      "logo",
      "address",
      "tin",
      "website",
      "email",
      "phone",
      "status"
    ],
  selectColumns: [
      "mc_company_id",
      "mc_company_name",
      "mc_owner_name",
      "mc_logo",
      "mc_address",
      "mc_tin",
      "mc_website",
      "mc_email",
      "mc_phone",
      "mc_status"
    ],
  selectOptionColumns: {
    company_id: "mc_company_id",
    company_name: "mc_company_name",
    owner_name: "mc_owner_name",
    logo: "mc_logo",
    address: "mc_address",
    tin: "mc_tin",
    website: "mc_website",
    email: "mc_email",
    phone: "mc_phone",
    status: "mc_status"
  },
  updateOptionColumns: {
    company_id: "company_id",
    company_name: "company_name",
    owner_name: "owner_name",
    logo: "logo",
    address: "address",
    tin: "tin",
    website: "website",
    email: "email",
    phone: "phone",
    status: "status"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    company_id: "INTEGER",
    company_name: "STRING",
    owner_name: "STRING",
    logo: "TEXT",
    address: "TEXT",
    tin: "STRING",
    website: "STRING",
    email: "STRING",
    phone: "STRING",
    status: "ENUM"
  }
},
 	master_route_access: {
  tablename: "master_route_access",
  prefix: "mra",
  prefix_: "mra_",
  insertColumns: [
      "access_id",
      "name",
      "status"
    ],
  selectColumns: [
      "mra_id",
      "mra_access_id",
      "mra_name",
      "mra_status"
    ],
  selectOptionColumns: {
    id: "mra_id",
    access_id: "mra_access_id",
    name: "mra_name",
    status: "mra_status"
  },
  updateOptionColumns: {
    id: "id",
    access_id: "access_id",
    name: "name",
    status: "status"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    access_id: "INTEGER",
    name: "STRING",
    status: "STRING"
  }
},
  charts_of_accounts: {
    tablename: "charts_of_accounts",
    prefix: "coa",
    prefix_: "coa_",
    insertColumns: [
      "code",
      "name",
      "type",
      "description",
      "status"
    ],
    selectColumns: [
      "coa_id",
      "coa_code",
      "coa_name",
      "coa_type",
      "coa_description",
      "coa_status"
    ],
    selectOptionColumns: {
      id: "coa_id",
      code: "coa_code",
      name: "coa_name",
      type: "coa_type",
      description: "coa_description",
      status: "coa_status"
    },
    updateOptionColumns: {
      id: "id",
      code: "code",
      name: "name",
      type: "type",
      description: "description",
      status: "status"
    },
    selectDateFormatColumns: {

    },
    selectMiscColumns: {

    },
    columnDataTypes: {
      id: "INTEGER",
      code: "STRING",
      name: "STRING",
      type: "ENUM",
      description: "TEXT",
      status: "ENUM"
    }
  },
  customers: {
    tablename: "customers",
    prefix: "c",
    prefix_: "c_",
    insertColumns: [
      "code",
      "name",
      "category",
      "type",
      "status"
    ],
    selectColumns: [
      "c_id",
      "c_code",
      "c_name",
      "c_category",
      "c_type",
      "c_status"
    ],
    selectOptionColumns: {
      id: "c_id",
      code: "c_code",
      name: "c_name",
      category: "c_category",
      type: "c_type",
      status: "c_status"
    },
    updateOptionColumns: {
      id: "id",
      code: "code",
      name: "name",
      category: "category",
      type: "type",
      status: "status"
    },
    selectDateFormatColumns: {

    },
    selectMiscColumns: {

    },
    columnDataTypes: {
      id: "INTEGER",
      code: "STRING",
      name: "STRING",
      category: "STRING",
      type: "STRING",
      status: "ENUM"
    }
  },
  customers_information: {
    tablename: "customers_information",
    prefix: "ci",
    prefix_: "ci_",
    insertColumns: [
      "customer_code",
      "customer_name",
      "address",
      "tin",
      "details",
      "contact"
    ],
    selectColumns: [
      "ci_id",
      "ci_customer_code",
      "ci_customer_name",
      "ci_address",
      "ci_tin",
      "ci_details",
      "ci_contact"
    ],
    selectOptionColumns: {
      id: "ci_id",
      customer_code: "ci_customer_code",
      customer_name: "ci_customer_name",
      address: "ci_address",
      tin: "ci_tin",
      details: "ci_details",
      contact: "ci_contact"
    },
    updateOptionColumns: {
      id: "id",
      customer_code: "customer_code",
      customer_name: "customer_name",
      address: "address",
      tin: "tin",
      details: "details",
      contact: "contact"
    },
    selectDateFormatColumns: {

    },
    selectMiscColumns: {

    },
    columnDataTypes: {
      id: "INTEGER",
      customer_code: "STRING",
      customer_name: "STRING",
      address: "TEXT",
      tin: "STRING",
      details: "TEXT",
      contact: "STRING"
    }
  },
  proforma_entries: {
    tablename: "proforma_entries",
    prefix: "pe",
    prefix_: "pe_",
    insertColumns: [
      "module",
      "name",
      "coa_id",
      "t_account"
    ],
    selectColumns: [
      "pe_id",
      "pe_module",
      "pe_name",
      "pe_coa_id",
      "pe_t_account"
    ],
    selectOptionColumns: {
      id: "pe_id",
      module: "pe_module",
      name: "pe_name",
      coa_id: "pe_coa_id",
      t_account: "pe_t_account"
    },
    updateOptionColumns: {
      id: "id",
      module: "module",
      name: "name",
      coa_id: "coa_id",
      t_account: "t_account"
    },
    selectDateFormatColumns: {

    },
    selectMiscColumns: {

    },
    columnDataTypes: {
      id: "INTEGER",
      module: "STRING",
      name: "STRING",
      coa_id: "INTEGER",
      t_account: "STRING"
    }
  },
  vendors: {
    tablename: "vendors",
    prefix: "v",
    prefix_: "v_",
    insertColumns: [
      "code",
      "name",
      "category",
      "type",
      "status"
    ],
    selectColumns: [
      "v_id",
      "v_code",
      "v_name",
      "v_category",
      "v_type",
      "v_status"
    ],
    selectOptionColumns: {
      id: "v_id",
      code: "v_code",
      name: "v_name",
      category: "v_category",
      type: "v_type",
      status: "v_status"
    },
    updateOptionColumns: {
      id: "id",
      code: "code",
      name: "name",
      category: "category",
      type: "type",
      status: "status"
    },
    selectDateFormatColumns: {

    },
    selectMiscColumns: {

    },
    columnDataTypes: {
      id: "INTEGER",
      code: "STRING",
      name: "STRING",
      category: "STRING",
      type: "STRING",
      status: "ENUM"
    }
  },
  vendors_information: {
    tablename: "vendors_information",
    prefix: "vi",
    prefix_: "vi_",
    insertColumns: [
      "vendor_code",
      "vendor_name",
      "address",
      "tin",
      "details",
      "contact"
    ],
    selectColumns: [
      "vi_id",
      "vi_vendor_code",
      "vi_vendor_name",
      "vi_address",
      "vi_tin",
      "vi_details",
      "vi_contact"
    ],
    selectOptionColumns: {
      id: "vi_id",
      vendor_code: "vi_vendor_code",
      vendor_name: "vi_vendor_name",
      address: "vi_address",
      tin: "vi_tin",
      details: "vi_details",
      contact: "vi_contact"
    },
    updateOptionColumns: {
      id: "id",
      vendor_code: "vendor_code",
      vendor_name: "vendor_name",
      address: "address",
      tin: "tin",
      details: "details",
      contact: "contact"
    },
    selectDateFormatColumns: {

    },
    selectMiscColumns: {

    },
    columnDataTypes: {
      id: "INTEGER",
      vendor_code: "STRING",
      vendor_name: "STRING",
      address: "TEXT",
      tin: "STRING",
      details: "TEXT",
      contact: "STRING"
    }
  },
  products_service: {
    tablename: "products_service",
    prefix: "ps",
    prefix_: "ps_",
    insertColumns: [
      "code",
      "name",
      "type",
      "category",
      "sales_price",
      "purchase_price",
      "unit"
    ],
    selectColumns: [
      "ps_id",
      "ps_code",
      "ps_name",
      "ps_type",
      "ps_category",
      "ps_sales_price",
      "ps_purchase_price",
      "ps_unit"
    ],
    selectOptionColumns: {
      id: "ps_id",
      code: "ps_code",
      name: "ps_name",
      type: "ps_type",
      category: "ps_category",
      sales_price: "ps_sales_price",
      purchase_price: "ps_purchase_price",
      unit: "ps_unit"
    },
    updateOptionColumns: {
      id: "id",
      code: "code",
      name: "name",
      type: "type",
      category: "category",
      sales_price: "sales_price",
      purchase_price: "purchase_price",
      unit: "unit"
    },
    selectDateFormatColumns: {

    },
    selectMiscColumns: {

    },
    columnDataTypes: {
      id: "INTEGER",
      code: "STRING",
      name: "STRING",
      type: "ENUM",
      category: "STRING",
      sales_price: "INTEGER",
      purchase_price: "INTEGER",
      unit: "STRING"
    }
  },
  vat: {
    tablename: "vat",
    prefix: "vat",
    prefix_: "vat_",
    insertColumns: [
      "code",
      "name",
      "rate",
      "type",
      "sub_type",
      "description",
      "status"
    ],
    selectColumns: [
      "vat_id",
      "vat_code",
      "vat_name",
      "vat_rate",
      "vat_type",
      "vat_sub_type",
      "vat_description",
      "vat_status"
    ],
    selectOptionColumns: {
      id: "vat_id",
      code: "vat_code",
      name: "vat_name",
      rate: "vat_rate",
      type: "vat_type",
      sub_type: "vat_sub_type",
      description: "vat_description",
      status: "vat_status"
    },
    updateOptionColumns: {
      id: "id",
      code: "code",
      name: "name",
      rate: "rate",
      type: "type",
      sub_type: "sub_type",
      description: "description",
      status: "status"
    },
    selectDateFormatColumns: {

    },
    selectMiscColumns: {

    },
    columnDataTypes: {
      id: "INTEGER",
      code: "STRING",
      name: "STRING",
      rate: "DECIMAL",
      type: "ENUM",
      sub_type: "ENUM",
      description: "TEXT",
      status: "ENUM"
    }
  },
  withholding_tax: {
    tablename: "withholding_tax",
    prefix: "wt",
    prefix_: "wt_",
    insertColumns: [
      "code",
      "name",
      "rate",
      "tax_account",
      "description",
      "status"
    ],
    selectColumns: [
      "wt_id",
      "wt_code",
      "wt_name",
      "wt_rate",
      "wt_tax_account",
      "wt_description",
      "wt_status"
    ],
    selectOptionColumns: {
      id: "wt_id",
      code: "wt_code",
      name: "wt_name",
      rate: "wt_rate",
      tax_account: "wt_tax_account",
      description: "wt_description",
      status: "wt_status"
    },
    updateOptionColumns: {
      id: "id",
      code: "code",
      name: "name",
      rate: "rate",
      tax_account: "tax_account",
      description: "description",
      status: "status"
    },
    selectDateFormatColumns: {

    },
    selectMiscColumns: {

    },
    columnDataTypes: {
      id: "INTEGER",
      code: "STRING",
      name: "STRING",
      rate: "DECIMAL",
      tax_account: "STRING",
      description: "TEXT",
      status: "ENUM"
    }
  }
};

exports.Master = Master;