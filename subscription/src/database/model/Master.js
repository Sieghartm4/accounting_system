const Master = {
	master_user: {
  tablename: "master_user",
  prefix: "mu",
  prefix_: "mu_",
  insertColumns: [
      "mu_username",
      "mu_password",
      "db_name",
      "mu_status"
    ],
  selectColumns: [
      "mu_id",
      "mu_username",
      "mu_password",
      "db_name",
      "mu_status"
  ],
  selectOptionColumns: {
    id: "mu_id",
    username: "mu_username",
    password: "mu_password",
    db_name: "db_name",
    status: "mu_status"
  },
  updateOptionColumns: {
    id: "id",
    username: "username",
    password: "password",
    db_name: "db_name",
    status: "status"
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
    status: "ENUM"
  }
}
};

exports.Master = Master;