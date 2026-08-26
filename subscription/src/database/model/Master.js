const Master = {
	master_user: {
  tablename: "master_user",
  prefix: "mu",
  prefix_: "mu_",
  insertColumns: [
      "mu_username",
      "mu_password",
      "db_name",
      "mu_email",
      "mu_status",
      "mu_role",
      "subscription_id"
    ],
  selectColumns: [
      "mu_id",
      "mu_username",
      "mu_password",
      "db_name",
      "mu_email",
      "mu_status",
      "mu_role",
      "subscription_id"
  ],
  selectOptionColumns: {
    id: "mu_id",
    username: "mu_username",
    password: "mu_password",
    db_name: "db_name",
    email: "mu_email",
    status: "mu_status",
    role: "mu_role",
    subscription_id: "subscription_id"
  },
  updateOptionColumns: {
    id: "id",
    username: "username",
    password: "password",
    db_name: "db_name",
    email: "email",
    status: "status",
    role: "role",
    subscription_id: "subscription_id"
  },
  selectDateFormatColumns: {

  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    username: "STRING",
    password: "TEXT",
    db_name: "STRING",
    email: "STRING",
    status: "ENUM",
    role: "ENUM",
    subscription_id: "INTEGER"
  }
},
subscription_history: {
  tablename: "subscription_history",
  prefix: "sh",
  prefix_: "sh_",
  insertColumns: [
      "sh_mu_id",
      "sh_subscription_id",
      "sh_price",
      "sh_billing_cycle",
      "sh_start_date",
      "sh_end_date",
      "sh_status",
      "sh_payment_method",
      "sh_payment_reference",
      "sh_created_at",
      "sh_updated_at"
    ],
  selectColumns: [
      "sh_id",
      "sh_mu_id",
      "sh_subscription_id",
      "sh_price",
      "sh_billing_cycle",
      "sh_start_date",
      "sh_end_date",
      "sh_status",
      "sh_payment_method",
      "sh_payment_reference",
      "sh_created_at",
      "sh_updated_at"
  ],
  selectOptionColumns: {
    id: "sh_id",
    mu_id: "sh_mu_id",
    subscription_id: "sh_subscription_id",
    price: "sh_price",
    billing_cycle: "sh_billing_cycle",
    start_date: "sh_start_date",
    end_date: "sh_end_date",
    status: "sh_status",
    payment_method: "sh_payment_method",
    payment_reference: "sh_payment_reference",
    created_at: "sh_created_at",
    updated_at: "sh_updated_at"
  },
  updateOptionColumns: {
    id: "id",
    mu_id: "mu_id",
    subscription_id: "subscription_id",
    price: "price",
    billing_cycle: "billing_cycle",
    start_date: "start_date",
    end_date: "end_date",
    status: "status",
    payment_method: "payment_method",
    payment_reference: "payment_reference",
    created_at: "created_at",
    updated_at: "updated_at"
  },
  selectDateFormatColumns: {
    start_date: "sh_start_date",
    end_date: "sh_end_date",
    created_at: "sh_created_at",
    updated_at: "sh_updated_at"
  },
  selectMiscColumns: {

  },
  columnDataTypes: {
    id: "INTEGER",
    mu_id: "INTEGER",
    subscription_id: "INTEGER",
    price: "DECIMAL",
    billing_cycle: "STRING",
    start_date: "DATE",
    end_date: "DATE",
    status: "ENUM",
    payment_method: "STRING",
    payment_reference: "STRING",
    created_at: "DATE",
    updated_at: "DATE"
  }
}
};

exports.Master = Master;