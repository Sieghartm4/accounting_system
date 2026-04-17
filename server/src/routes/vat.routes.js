const express = require('express');
const { auth } = require('../middlewares/auth.middleware');
const { getVat, createVat, updateVat } = require('../controller/vat.controller');

const vatRouter = express.Router();

vatRouter.get('/', getVat);
vatRouter.post('/', createVat);
vatRouter.put('/:id', updateVat);


module.exports = { vatRouter };
