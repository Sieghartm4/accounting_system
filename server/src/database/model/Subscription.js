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
}
};

exports.Master = Master;
