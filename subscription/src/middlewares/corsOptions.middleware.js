require('dotenv').config()
const corsOptions = {
  origin: [
    `http://${process.env._CLIENT_URL}:${process.env._CLIENT_PORT}`,
    `http://${process.env._SERVER_URL}:${process.env._SUBSCRIPTION_SERVER_PORT}`,
    `http://localhost:${process.env._SUBSCRIPTION_SERVER_PORT}`,
  ],
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-requested-with'],
}

module.exports = {
  corsOptions,
}
