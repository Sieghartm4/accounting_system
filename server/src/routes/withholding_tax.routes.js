const express = require('express');
const { auth } = require('../middlewares/auth.middleware');
const { getWithholdingTax, createWithholdingTax, updateWithholdingTax } = require('../controller/withholding_tax.controller');

const withholdingTaxRouter = express.Router();

withholdingTaxRouter.get('/', getWithholdingTax);
withholdingTaxRouter.post('/', createWithholdingTax);
withholdingTaxRouter.put('/:id', updateWithholdingTax);


module.exports = { withholdingTaxRouter };
