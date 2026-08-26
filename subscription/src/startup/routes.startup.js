const { auth } = require('../middlewares/auth.middleware')
// const { healthRouter } = require('../routes/health.routes')
const { usersRouter } = require('../routes/users.routes')
const { credentialsRouter } = require('../routes/credentials.routes')
const { subscriptionRouter } = require('../routes/subscription.routes')


const initRoutes = (app) => {
  // Add CORS middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    console.log('Health check called');
    res.json({ status: 'ok', message: 'Subscription server is running' });
  });

  app.use('/credentials', credentialsRouter)
  // app.use('/health', healthRouter)
  // app.use(auth)
  app.use('/users', usersRouter)
  app.use('/subscription-plans', subscriptionRouter)
  
  // Serve subscription admin page
  app.get('/admin', (req, res) => {
    let clientUrl = process.env._CLIENT_URL || `://${process.env._SERVER_URL || 'localhost'}:5050`;
    
    // Ensure CLIENT_URL has protocol
    if (!clientUrl.startsWith('http://') && !clientUrl.startsWith('https://')) {
      clientUrl = 'http://' + clientUrl;
    }
    
    console.log('Injecting CLIENT_URL:', clientUrl);
    console.log('process.env._CLIENT_URL:', process.env._CLIENT_URL);
    console.log('process.env._SERVER_URL:', process.env._SERVER_URL);
    const html = require('fs').readFileSync('./src/views/subscription-admin.html', 'utf8');
    const renderedHtml = html.replace('<head>', `<head><script>window.CLIENT_URL = '${clientUrl}'; console.log('CLIENT_URL from server:', window.CLIENT_URL);</script>`);
    res.send(renderedHtml);
  })

}

module.exports = { initRoutes }
