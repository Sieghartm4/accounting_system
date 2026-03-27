const os = require('os')
const { checkConnection } = require('../database/util/queries.util')
const { formatMemoryUsage, formatTime } = require('../util/helper.util')
require('dotenv').config()

const getSystemStats = async () => {
  const dbCheckResult = await checkConnection()
  const rawMemory = process.memoryUsage()

  const data = {
    status: 'Ok',
    uptime: formatTime(process.uptime()),
    date: new Date(),
    version: process.env.APP_VERSION || '1.4.0',
    environment: process.env.NODE_ENV || 'development',
    cpuLoad: os.loadavg(),
    memoryUsage: formatMemoryUsage(rawMemory),
    dbStatus: dbCheckResult.status,
    dbLatency: dbCheckResult.latency,
    dbDetails: dbCheckResult.details,
  }

  const isHealthy = data.dbStatus !== 'Error'
  data.status = isHealthy ? 'Ok' : 'Degraded'

  return data
}

const getHealth = async (req, res, next) => {
  try {
    const data = await getSystemStats()
    const statusCode = data.status === 'Ok' ? 200 : 503

    return res.status(statusCode).json(data)
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Server error' })
  }
}

// Export the new middleware and getter
module.exports = {
  getHealth,
  getSystemStats,
}
