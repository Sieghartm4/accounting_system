const express = require('express');
const { auth } = require('../middlewares/auth.middleware');
const { getWithholdingTax, createWithholdingTax, updateWithholdingTax, importWithholdingTax } = require('../controller/withholding_tax.controller');

const withholdingTaxRouter = express.Router();

withholdingTaxRouter.get('/', getWithholdingTax);
withholdingTaxRouter.post('/', createWithholdingTax);
withholdingTaxRouter.put('/:id', updateWithholdingTax);
withholdingTaxRouter.post('/import', importWithholdingTax);


module.exports = { withholdingTaxRouter };
