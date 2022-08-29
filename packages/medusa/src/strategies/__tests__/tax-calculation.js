import TaxCalculationStrategy from "../tax-calculation"
import TaxInclusivePricingFeatureFlag from "../../loaders/feature-flags/tax-inclusive-pricing";
import { FlagRouter } from "../../utils/flag-router";

const toTest = [
  {
    title: "calculates correctly without gift card",

    /*
     * Subtotal = 2 * 100 = 200
     * Taxable amount = 200 - 10 = 190
     * Taxline 1 = 190 * 0.0825 = 15.675 = 16
     * Taxline 2 = 190 * 0.125 = 13.75 = 14
     * Total tax = 40
     */
    expected: 40,
    items: [
      {
        id: "item_1",
        unit_price: 100,
        quantity: 2,
      },
    ],
    taxLines: [
      {
        item_id: "item_1",
        name: "Name 1",
        rate: 8.25,
      },
      {
        item_id: "item_1",
        name: "Name 2",
        rate: 12.5,
      },
    ],
    context: {
      shipping_address: null,
      customer: {
        email: "test@testson.com",
      },
      shipping_methods: [],
      region: {
        gift_cards_taxable: false,
      },
      allocation_map: {
        item_1: {
          discount: {
            amount: 10,
            unit_amount: 5,
          },
          gift_card: {
            amount: 10,
            unit_amount: 5,
          },
        },
      },
    },
  },
  {
    title: "calculates correctly with gift card",

    /*
     * Subtotal = 2 * 100 = 200
     * Taxable amount = 200 - 10 = 180
     * Taxline 1 = 180 * 0.0825 = 15
     * Taxline 2 = 180 * 0.125 = 23
     * Total tax = 38
     */
    expected: 40,
    items: [
      {
        id: "item_1",
        unit_price: 100,
        quantity: 2,
      },
    ],
    taxLines: [
      {
        item_id: "item_1",
        name: "Name 1",
        rate: 8.25,
      },
      {
        item_id: "item_1",
        name: "Name 2",
        rate: 12.5,
      },
    ],
    context: {
      shipping_address: null,
      customer: {
        email: "test@testson.com",
      },
      region: {
        gift_cards_taxable: true,
      },
      shipping_methods: [],
      allocation_map: {
        item_1: {
          discount: {
            amount: 10,
            unit_amount: 5,
          },
          gift_card: {
            amount: 10,
            unit_amount: 5,
          },
        },
      },
    },
  },
  {
    title: "calculates correctly with tax inclusive pricing",

    /*
     * Subtotal = 3 * 100 = 100
     * Taxable amount = 300
     * Taxline 1 = 100 * 0.2 * 2 = 40
     * Taxline 2 = 100 * 0.2 * 1 = 20
     * Total tax = 60
     */
    expected: 60,
    flags: { [TaxInclusivePricingFeatureFlag.key]: true },
    items: [
      {
        id: "item_1",
        unit_price: 120,
        quantity: 2,
        includes_tax: true
      },
      {
        id: "item_2",
        unit_price: 100,
        quantity: 1,
        includes_tax: false
      },
    ],
    taxLines: [
      {
        item_id: "item_1",
        name: "Name 1",
        rate: 20,
      },
      {
        item_id: "item_2",
        name: "Name 2",
        rate: 20,
      },
    ],
    context: {
      shipping_address: null,
      customer: {
        email: "test@testson.com",
      },
      region: {
        gift_cards_taxable: true,
      },
      shipping_methods: [],
      allocation_map: {},
    },
  },
]

describe("TaxCalculationStrategy", () => {
  describe("calculate", () => {
    test.each(toTest)(
      "$title",
      async ({ title, items, taxLines, context, expected, flags }) => {
        const calcStrat = new TaxCalculationStrategy({
          featureFlagRouter: new FlagRouter(flags || {}),
        })
        const val = await calcStrat.calculate(items, taxLines, context)
        expect(val).toEqual(expected)
      }
    )
  })
})
