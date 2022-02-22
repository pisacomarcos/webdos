const path = require("path")

const setupServer = require("../../../helpers/setup-server")
const { useApi } = require("../../../helpers/use-api")
const { useDb, initDb } = require("../../../helpers/use-db")

const customerSeeder = require("../../helpers/customer-seeder")
const adminSeeder = require("../../helpers/admin-seeder")

jest.setTimeout(30000)

describe("/admin/customer-groups", () => {
  let medusaProcess
  let dbConnection

  beforeAll(async () => {
    const cwd = path.resolve(path.join(__dirname, "..", ".."))
    dbConnection = await initDb({ cwd })
    medusaProcess = await setupServer({ cwd })
  })

  afterAll(async () => {
    const db = useDb()
    await db.shutdown()
    medusaProcess.kill()
  })

  describe("POST /admin/customer-groups", () => {
    beforeEach(async () => {
      try {
        await adminSeeder(dbConnection)
        await customerSeeder(dbConnection)
      } catch (err) {
        console.log(err)
        throw err
      }
    })

    afterEach(async () => {
      const db = useDb()
      await db.teardown()
    })

    it("creates customer group", async () => {
      const api = useApi()

      const payload = {
        name: "test group",
      }

      const response = await api.post("/admin/customer-groups", payload, {
        headers: {
          Authorization: "Bearer test_token",
        },
      })

      expect(response.status).toEqual(200)
      expect(response.data.customerGroup).toEqual(
        expect.objectContaining({
          name: "test group",
        })
      )
    })

    it("Fails to create duplciate customer group", async () => {
      expect.assertions(3)
      const api = useApi()

      const payload = {
        name: "vip-customers",
      }

      await api
        .post("/admin/customer-groups", payload, {
          headers: {
            Authorization: "Bearer test_token",
          },
        })
        .catch((err) => {
          expect(err.response.status).toEqual(402)
          expect(err.response.data.type).toEqual("duplicate_error")
          expect(err.response.data.message).toEqual(
            "Key (name)=(vip-customers) already exists."
          )
        })
    })
  })

  describe("DELETE /admin/customer-groups", () => {
    beforeEach(async () => {
      try {
        await adminSeeder(dbConnection)
        await customerSeeder(dbConnection)
      } catch (err) {
        console.log(err)
        throw err
      }
    })

    afterEach(async () => {
      const db = useDb()
      await db.teardown()
    })

    it("removes customer group from get endpoint", async () => {
      expect.assertions(3)

      const api = useApi()

      const id = "customer-group-1"

      const deleteResponse = await api.delete(`/admin/customer-groups/${id}`, {
        headers: {
          Authorization: "Bearer test_token",
        },
      })

      expect(deleteResponse.data).toEqual({
        id: id,
        object: "customer_group",
        deleted: true,
      })

      await api
        .get(`/admin/customer-groups/${id}`, {
          headers: {
            Authorization: "Bearer test_token",
          },
        })
        .catch((error) => {
          expect(error.response.data.type).toEqual("not_found")
          expect(error.response.data.message).toEqual(
            `CustomerGroup with ${id} was not found`
          )
        })
    })

    it("removes customer group from customer upon deletion", async () => {
      expect.assertions(3)

      const api = useApi()

      const id = "test-group-delete"

      const customerRes_preDeletion = await api.get(
        `/admin/customers/test-customer-delete-cg?expand=groups`,
        {
          headers: {
            Authorization: "Bearer test_token",
          },
        }
      )

      expect(customerRes_preDeletion.data.customer).toEqual(
        expect.objectContaining({
          groups: [
            expect.objectContaining({
              id: "test-group-delete",
              name: "test-group-delete",
            }),
          ],
        })
      )

      const deleteResponse = await api
        .delete(`/admin/customer-groups/${id}`, {
          headers: {
            Authorization: "Bearer test_token",
          },
        })
        .catch((err) => console.log(err))

      expect(deleteResponse.data).toEqual({
        id: id,
        object: "customer_group",
        deleted: true,
      })

      const customerRes = await api.get(
        `/admin/customers/test-customer-delete-cg?expand=groups`,
        {
          headers: {
            Authorization: "Bearer test_token",
          },
        }
      )

      expect(customerRes.data.customer).toEqual(
        expect.objectContaining({
          groups: [],
        })
      )
    })
  })

  describe("POST /admin/customer-groups/:id", () => {
    beforeEach(async () => {
      try {
        await adminSeeder(dbConnection)
        await customerSeeder(dbConnection)
      } catch (err) {
        console.log(err)
        throw err
      }
    })

    afterEach(async () => {
      const db = useDb()
      await db.teardown()
    })

    it("updates group name & metadata", async () => {
      const api = useApi()

      const id = "customer-group-2"

      const body = {
        name: "vip-customers-v2",
        metadata: {
          metaKey1: `metaValue1`,
        },
      }

      const response = await api.post(`/admin/customer-groups/${id}`, body, {
        headers: {
          Authorization: "Bearer test_token",
        },
      })

      expect(response.status).toEqual(200)
      expect(response.data.customer_group).toEqual(
        expect.objectContaining({
          id: "customer-group-2",
          name: "vip-customers-v2",
          metadata: {
            data1: "value1",
            metaKey1: `metaValue1`,
          },
        })
      )
      expect(response.data.customer_group).not.toHaveProperty("customers")
    })

    it("deletes `metadata` nested key", async () => {
      const api = useApi()

      const id = "customer-group-2"
      // already has some metadata initially

      const body = {
        name: "vip-customers-v2",
        metadata: {
          data1: null, // delete
          data2: "val2", // insert
        },
      }

      const response = await api
        .post(`/admin/customer-groups/${id}?expand=customers`, body, {
          headers: {
            Authorization: "Bearer test_token",
          },
        })
        .catch(console.log)

      expect(response.status).toEqual(200)
      expect(response.data.customer_group).toEqual(
        expect.objectContaining({
          id: "customer-group-2",
          name: "vip-customers-v2",
          metadata: { data1: null, data2: "val2" },
          customers: [],
        })
      )
    })

    it("reset `metadata`to `null`", async () => {
      const api = useApi()

      const id = "customer-group-2"
      // already has some metadata initially

      const body = {
        name: "vip-customers-v2",
        metadata: null,
      }

      const response = await api
        .post(`/admin/customer-groups/${id}`, body, {
          headers: {
            Authorization: "Bearer test_token",
          },
        })
        .catch(console.log)

      expect(response.status).toEqual(200)
      expect(response.data.customerGroup).toEqual(
        expect.objectContaining({
          id: "customer-group-2",
          name: "vip-customers-v2",
          metadata: null,
        })
      )
    })
  })

  describe("GET /admin/customer-groups", () => {
    beforeEach(async () => {
      try {
        await adminSeeder(dbConnection)
        await customerSeeder(dbConnection)
      } catch (err) {
        console.log(err)
        throw err
      }
    })

    afterEach(async () => {
      const db = useDb()
      await db.teardown()
    })

    it("gets customer group", async () => {
      const api = useApi()

      const id = "customer-group-1"

      const response = await api.get(`/admin/customer-groups/${id}`, {
        headers: {
          Authorization: "Bearer test_token",
        },
      })

      expect(response.status).toEqual(200)
      expect(response.data.customerGroup).toEqual(
        expect.objectContaining({
          id: "customer-group-1",
          name: "vip-customers",
        })
      )
      expect(response.data.customerGroup).not.toHaveProperty("customers")
    })

    it("gets customer group with `customers` prop", async () => {
      const api = useApi()

      const id = "customer-group-1"

      const response = await api.get(
        `/admin/customer-groups/${id}?expand=customers`,
        {
          headers: {
            Authorization: "Bearer test_token",
          },
        }
      )

      expect(response.status).toEqual(200)
      expect(response.data.customerGroup).toEqual(
        expect.objectContaining({
          id: "customer-group-1",
          name: "vip-customers",
        })
      )
      expect(response.data.customerGroup.customers).toEqual([])
    })

    it("throws error when a customer group doesn't exist", async () => {
      expect.assertions(3)

      const api = useApi()

      const id = "test-group-000"

      await api
        .get(`/admin/customer-groups/${id}`, {
          headers: {
            Authorization: "Bearer test_token",
          },
        })
        .catch((err) => {
          expect(err.response.status).toEqual(404)
          expect(err.response.data.type).toEqual("not_found")
          expect(err.response.data.message).toEqual(
            `CustomerGroup with ${id} was not found`
          )
        })
    })
  })
})
