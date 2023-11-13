import {
  CreatePriceSetDTO,
  CreatePriceSetRuleTypeDTO,
  IPricingModuleService,
} from "@medusajs/types"
import { SqlEntityManager } from "@mikro-orm/postgresql"
import { PriceSet } from "@models"

import { initialize, PriceSetRuleType } from "../../../../src"
import { seedPriceData } from "../../../__fixtures__/seed-price-data"
import { DB_URL, MikroOrmWrapper } from "../../../utils"
import { MedusaModule } from "@medusajs/modules-sdk"

jest.setTimeout(30000)

async function createPriceSetPriceRules(
  manager: SqlEntityManager,
  priceSetRulesData: CreatePriceSetRuleTypeDTO[]
): Promise<void> {
  const priceSetRules: PriceSetRuleType[] = []

  for (let priceSetRuleData of priceSetRulesData) {
    const priceRule = manager.create(PriceSetRuleType, priceSetRuleData)

    priceSetRules.push(priceRule)
  }

  await manager.persistAndFlush(priceSetRules)
}

describe("PricingModule Service - PriceSet", () => {
  let service: IPricingModuleService
  let repositoryManager: SqlEntityManager
  let data!: PriceSet[]

  beforeEach(async () => {
    await MikroOrmWrapper.setupDatabase()
    repositoryManager = MikroOrmWrapper.forkManager()
    service = await initialize({
      database: {
        clientUrl: DB_URL,
        schema: process.env.MEDUSA_PRICING_DB_SCHEMA,
      },
    })

    const testManager = MikroOrmWrapper.forkManager()

    await seedPriceData(testManager)
    await createPriceSetPriceRules(testManager, [
      {
        price_set: "price-set-1",
        rule_type: "rule-type-1",
      },
      {
        price_set: "price-set-2",
        rule_type: "rule-type-2",
      },
    ] as unknown as CreatePriceSetRuleTypeDTO[])
  })

  afterEach(async () => {
    await MikroOrmWrapper.clearDatabase()
    MedusaModule.clearInstances()
  })

  describe("list", () => {
    it("list priceSets", async () => {
      const priceSetsResult = await service.list()

      expect(priceSetsResult).toEqual([
        expect.objectContaining({
          id: "price-set-1",
        }),
        expect.objectContaining({
          id: "price-set-2",
        }),
        expect.objectContaining({
          id: "price-set-3",
        }),
      ])
    })

    it("list priceSets by id", async () => {
      const priceSetsResult = await service.list({
        id: ["price-set-1"],
      })

      expect(priceSetsResult).toEqual([
        expect.objectContaining({
          id: "price-set-1",
        }),
      ])
    })

    it("list priceSets with relations and selects", async () => {
      const priceSetsResult = await service.list(
        {
          id: ["price-set-1"],
        },
        {
          select: ["id", "money_amounts.id", "money_amounts.amount"],
          relations: ["money_amounts"],
        }
      )

      const serialized = JSON.parse(JSON.stringify(priceSetsResult))

      expect(serialized).toEqual([
        {
          id: "price-set-1",
          money_amounts: [{ id: "money-amount-USD", amount: "500" }],
        },
      ])
    })
  })

  describe("listAndCount", () => {
    it("should return priceSets and count", async () => {
      const [priceSetsResult, count] = await service.listAndCount()

      expect(count).toEqual(3)
      expect(priceSetsResult).toEqual([
        expect.objectContaining({
          id: "price-set-1",
        }),
        expect.objectContaining({
          id: "price-set-2",
        }),
        expect.objectContaining({
          id: "price-set-3",
        }),
      ])
    })

    it("should return priceSets and count when filtered", async () => {
      const [priceSetsResult, count] = await service.listAndCount({
        id: ["price-set-1"],
      })

      expect(count).toEqual(1)
      expect(priceSetsResult).toEqual([
        expect.objectContaining({
          id: "price-set-1",
        }),
      ])
    })

    it("list priceSets with relations and selects", async () => {
      const [priceSetsResult, count] = await service.listAndCount(
        {
          id: ["price-set-1"],
        },
        {
          select: ["id", "min_quantity", "money_amounts.id"],
          relations: ["money_amounts"],
        }
      )

      const serialized = JSON.parse(JSON.stringify(priceSetsResult))

      expect(count).toEqual(1)
      expect(serialized).toEqual([
        {
          id: "price-set-1",
          money_amounts: [{ id: "money-amount-USD" }],
        },
      ])
    })

    it("should return priceSets and count when using skip and take", async () => {
      const [priceSetsResult, count] = await service.listAndCount(
        {},
        { skip: 1, take: 1 }
      )

      expect(count).toEqual(3)
      expect(priceSetsResult).toEqual([
        expect.objectContaining({
          id: "price-set-2",
        }),
      ])
    })

    it("should return requested fields", async () => {
      const [priceSetsResult, count] = await service.listAndCount(
        {},
        {
          take: 1,
          select: ["id"],
        }
      )

      const serialized = JSON.parse(JSON.stringify(priceSetsResult))

      expect(count).toEqual(3)
      expect(serialized).toEqual([
        {
          id: "price-set-1",
        },
      ])
    })
  })

  describe("retrieve", () => {
    const id = "price-set-1"

    it("should return priceSet for the given id", async () => {
      const priceSet = await service.retrieve(id)

      expect(priceSet).toEqual(
        expect.objectContaining({
          id,
        })
      )
    })

    it("should throw an error when priceSet with id does not exist", async () => {
      let error

      try {
        await service.retrieve("does-not-exist")
      } catch (e) {
        error = e
      }

      expect(error.message).toEqual(
        "PriceSet with id: does-not-exist was not found"
      )
    })

    it("should throw an error when a id is not provided", async () => {
      let error

      try {
        await service.retrieve(undefined as unknown as string)
      } catch (e) {
        error = e
      }

      expect(error.message).toEqual('"priceSetId" must be defined')
    })

    it("should return priceSet based on config select param", async () => {
      const priceSet = await service.retrieve(id, {
        select: ["id"],
      })

      const serialized = JSON.parse(JSON.stringify(priceSet))

      expect(serialized).toEqual({
        id,
      })
    })
  })

  describe("delete", () => {
    const id = "price-set-1"

    it("should delete the priceSets given an id successfully", async () => {
      await service.delete([id])

      const priceSets = await service.list({
        id: [id],
      })

      expect(priceSets).toHaveLength(0)
    })
  })

  describe("update", () => {
    const id = "price-set-1"

    it("should throw an error when a id does not exist", async () => {
      let error

      try {
        await service.update([
          {
            id: "does-not-exist",
          },
        ])
      } catch (e) {
        error = e
      }

      expect(error.message).toEqual(
        'PriceSet with id "does-not-exist" not found'
      )
    })
  })

  describe("create", () => {
    it("should throw an error when creating a price set with rule attributes that don't exist", async () => {
      let error

      try {
        await service.create([
          {
            rules: [{ rule_attribute: "does-not-exist" }],
          },
        ])
      } catch (e) {
        error = e
      }

      expect(error.message).toEqual(
        "Rule types don't exist for: does-not-exist"
      )
    })

    it("should fail to create a price set with rule types and money amounts with rule types that don't exits", async () => {
      let error

      try {
        await service.create([
          {
            rules: [{ rule_attribute: "region_id" }],
            prices: [
              {
                amount: 100,
                currency_code: "USD",
                rules: {
                  city: "Berlin",
                },
              },
            ],
          },
        ])
      } catch (e) {
        error = e
      }
      expect(error.message).toEqual(
        "Rule types don't exist for money amounts with rule attribute: city"
      )
    })

    it("should create a price set with rule types", async () => {
      const [priceSet] = await service.create([
        {
          rules: [{ rule_attribute: "region_id" }],
        },
      ])

      expect(priceSet).toEqual(
        expect.objectContaining({
          rule_types: [
            expect.objectContaining({
              rule_attribute: "region_id",
            }),
          ],
        })
      )
    })

    it("should create a price set with rule types and money amounts", async () => {
      const [priceSet] = await service.create([
        {
          rules: [{ rule_attribute: "region_id" }],
          prices: [
            {
              amount: 100,
              currency_code: "USD",
              rules: {
                region_id: "1",
              },
            },
          ],
        },
      ])

      expect(priceSet).toEqual(
        expect.objectContaining({
          rule_types: [
            expect.objectContaining({
              rule_attribute: "region_id",
            }),
          ],
          money_amounts: [
            expect.objectContaining({
              amount: "100",
              currency_code: "USD",
            }),
          ],
        })
      )
    })

    it("should create a price set with money amounts with and without rules", async () => {
      const [priceSet] = await service.create([
        {
          rules: [{ rule_attribute: "region_id" }],
          prices: [
            {
              amount: 100,
              currency_code: "USD",
              rules: {
                region_id: "1",
              },
            },
            {
              amount: 150,
              currency_code: "USD",
              rules: {},
            },
          ],
        },
      ])

      expect(priceSet).toEqual(
        expect.objectContaining({
          rule_types: [
            expect.objectContaining({
              rule_attribute: "region_id",
            }),
          ],
          money_amounts: expect.arrayContaining([
            expect.objectContaining({
              amount: "100",
              currency_code: "USD",
            }),
            expect.objectContaining({
              amount: "150",
              currency_code: "USD",
            }),
          ]),
        })
      )
    })

    it("should create a price set with rule types and money amountss", async () => {
      const [priceSet] = await service.create([
        {
          rules: [{ rule_attribute: "region_id" }],
          prices: [
            {
              amount: 100,
              currency_code: "USD",
              rules: {
                region_id: "10",
              },
            },
          ],
        },
      ])

      expect(priceSet).toEqual(
        expect.objectContaining({
          rule_types: [
            expect.objectContaining({
              rule_attribute: "region_id",
            }),
          ],
          money_amounts: [
            expect.objectContaining({
              amount: "100",
              currency_code: "USD",
            }),
          ],
          price_rules: [
            expect.objectContaining({
              value: "10",
            }),
          ],
        })
      )
    })

    it("should create a priceSet successfully", async () => {
      await service.create([
        {
          id: "price-set-new",
        } as unknown as CreatePriceSetDTO,
      ])

      const [priceSet] = await service.list({
        id: ["price-set-new"],
      })

      expect(priceSet).toEqual(
        expect.objectContaining({
          id: "price-set-new",
        })
      )
    })
  })

  describe("removeRules", () => {
    it("should delete prices for a price set associated to the rules that are deleted", async () => {
      const createdPriceSet = await service.create([
        {
          rules: [
            {
              rule_attribute: "region_id",
            },
            {
              rule_attribute: "currency_code",
            },
          ],
          prices: [
            {
              currency_code: "EUR",
              amount: 100,
              rules: {
                region_id: "test-region",
                currency_code: "test-currency",
              },
            },
            {
              currency_code: "EUR",
              amount: 500,
              rules: {
                currency_code: "test-currency",
              },
            },
          ],
        },
      ])

      await service.removeRules([
        {
          id: createdPriceSet[0].id,
          rules: ["region_id"],
        },
      ])

      let priceSet = await service.list(
        {
          id: [createdPriceSet[0].id],
        },
        {
          relations: ["rule_types", "money_amounts", "price_rules"],
        }
      )

      expect(
        expect.arrayContaining(
          expect.objectContaining({
            id: priceSet[0].id,
            price_rules: [
              {
                id: expect.any(String),
                rule_type: expect.objectContaining({
                  rule_attribute: "currency_code",
                }),
              },
            ],
            money_amounts: [
              expect.objectContaining({
                amount: "500",
                currency_code: "EUR",
              }),
            ],
            rule_types: [
              expect.objectContaining({
                rule_attribute: "currency_code",
              }),
            ],
          })
        )
      )

      await service.removeRules([
        {
          id: createdPriceSet[0].id,
          rules: ["currency_code"],
        },
      ])

      priceSet = await service.list(
        {
          id: [createdPriceSet[0].id],
        },
        {
          relations: ["rule_types", "money_amounts", "price_rules"],
        }
      )
      expect(priceSet).toEqual([
        {
          id: expect.any(String),
          price_rules: [],
          money_amounts: [],
          rule_types: [],
        },
      ])
    })
  })

  describe("addPrices", () => {
    it("should add prices to existing price set", async () => {
      await service.addPrices([
        {
          priceSetId: "price-set-1",
          prices: [
            {
              amount: 100,
              currency_code: "USD",
              rules: { currency_code: "USD" },
            },
          ],
        },
      ])

      const [priceSet] = await service.list(
        { id: ["price-set-1"] },
        { relations: ["money_amounts"] }
      )

      expect(priceSet).toEqual(
        expect.objectContaining({
          id: "price-set-1",
          money_amounts: expect.arrayContaining([
            expect.objectContaining({
              amount: "100",
              currency_code: "USD",
            }),
          ]),
        })
      )
    })

    it("should add prices to multiple existing price set", async () => {
      await service.addPrices([
        {
          priceSetId: "price-set-1",
          prices: [
            {
              amount: 100,
              currency_code: "USD",
              rules: { currency_code: "USD" },
            },
          ],
        },
        {
          priceSetId: "price-set-2",
          prices: [
            {
              amount: 150,
              currency_code: "EUR",
              rules: { region_id: "region-2" },
            },
          ],
        },
      ])

      const priceSets = await service.list(
        { id: ["price-set-1", "price-set-2"] },
        { relations: ["money_amounts"] }
      )

      expect(priceSets).toEqual([
        expect.objectContaining({
          id: "price-set-1",
          money_amounts: expect.arrayContaining([
            expect.objectContaining({
              amount: "100",
              currency_code: "USD",
            }),
          ]),
        }),
        expect.objectContaining({
          id: "price-set-2",
          money_amounts: expect.arrayContaining([
            expect.objectContaining({
              amount: "150",
              currency_code: "EUR",
            }),
          ]),
        }),
      ])
    })

    it("should fail with an appropriate error when trying to add a price with rule that doesn't exist", async () => {
      let error
      try {
        await service.addPrices({
          priceSetId: "price-set-1",
          prices: [
            {
              amount: 100,
              currency_code: "USD",
              rules: { city: "Paris" },
            },
          ],
        })
      } catch (e) {
        error = e
      }

      expect(error.message).toEqual("Rule types don't exist for: city")
    })
  })

  describe("addRules", () => {
    it("should add rules to existing price set", async () => {
      await service.addRules([
        {
          priceSetId: "price-set-1",
          rules: [
            {
              attribute: "region_id",
            },
          ],
        },
      ])

      const [priceSet] = await service.list(
        { id: ["price-set-1"] },
        { relations: ["rule_types"] }
      )

      expect(priceSet).toEqual(
        expect.objectContaining({
          id: "price-set-1",
          rule_types: expect.arrayContaining([
            expect.objectContaining({
              rule_attribute: "currency_code",
            }),
            expect.objectContaining({
              rule_attribute: "region_id",
            }),
          ]),
        })
      )
    })

    it("should fail to add rules to non-existent price sets", async () => {
      let error

      try {
        await service.addRules([
          {
            priceSetId: "price-set-doesn't-exist",
            rules: [
              {
                attribute: "region_id",
              },
            ],
          },
        ])
      } catch (e) {
        error = e
      }

      expect(error.message).toEqual(
        "PriceSets with ids: price-set-doesn't-exist was not found"
      )
    })

    it("should fail to add rules with non-existent attributes", async () => {
      let error

      try {
        await service.addRules([
          {
            priceSetId: "price-set-1",
            rules: [
              {
                attribute: "city",
              },
            ],
          },
        ])
      } catch (e) {
        error = e
      }

      expect(error.message).toEqual(
        "Rule types don't exist for attributes: city"
      )
    })
  })
})
