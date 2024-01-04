const { Modules } = require("@medusajs/modules-sdk")
const { Workflows } = require("@medusajs/core-flows")
const DB_HOST = process.env.DB_HOST
const DB_USERNAME = process.env.DB_USERNAME
const DB_PASSWORD = process.env.DB_PASSWORD
const DB_NAME = process.env.DB_TEMP_NAME
const DB_URL = `postgres://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}/${DB_NAME}`
process.env.POSTGRES_URL = DB_URL

const enableMedusaV2 = process.env.MEDUSA_FF_MEDUSA_V2 == "true"

module.exports = {
  plugins: [
    {
      resolve: `medusa-fulfillment-webshipper`,
      options: {
        account: "test-account",
        api_token: "something",
        order_channel_id: "1",
        webhook_secret: "1234",
      },
    },
    {
      resolve: `medusa-plugin-sendgrid`,
      options: {
        api_key: "SG.TEST",
      },
    },
  ],
  projectConfig: {
    database_url: DB_URL,
    database_type: "postgres",
    jwt_secret: "test",
    cookie_secret: "test",
    database_extra: { idle_in_transaction_session_timeout: 0 },
  },
  featureFlags: {
    medusa_v2: enableMedusaV2,
    workflows: {
      [Workflows.CreateCart]: true,
    },
  },
  modules: {
    [Modules.STOCK_LOCATION]: {
      scope: "internal",
      resources: "shared",
      resolve: "@medusajs/stock-location",
    },
    [Modules.INVENTORY]: {
      scope: "internal",
      resources: "shared",
      resolve: "@medusajs/inventory",
    },
    [Modules.CACHE]: {
      resolve: "@medusajs/cache-inmemory",
      options: { ttl: 0 }, // Cache disabled
    },
    [Modules.PRODUCT]: {
      scope: "internal",
      resources: "shared",
      resolve: "@medusajs/product",
    },
    [Modules.PRICING]: {
      scope: "internal",
      resources: "shared",
      resolve: "@medusajs/pricing",
    },
  },
}
