import { IdMap } from "medusa-test-utils"
import { request } from "../../../../../helpers/test-request"
import { FulfillmentServiceMock } from "../../../../../services/__mocks__/fulfillment"

describe("POST /admin/orders/:id/fulfillments/:fulfillment_id/cancel", () => {
  describe("successfully cancels a fulfillment", () => {
    let subject

    beforeAll(async () => {
      subject = await request(
        "POST",
        `/admin/orders/${IdMap.getId("test-order")}/fulfillments/${IdMap.getId(
          "order-fulfillment"
        )}/cancel`,
        {
          adminSession: {
            jwt: {
              userId: IdMap.getId("admin_user"),
            },
          },
        }
      )
    })

    afterAll(() => {
      jest.clearAllMocks()
    })

    it("calls FulfillmentService cancel", () => {
      expect(FulfillmentServiceMock.cancelFulfillment).toHaveBeenCalledTimes(1)
      expect(FulfillmentServiceMock.cancelFulfillment).toHaveBeenCalledWith(
        IdMap.getId("order-fulfillment")
      )
    })
  })

  describe("Trying to cancel a fulfillment unrelated to the order fails", () => {
    let subject

    beforeAll(async () => {
      subject = await request(
        "POST",
        `/admin/orders/${IdMap.getId("test-order2")}/fulfillments/${IdMap.getId(
          "order-fulfillment"
        )}/cancel`,
        {
          adminSession: {
            jwt: {
              userId: IdMap.getId("admin_user"),
            },
          },
        }
      )
    })

    afterAll(() => {
      jest.clearAllMocks()
    })

    it("returns error", () => {
      expect(subject.status).toEqual(404)
    })
  })
})
