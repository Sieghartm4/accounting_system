require('dotenv').config({ path: '../.env' })
const { DecryptString } = require('../../util/cryptography.util')

module.exports = {
  development: {
    username: process.env._USER_ADMIN,
    password: DecryptString(process.env._PASSWORD_ADMIN),
    database: process.env._DATABASE_ADMIN,
    host: process.env._HOST_ADMIN,
    mongoUrl: process.env._SUBSCRIPTION_MONGODB_URL,
    sessionCookieName: process.env._SUBSCRIPTION_SESSION_COLLECTION,
    sessionSecret: process.env._SUBSCRIPTION_SESSION_SECRET,
    dialect: 'mysql',
    dialectOptions: { multipleStatements: true },
  },
  test: {
    username: process.env._USER_ADMIN,
    password: DecryptString(process.env._PASSWORD_ADMIN),
    database: process.env._DATABASE_ADMIN,
    host: process.env._HOST_ADMIN,
    mongoUrl: process.env._SUBSCRIPTION_MONGODB_URL,
    sessionCookieName: process.env._SUBSCRIPTION_SESSION_COLLECTION,
    sessionSecret: process.env._SUBSCRIPTION_SESSION_SECRET,
    dialect: 'mysql',
    dialectOptions: { multipleStatements: true },
  },
  production: {
    username: process.env._USER_ADMIN,
    password: DecryptString(process.env._PASSWORD_ADMIN),
    database: process.env._DATABASE_ADMIN,
    host: process.env._HOST_ADMIN,
    mongoUrl: process.env._SUBSCRIPTION_MONGODB_URL,
    sessionCookieName: process.env._SUBSCRIPTION_SESSION_COLLECTION,
    sessionSecret: process.env._SUBSCRIPTION_SESSION_SECRET,
    dialect: 'mysql',
    dialectOptions: { multipleStatements: true },
  },
}
