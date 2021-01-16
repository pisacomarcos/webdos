import { IdMap } from "medusa-test-utils"
import { request } from "../../../../../helpers/test-request"
import { DiscountServiceMock } from "../../../../../services/__mocks__/discount"

describe("POST /admin/discounts/:discount_id/regions/:region_id", () => {
  describe("successful addition", () => {
    let subject

    beforeAll(async () => {
      subject = await request(
        "POST",
        `/admin/discounts/${IdMap.getId("total10")}/regions/${IdMap.getId(
          "region-france"
        )}`,
        {
          adminSession: {
            jwt: {
              userId: IdMap.getId("admin_user"),
            },
          },
        }
      )
    })

    it("returns 200", () => {
      expect(subject.status).toEqual(200)
    })

    it("calls service retrieve", () => {
      expect(DiscountServiceMock.retrieve).toHaveBeenCalledTimes(1)
      expect(DiscountServiceMock.retrieve).toHaveBeenCalledWith(
        IdMap.getId("total10"),
        {
          select: [
            "id",
            "code",
            "is_dynamic",
            "discount_rule_id",
            "parent_discount_id",
            "starts_at",
            "ends_at",
            "created_at",
            "updated_at",
            "deleted_at",
            "metadata",
          ],
          relations: [
            "discount_rule",
            "parent_discount",
            "regions",
            "discount_rule.valid_for",
          ],
        }
      )

      expect(DiscountServiceMock.addRegion).toHaveBeenCalledTimes(1)
      expect(DiscountServiceMock.addRegion).toHaveBeenCalledWith(
        IdMap.getId("total10"),
        IdMap.getId("region-france")
      )
    })
  })
})
