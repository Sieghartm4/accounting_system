const assert = require('assert')
const path = require('path')
const Module = require('module')

const originalLoad = Module._load

function resetModuleCache(modulePath) {
  delete require.cache[require.resolve(modulePath)]
}

function loadController(controllerPath, duplicateRows = [{ id: 1 }]) {
  resetModuleCache(controllerPath)

  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async () => [{ insertId: 42 }],
  }

  Module._load = function (request, parent, isMain) {
    if (
      request === '../database/util/queries.util' ||
      request.endsWith('/database/util/queries.util')
    ) {
      return {
        checkConnection: async () => true,
        SelectAll: () => [],
        Transaction: async () => [],
        Query: async () => duplicateRows,
        Insert: () => {},
        SelectWithCondition: () => {},
      }
    }

    if (
      request === '../database/util/tenantConnection.util' ||
      request.endsWith('/database/util/tenantConnection.util')
    ) {
      return {
        getTenantPool: () => ({
          getConnection: async () => connection,
        }),
      }
    }

    if (request === '../util/helper.util' || request.endsWith('/util/helper.util')) {
      return {
        formatMemoryUsage: () => '',
        formatTime: () => '',
        DataModeling: () => {},
        SQLQueryBuilder: class {
          select() {
            return this
          }
          insert() {
            return this
          }
          update() {
            return this
          }
          from() {
            return this
          }
          where() {
            return this
          }
          set() {
            return this
          }
          build() {
            return ''
          }
        },
      }
    }

    return originalLoad.apply(this, [request, parent, isMain])
  }

  const controller = require(controllerPath)
  return { controller, connection }
}

async function run() {
  const { controller } = loadController('../src/controller/customer.controller')

  const customerRes = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }

  await controller.createCustomer(
    {
      body: {
        code: 'CUST-001',
        name: 'Acme',
        address: 'Main St',
        tin: '123456789',
        details: '',
        contact: '',
      },
      context: { username: 'admin' },
    },
    customerRes,
  )

  assert.strictEqual(
    customerRes.statusCode,
    409,
    'Customer create should reject duplicates',
  )
  assert.ok(
    customerRes.body.message.includes('already exists'),
    'Customer duplicate message should be returned',
  )

  const { controller: vendorController } = loadController(
    '../src/controller/vendor.controller',
  )
  const vendorRes = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }

  await vendorController.createVendor(
    {
      body: {
        code: 'VEND-001',
        name: 'Supplier',
        address: 'Market St',
        tin: '987654321',
        details: '',
        contact: '',
      },
      context: { username: 'admin' },
    },
    vendorRes,
  )

  assert.strictEqual(
    vendorRes.statusCode,
    409,
    'Vendor create should reject duplicates',
  )
  assert.ok(
    vendorRes.body.message.includes('already exists'),
    'Vendor duplicate message should be returned',
  )

  console.log('customer/vendor duplicate regression checks passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
