import {
  CalculatedPriceSetDTO,
  IPricingModuleService,
  PriceSetMoneyAmountDTO,
  RemoteQueryFunction,
} from "@medusajs/types"
import { FlagRouter, promiseAll, removeNullish } from "@medusajs/utils"
import {
  IPriceSelectionStrategy,
  PriceSelectionContext,
} from "../interfaces/price-selection-strategy"
import {
  MoneyAmount,
  Product,
  ProductVariant,
  Region,
  ShippingOption,
} from "../models"
import {
  PricedProduct,
  PricedShippingOption,
  PricedVariant,
  PricingContext,
  ProductVariantPricing,
  TaxedPricing,
} from "../types/pricing"
import { ProductVariantService, RegionService, TaxProviderService } from "."

import { EntityManager } from "typeorm"
import IsolatePricingDomainFeatureFlag from "../loaders/feature-flags/isolate-pricing-domain"
import IsolateProductDomainFeatureFlag from "../loaders/feature-flags/isolate-product-domain"
import { MedusaError } from "medusa-core-utils"
import TaxInclusivePricingFeatureFlag from "../loaders/feature-flags/tax-inclusive-pricing"
import { TaxServiceRate } from "../types/tax-service"
import { TransactionBaseService } from "../interfaces"
import { calculatePriceTaxAmount } from "../utils"

type InjectedDependencies = {
  manager: EntityManager
  productVariantService: ProductVariantService
  taxProviderService: TaxProviderService
  regionService: RegionService
  priceSelectionStrategy: IPriceSelectionStrategy
  featureFlagRouter: FlagRouter
  remoteQuery: RemoteQueryFunction
  pricingModuleService: IPricingModuleService
}

/**
 * Allows retrieval of prices.
 */
class PricingService extends TransactionBaseService {
  protected readonly regionService: RegionService
  protected readonly taxProviderService: TaxProviderService
  protected readonly priceSelectionStrategy: IPriceSelectionStrategy
  protected readonly productVariantService: ProductVariantService
  protected readonly featureFlagRouter: FlagRouter

  protected readonly pricingModuleService: IPricingModuleService
  protected readonly remoteQuery: RemoteQueryFunction

  constructor({
    productVariantService,
    taxProviderService,
    regionService,
    priceSelectionStrategy,
    featureFlagRouter,
    pricingModuleService,
    remoteQuery,
  }: InjectedDependencies) {
    // eslint-disable-next-line prefer-rest-params
    super(arguments[0])

    this.pricingModuleService = pricingModuleService
    this.remoteQuery = remoteQuery
    this.regionService = regionService
    this.taxProviderService = taxProviderService
    this.priceSelectionStrategy = priceSelectionStrategy
    this.productVariantService = productVariantService
    this.featureFlagRouter = featureFlagRouter
  }

  /**
   * Collects additional information necessary for completing the price
   * selection.
   * @param context - the price selection context to use
   * @return The pricing context
   */
  async collectPricingContext(
    context: PriceSelectionContext
  ): Promise<PricingContext> {
    let automaticTaxes = false
    let taxRate: number | null = null
    let currencyCode = context.currency_code

    let region: Region
    if (context.region_id) {
      region = await this.regionService
        .withTransaction(this.activeManager_)
        .retrieve(context.region_id, {
          select: ["id", "currency_code", "automatic_taxes", "tax_rate"],
        })

      currencyCode = region.currency_code
      automaticTaxes = region.automatic_taxes
      taxRate = region.tax_rate
    }

    return {
      price_selection: {
        ...context,
        currency_code: currencyCode,
      },
      automatic_taxes: automaticTaxes,
      tax_rate: taxRate,
    }
  }

  /**
   * Gets the prices for a product variant
   * @param variantPricing - the prices retrieved from a variant
   * @param productRates - the tax rates that the product has applied
   * @return The tax related variant prices.
   */
  calculateTaxes(
    variantPricing: ProductVariantPricing,
    productRates: TaxServiceRate[]
  ): TaxedPricing {
    const rate = productRates.reduce(
      (accRate: number, nextTaxRate: TaxServiceRate) => {
        return accRate + (nextTaxRate.rate || 0) / 100
      },
      0
    )

    const taxedPricing: TaxedPricing = {
      original_tax: null,
      calculated_tax: null,
      original_price_incl_tax: null,
      calculated_price_incl_tax: null,
      tax_rates: productRates,
    }

    if (variantPricing.calculated_price !== null) {
      const includesTax = !!(
        this.featureFlagRouter.isFeatureEnabled(
          TaxInclusivePricingFeatureFlag.key
        ) && variantPricing.calculated_price_includes_tax
      )
      taxedPricing.calculated_tax = Math.round(
        calculatePriceTaxAmount({
          price: variantPricing.calculated_price,
          taxRate: rate,
          includesTax,
        })
      )

      taxedPricing.calculated_price_incl_tax =
        variantPricing.calculated_price_includes_tax
          ? variantPricing.calculated_price
          : variantPricing.calculated_price + taxedPricing.calculated_tax
    }

    if (variantPricing.original_price !== null) {
      const includesTax = !!(
        this.featureFlagRouter.isFeatureEnabled(
          TaxInclusivePricingFeatureFlag.key
        ) && variantPricing.original_price_includes_tax
      )
      taxedPricing.original_tax = Math.round(
        calculatePriceTaxAmount({
          price: variantPricing.original_price,
          taxRate: rate,
          includesTax,
        })
      )

      taxedPricing.original_price_incl_tax =
        variantPricing.original_price_includes_tax
          ? variantPricing.original_price
          : variantPricing.original_price + taxedPricing.original_tax
    }

    return taxedPricing
  }

  private async getProductVariantPricingModulePricing_(
    variantPriceData: {
      variantId: string
      quantity?: number
    }[],
    context: PricingContext
  ) {
    const variables = {
      variant_id: variantPriceData.map((pricedata) => pricedata.variantId),
    }

    const query = {
      product_variant_price_set: {
        __args: variables,
        fields: ["variant_id", "price_set_id"],
      },
    }

    const variantPriceSets = await this.remoteQuery(query)

    const variantIdToPriceSetIdMap: Map<string, string> = new Map(
      variantPriceSets.map((variantPriceSet) => [
        variantPriceSet.variant_id,
        variantPriceSet.price_set_id,
      ])
    )

    const priceSetIds: string[] = variantPriceSets.map(
      (variantPriceSet) => variantPriceSet.price_set_id
    )

    const queryContext: PriceSelectionContext = removeNullish(
      context.price_selection
    )

    let priceSets: CalculatedPriceSetDTO[] = []

    if (queryContext.currency_code) {
      priceSets = (await this.pricingModuleService.calculatePrices(
        { id: priceSetIds },
        {
          context: queryContext as any,
        }
      )) as unknown as CalculatedPriceSetDTO[]
    }

    const priceSetMap = new Map<string, CalculatedPriceSetDTO>(
      priceSets.map((priceSet) => [priceSet.id, priceSet])
    )

    const pricingResultMap = new Map()

    variantPriceData.forEach(({ variantId }) => {
      const priceSetId = variantIdToPriceSetIdMap.get(variantId)

      const pricingResult: ProductVariantPricing = {
        prices: [] as MoneyAmount[],
        original_price: null,
        calculated_price: null,
        calculated_price_type: null,
        original_price_includes_tax: null,
        calculated_price_includes_tax: null,
        original_price_incl_tax: null,
        calculated_price_incl_tax: null,
        original_tax: null,
        calculated_tax: null,
        tax_rates: null,
      }

      if (priceSetId) {
        const prices = priceSetMap.get(priceSetId)

        if (prices) {
          pricingResult.prices = [prices] as MoneyAmount[]
          pricingResult.original_price = prices.amount
          pricingResult.calculated_price = prices.amount
        }
      }
      pricingResultMap.set(variantId, pricingResult)
    })

    return pricingResultMap
  }

  private async getProductVariantPricing_(
    data: {
      variantId: string
      quantity?: number
    }[],
    context: PricingContext
  ): Promise<Map<string, ProductVariantPricing>> {
    if (
      this.featureFlagRouter.isFeatureEnabled(
        IsolateProductDomainFeatureFlag.key
      ) &&
      this.featureFlagRouter.isFeatureEnabled(
        IsolatePricingDomainFeatureFlag.key
      )
    ) {
      return await this.getProductVariantPricingModulePricing_(data, context)
    }

    const variantsPricing = await this.priceSelectionStrategy
      .withTransaction(this.activeManager_)
      .calculateVariantPrice(data, context.price_selection)

    const pricingResultMap = new Map()

    for (const [variantId, pricing] of variantsPricing.entries()) {
      const pricingResult: ProductVariantPricing = {
        prices: pricing.prices,
        original_price: pricing.originalPrice,
        calculated_price: pricing.calculatedPrice,
        calculated_price_type: pricing.calculatedPriceType,
        original_price_includes_tax: pricing.originalPriceIncludesTax,
        calculated_price_includes_tax: pricing.calculatedPriceIncludesTax,
        original_price_incl_tax: null,
        calculated_price_incl_tax: null,
        original_tax: null,
        calculated_tax: null,
        tax_rates: null,
      }

      if (context.automatic_taxes && context.price_selection.region_id) {
        const taxRates = context.price_selection.tax_rates || []
        const taxResults = this.calculateTaxes(pricingResult, taxRates)

        pricingResult.original_price_incl_tax =
          taxResults.original_price_incl_tax
        pricingResult.calculated_price_incl_tax =
          taxResults.calculated_price_incl_tax
        pricingResult.original_tax = taxResults.original_tax
        pricingResult.calculated_tax = taxResults.calculated_tax
        pricingResult.tax_rates = taxResults.tax_rates
      }

      pricingResultMap.set(variantId, pricingResult)
    }

    return pricingResultMap
  }

  /**
   * Gets the prices for a product variant.
   * @param variant
   * @param context - the price selection context to use
   * @return The product variant prices
   */
  async getProductVariantPricing(
    variant: Pick<ProductVariant, "id" | "product_id">,
    context: PriceSelectionContext | PricingContext
  ): Promise<ProductVariantPricing> {
    let pricingContext: PricingContext
    if ("automatic_taxes" in context) {
      pricingContext = context
    } else {
      pricingContext = await this.collectPricingContext(context)
    }

    let productRates: Map<string, TaxServiceRate[]> = new Map()

    if (
      pricingContext.automatic_taxes &&
      pricingContext.price_selection.region_id
    ) {
      // Here we assume that the variants belongs to the same product since the context is shared
      const productId = variant.product_id
      productRates = await this.taxProviderService.getRegionRatesForProduct(
        productId,
        {
          id: pricingContext.price_selection.region_id,
          tax_rate: pricingContext.tax_rate,
        }
      )
      pricingContext.price_selection.tax_rates = productRates.get(productId)
    }

    const productVariantPricing = await this.getProductVariantPricing_(
      [
        {
          variantId: variant.id,
          quantity: pricingContext.price_selection.quantity,
        },
      ],
      pricingContext
    )

    return productVariantPricing.get(variant.id)!
  }

  /**
   * Gets the prices for a product variant by a variant id.
   * @param variantId - the id of the variant to get prices for
   * @param context - the price selection context to use
   * @return The product variant prices
   * @deprecated Use {@link getProductVariantsPricing} instead.
   */
  async getProductVariantPricingById(
    variantId: string,
    context: PriceSelectionContext | PricingContext
  ): Promise<ProductVariantPricing> {
    let pricingContext: PricingContext
    if ("automatic_taxes" in context) {
      pricingContext = context
    } else {
      pricingContext = await this.collectPricingContext(context)
    }

    let productRates: TaxServiceRate[] = []
    if (
      pricingContext.automatic_taxes &&
      pricingContext.price_selection.region_id
    ) {
      const { product_id } = await this.productVariantService
        .withTransaction(this.activeManager_)
        .retrieve(variantId, { select: ["id", "product_id"] })

      const regionRatesForProduct = await this.taxProviderService
        .withTransaction(this.activeManager_)
        .getRegionRatesForProduct([product_id], {
          id: pricingContext.price_selection.region_id,
          tax_rate: pricingContext.tax_rate,
        })

      productRates = regionRatesForProduct.get(product_id)!
    }

    pricingContext.price_selection.tax_rates = productRates
    const productVariantPricing = await this.getProductVariantPricing_(
      [{ variantId }],
      pricingContext
    )

    return productVariantPricing.get(variantId)!
  }

  /**
   * Gets the prices for a collection of variants.
   * @param data
   * @param context - the price selection context to use
   * @return The product variant prices
   */
  async getProductVariantsPricing(
    data: { variantId: string; quantity?: number }[],
    context: PriceSelectionContext | PricingContext
  ): Promise<{ [variant_id: string]: ProductVariantPricing }> {
    let pricingContext: PricingContext
    if ("automatic_taxes" in context) {
      pricingContext = context
    } else {
      pricingContext = await this.collectPricingContext(context)
    }

    const dataMap = new Map(data.map((d) => [d.variantId, d]))

    const variants = await this.productVariantService
      .withTransaction(this.activeManager_)
      .list(
        { id: data.map((d) => d.variantId) },
        { select: ["id", "product_id"] }
      )

    let productsRatesMap: Map<string, TaxServiceRate[]> = new Map()

    if (pricingContext.price_selection.region_id) {
      // Here we assume that the variants belongs to the same product since the context is shared
      const productId = variants[0]?.product_id
      productsRatesMap = await this.taxProviderService
        .withTransaction(this.activeManager_)
        .getRegionRatesForProduct(productId, {
          id: pricingContext.price_selection.region_id,
          tax_rate: pricingContext.tax_rate,
        })

      pricingContext.price_selection.tax_rates =
        productsRatesMap.get(productId)!
    }

    const variantsPricingMap = await this.getProductVariantPricing_(
      variants.map((v) => ({
        variantId: v.id,
        quantity: dataMap.get(v.id)!.quantity,
      })),
      pricingContext
    )

    const pricingResult: { [variant_id: string]: ProductVariantPricing } = {}
    for (const { variantId } of data) {
      pricingResult[variantId] = variantsPricingMap.get(variantId)!
    }

    return pricingResult
  }

  private async getProductPricing_(
    data: { productId: string; variants: ProductVariant[] }[],
    context: PricingContext
  ): Promise<Map<string, Record<string, ProductVariantPricing>>> {
    let taxRatesMap: Map<string, TaxServiceRate[]>

    if (context.automatic_taxes && context.price_selection.region_id) {
      taxRatesMap = await this.taxProviderService
        .withTransaction(this.activeManager_)
        .getRegionRatesForProduct(
          data.map((d) => d.productId),
          {
            id: context.price_selection.region_id,
            tax_rate: context.tax_rate,
          }
        )
    }

    const productsPricingMap = new Map<
      string,
      Record<string, ProductVariantPricing>
    >()

    await promiseAll(
      data.map(async ({ productId, variants }) => {
        const pricingData = variants.map((variant) => {
          return { variantId: variant.id }
        })

        const context_ = { ...context }
        if (context_.automatic_taxes && context_.price_selection.region_id) {
          context_.price_selection.tax_rates = taxRatesMap.get(productId)!
        }

        const variantsPricingMap = await this.getProductVariantPricing_(
          pricingData,
          context_
        )

        const productVariantsPricing = productsPricingMap.get(productId) || {}
        variantsPricingMap.forEach((variantPricing, variantId) => {
          productVariantsPricing[variantId] = variantPricing
        })
        productsPricingMap.set(productId, productVariantsPricing)
      })
    )

    return productsPricingMap
  }

  /**
   * Gets all the variant prices for a product. All the product's variants will
   * be fetched.
   * @param product - the product to get pricing for.
   * @param context - the price selection context to use
   * @return A map of variant ids to their corresponding prices
   */
  async getProductPricing(
    product: Pick<Product, "id" | "variants">,
    context: PriceSelectionContext
  ): Promise<Record<string, ProductVariantPricing>> {
    const pricingContext = await this.collectPricingContext(context)
    const productPricing = await this.getProductPricing_(
      [{ productId: product.id, variants: product.variants }],
      pricingContext
    )
    return productPricing.get(product.id)!
  }

  /**
   * Gets all the variant prices for a product by the product id
   * @param productId - the id of the product to get prices for
   * @param context - the price selection context to use
   * @return A map of variant ids to their corresponding prices
   */
  async getProductPricingById(
    productId: string,
    context: PriceSelectionContext
  ): Promise<Record<string, ProductVariantPricing>> {
    const pricingContext = await this.collectPricingContext(context)
    const variants = await this.productVariantService.list(
      { product_id: productId },
      { select: ["id"] }
    )
    const productPricing = await this.getProductPricing_(
      [{ productId, variants }],
      pricingContext
    )
    return productPricing.get(productId)!
  }

  /**
   * Set additional prices on a list of product variants.
   * @param variants
   * @param context - the price selection context to use
   * @return A list of products with variants decorated with prices
   */
  async setVariantPrices(
    variants: ProductVariant[],
    context: PriceSelectionContext = {}
  ): Promise<PricedVariant[]> {
    const pricingContext = await this.collectPricingContext(context)

    const variantsPricingMap = await this.getProductVariantsPricing(
      variants.map((v) => ({
        variantId: v.id,
        quantity: context.quantity,
      })),
      pricingContext
    )

    return variants.map((variant) => {
      const variantPricing = variantsPricingMap[variant.id]
      Object.assign(variant, variantPricing)
      return variant as unknown as PricedVariant
    })
  }

  /**
   * Set additional prices on a list of products.
   * @param products - list of products on which to set additional prices
   * @param context - the price selection context to use
   * @return A list of products with variants decorated with prices
   */
  async setProductPrices(
    products: Product[],
    context: PriceSelectionContext = {}
  ): Promise<(Product | PricedProduct)[]> {
    const pricingContext = await this.collectPricingContext(context)

    const pricingData = products
      .filter((p) => p.variants.length)
      .map((product) => ({
        productId: product.id,
        variants: product.variants,
      }))

    const productsVariantsPricingMap = await this.getProductPricing_(
      pricingData,
      pricingContext
    )

    return products.map((product) => {
      if (!product?.variants?.length) {
        return product
      }

      product.variants.map((productVariant): PricedVariant => {
        const variantPricing = productsVariantsPricingMap.get(product.id)!
        const pricing = variantPricing[productVariant.id]

        Object.assign(productVariant, pricing)
        return productVariant as unknown as PricedVariant
      })

      return product
    })
  }

  private async getPricingModuleVariantMoneyAmounts(
    variantIds: string[]
  ): Promise<Map<string, MoneyAmount[]>> {
    const variables = {
      variant_id: variantIds,
    }

    const query = {
      product_variant_price_set: {
        __args: variables,
        fields: ["variant_id", "price_set_id"],
      },
    }

    const variantPriceSets = await this.remoteQuery(query)

    const priceSetIdToVariantIdMap: Map<string, string> = new Map(
      variantPriceSets.map((variantPriceSet) => [
        variantPriceSet.price_set_id,
        variantPriceSet.variant_id,
      ])
    )

    const priceSetIds: string[] = variantPriceSets.map(
      (variantPriceSet) => variantPriceSet.price_set_id
    )

    const priceSetMoneyAmounts: PriceSetMoneyAmountDTO[] =
      await this.pricingModuleService.listPriceSetMoneyAmounts(
        {
          price_set_id: priceSetIds,
        },
        {
          relations: [
            "money_amount",
            "price_set",
            "price_rules",
            "price_rules.rule_type",
          ],
        }
      )

    const variantIdMoneyAmountMap = priceSetMoneyAmounts.reduce(
      (map, priceSetMoneyAmount) => {
        const variantId = priceSetIdToVariantIdMap.get(
          priceSetMoneyAmount.price_set!.id
        )
        if (!variantId) {
          return map
        }

        const regionId = priceSetMoneyAmount.price_rules!.find(
          (pr) => pr.rule_type.rule_attribute === "region_id"
        )?.value

        const moneyAmount = {
          ...priceSetMoneyAmount.money_amount,
          region_id: null as null | string,
        }

        if (regionId) {
          moneyAmount.region_id = regionId
        }

        if (map.has(variantId)) {
          map.get(variantId).push(moneyAmount)
        } else {
          map.set(variantId, [moneyAmount])
        }
        return map
      },
      new Map()
    )

    return variantIdMoneyAmountMap
  }

  async setAdminVariantPricing(
    variants: ProductVariant[],
    context: PriceSelectionContext = {}
  ): Promise<PricedVariant[]> {
    if (
      !this.featureFlagRouter.isFeatureEnabled(
        IsolatePricingDomainFeatureFlag.key
      )
    ) {
      return await this.setVariantPrices(variants, context)
    }

    const variantIds = variants.map((variant) => variant.id)

    const variantIdMoneyAmountMap =
      await this.getPricingModuleVariantMoneyAmounts(variantIds)

    return variants.map((variant) => {
      const pricing: ProductVariantPricing = {
        prices: variantIdMoneyAmountMap.get(variant.id) ?? [],
        original_price: null,
        calculated_price: null,
        calculated_price_type: null,
        original_price_includes_tax: null,
        calculated_price_includes_tax: null,
        original_price_incl_tax: null,
        calculated_price_incl_tax: null,
        original_tax: null,
        calculated_tax: null,
        tax_rates: null,
      }

      Object.assign(variant, pricing)
      return variant as unknown as PricedVariant
    })
  }

  async setAdminProductPricing(
    products: Product[]
  ): Promise<(Product | PricedProduct)[]> {
    if (
      !this.featureFlagRouter.isFeatureEnabled(
        IsolatePricingDomainFeatureFlag.key
      )
    ) {
      return await this.setProductPrices(products)
    }

    const variantIds = products
      .map((product) => product.variants.map((variant) => variant.id).flat())
      .flat()

    const variantIdMoneyAmountMap =
      await this.getPricingModuleVariantMoneyAmounts(variantIds)

    return products.map((product) => {
      if (!product?.variants?.length) {
        return product
      }

      product.variants.map((productVariant): PricedVariant => {
        const pricing: ProductVariantPricing = {
          prices: variantIdMoneyAmountMap.get(productVariant.id) ?? [],
          original_price: null,
          calculated_price: null,
          calculated_price_type: null,
          original_price_includes_tax: null,
          calculated_price_includes_tax: null,
          original_price_incl_tax: null,
          calculated_price_incl_tax: null,
          original_tax: null,
          calculated_tax: null,
          tax_rates: null,
        }

        Object.assign(productVariant, pricing)

        return productVariant as unknown as PricedVariant
      })

      return product
    })
  }

  /**
   * Gets the prices for a shipping option.
   * @param shippingOption - the shipping option to get prices for
   * @param context - the price selection context to use
   * @return The shipping option prices
   */
  async getShippingOptionPricing(
    shippingOption: ShippingOption,
    context: PriceSelectionContext | PricingContext
  ): Promise<PricedShippingOption> {
    let pricingContext: PricingContext
    if ("automatic_taxes" in context) {
      pricingContext = context
    } else {
      pricingContext =
        (context as PricingContext) ??
        (await this.collectPricingContext(context))
    }

    let shippingOptionRates: TaxServiceRate[] = []
    if (
      pricingContext.automatic_taxes &&
      pricingContext.price_selection.region_id
    ) {
      shippingOptionRates = await this.taxProviderService
        .withTransaction(this.activeManager_)
        .getRegionRatesForShipping(shippingOption.id, {
          id: pricingContext.price_selection.region_id,
          tax_rate: pricingContext.tax_rate,
        })
    }

    const price = shippingOption.amount || 0
    const rate = shippingOptionRates.reduce(
      (accRate: number, nextTaxRate: TaxServiceRate) => {
        return accRate + (nextTaxRate.rate || 0) / 100
      },
      0
    )

    const includesTax =
      this.featureFlagRouter.isFeatureEnabled(
        TaxInclusivePricingFeatureFlag.key
      ) && shippingOption.includes_tax

    const taxAmount = Math.round(
      calculatePriceTaxAmount({
        taxRate: rate,
        price,
        includesTax,
      })
    )
    const totalInclTax = includesTax ? price : price + taxAmount

    return {
      ...shippingOption,
      price_incl_tax: totalInclTax,
      tax_rates: shippingOptionRates,
      tax_amount: taxAmount,
    }
  }

  /**
   * Set additional prices on a list of shipping options.
   * @param shippingOptions - list of shipping options on which to set additional prices
   * @param context - the price selection context to use
   * @return A list of shipping options with prices
   */
  async setShippingOptionPrices(
    shippingOptions: ShippingOption[],
    context: Omit<PriceSelectionContext, "region_id"> = {}
  ): Promise<PricedShippingOption[]> {
    const regions = new Set<string>()

    for (const shippingOption of shippingOptions) {
      regions.add(shippingOption.region_id)
    }

    const contexts = await promiseAll(
      [...regions].map(async (regionId) => {
        return {
          context: await this.collectPricingContext({
            ...context,
            region_id: regionId,
          }),
          region_id: regionId,
        }
      })
    )

    const shippingOptionPricingPromises: Promise<PricedShippingOption>[] = []

    shippingOptions.map(async (shippingOption) => {
      const pricingContext = contexts.find(
        (c) => c.region_id === shippingOption.region_id
      )

      if (!pricingContext) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Could not find pricing context for shipping option"
        )
      }

      shippingOptionPricingPromises.push(
        this.getShippingOptionPricing(shippingOption, pricingContext.context)
      )
    })

    return await promiseAll(shippingOptionPricingPromises)
  }
}

export default PricingService
