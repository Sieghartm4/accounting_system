const { auth } = require('../middlewares/auth.middleware')

const { healthRouter } = require('../routes/health.routes')

const { usersRouter } = require('../routes/users.routes')

const { credentialsRouter } = require('../routes/credentials.routes')

const { accessRouter } = require('../routes/access.routes')

const { routeAccessRouter } = require('../routes/route_access.routes')

const { companyRouter } = require('../routes/company.routes')

const { cashDisbursementRouter } = require('../routes/cash_disbursement.routes')

const { receiptRouter } = require('../routes/receipt.routes')

const { salesRouter } = require('../routes/sales.routes')

const { collectionRouter } = require('../routes/collection.routes')

const { purchaseRouter } = require('../routes/purchase.routes')

const { paymentRouter } = require('../routes/payments.routes')

const { journalEntriesRouter } = require('../routes/journal_entries.routes')

const { chartsOfAccountsRouter } = require('../routes/charts_of_accounts.routes')

const { customerRouter } = require('../routes/customer.routes')

const { vendorRouter } = require('../routes/vendor.routes')

const { productServiceRouter } = require('../routes/product_service.routes')

const { proformaEntriesRouter } = require('../routes/proforma_entries.routes')

const { vatRouter } = require('../routes/vat.routes')

const { withholdingTaxRouter } = require('../routes/withholding_tax.routes')

const { adjustmentsRouter } = require('../routes/adjustments.routes')

const { reportsRouter } = require('../routes/reports.routes')

const { dashboardRouter } = require('../routes/dashboard.routes')

const initRoutes = (app) => {
  app.use('/credentials', credentialsRouter)

  app.use('/health', healthRouter)

  app.use(auth)

  app.use('/users', usersRouter)

  app.use('/access', accessRouter)

  app.use('/route_access', routeAccessRouter)

  app.use('/company', companyRouter)

  app.use('/cash_disbursements', cashDisbursementRouter)

  app.use('/receipt', receiptRouter)

  app.use('/sales', salesRouter)

  app.use('/collections', collectionRouter)

  app.use('/purchase', purchaseRouter)

  app.use('/payments', paymentRouter)

  app.use('/journal_entries', journalEntriesRouter)

  app.use('/charts_of_accounts', chartsOfAccountsRouter)

  app.use('/customer', customerRouter)

  app.use('/vendors', vendorRouter)

  app.use('/product_service', productServiceRouter)

  app.use('/proforma_entries', proformaEntriesRouter)

  app.use('/vat', vatRouter)

  app.use('/withholding_tax', withholdingTaxRouter)

  app.use('/adjustments', adjustmentsRouter)

  app.use('/reports', reportsRouter)

  app.use('/dashboard', dashboardRouter)
}

module.exports = { initRoutes }
