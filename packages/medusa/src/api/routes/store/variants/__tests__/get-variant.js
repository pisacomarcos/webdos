import { request } from "../../../../../helpers/test-request"
import { ProductVariantServiceMock } from "../../../../../services/__mocks__/product-variant"

describe("Get variant by id", () => {
  describe("get variant by id successfull", () => {
    let subject
    beforeAll(async () => {
      subject = await request("GET", `/store/variants/1`)
    })

    afterAll(() => {
      jest.clearAllMocks()
    })

    it("calls get variant from variantSerice", () => {
      expect(ProductVariantServiceMock.retrieve).toHaveBeenCalledTimes(1)
      expect(ProductVariantServiceMock.retrieve).toHaveBeenCalledWith(
        "1",
        "prices"
      )
    })

    it("returns variant decorated", () => {
      expect(subject.body.variant.id).toEqual("1")
    })
  })
})
