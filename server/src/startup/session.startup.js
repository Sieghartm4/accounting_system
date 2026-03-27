const session = require('express-session')
const MongoStore = require('connect-mongo')
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') })

console.log('MONGODB_URL:', process.env._MONGODB_URL)
console.log('SESSION_COLLECTION:', process.env._SESSION_COLLECTION)
console.log('SESSION_SECRET:', process.env._SESSION_SECRET)

if (!process.env._MONGODB_URL) {
  throw new Error('MONGODB_URL environment variable is not set')
}
if (!process.env._SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable is not set')
}

const options = {
  store: MongoStore.create({ 
    mongoUrl: process.env._MONGODB_URL,
    collectionName: process.env._SESSION_COLLECTION || 'sessions'
  }),
  name: process.env._SESSION_COLLECTION || 'retail-pos-session',
  secret: process.env._SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env._HTTPS_SECURE === 'true',
  },
}

const initSession = (app) => {
  app.use(session(options))
}

module.exports = {
  initSession,
}
