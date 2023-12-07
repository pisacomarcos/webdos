import { DeleteResult, EntityManager, In } from "typeorm"
import { FindConfig, Selector } from "../types/common"
import { FlagRouter, MedusaV2Flag } from "@medusajs/utils"
import { GenerateInputData, GenerateLineItemContext } from "../types/line-item"
import {
  LineItem,
  LineItemAdjustment,
  LineItemTaxLine,
  ProductVariant,
} from "../models"
import {
  PricingService,
  ProductService,
  ProductVariantService,
  RegionService,
  TaxProviderService,
} from "./index"
import { buildQuery, isString, setMetadata } from "../utils"

import { CartRepository } from "../repositories/cart"
import { DeepPartial } from "typeorm/common/DeepPartial"
import LineItemAdjustmentService from "./line-item-adjustment"
import { LineItemRepository } from "../repositories/line-item"
import { LineItemTaxLineRepository } from "../repositories/line-item-tax-line"
import { MedusaError } from "medusa-core-utils"
import { ProductVariantPricing } from "../types/pricing"
import TaxInclusivePricingFeatureFlag from "../loaders/feature-flags/tax-inclusive-pricing"
import { TransactionBaseService } from "../interfaces"

type InjectedDependencies = {
  manager: EntityManager
  lineItemRepository: typeof LineItemRepository
  lineItemTaxLineRepository: typeof LineItemTaxLineRepository
  cartRepository: typeof CartRepository
  productVariantService: ProductVariantService
  productService: ProductService
  pricingService: PricingService
  regionService: RegionService
  lineItemAdjustmentService: LineItemAdjustmentService
  taxProviderService: TaxProviderService
  featureFlagRouter: FlagRouter
}

class LineItemService extends TransactionBaseService {
  protected readonly lineItemRepository_: typeof LineItemRepository
  protected readonly itemTaxLineRepo_: typeof LineItemTaxLineRepository
  protected readonly cartRepository_: typeof CartRepository
  protected readonly productVariantService_: ProductVariantService
  protected readonly productService_: ProductService
  protected readonly pricingService_: PricingService
  protected readonly regionService_: RegionService
  protected readonly featureFlagRouter_: FlagRouter
  protected readonly lineItemAdjustmentService_: LineItemAdjustmentService
  protected readonly taxProviderService_: TaxProviderService

  constructor({
    lineItemRepository,
    lineItemTaxLineRepository,
    productVariantService,
    productService,
    pricingService,
    regionService,
    cartRepository,
    lineItemAdjustmentService,
    taxProviderService,
    featureFlagRouter,
  }: InjectedDependencies) {
    // eslint-disable-next-line prefer-rest-params
    super(arguments[0])

    this.lineItemRepository_ = lineItemRepository
    this.itemTaxLineRepo_ = lineItemTaxLineRepository
    this.productVariantService_ = productVariantService
    this.productService_ = productService
    this.pricingService_ = pricingService
    this.regionService_ = regionService
    this.cartRepository_ = cartRepository
    this.lineItemAdjustmentService_ = lineItemAdjustmentService
    this.taxProviderService_ = taxProviderService
    this.featureFlagRouter_ = featureFlagRouter
  }

  async list(
    selector: Selector<LineItem>,
    config: FindConfig<LineItem> = {
      skip: 0,
      take: 50,
      order: { created_at: "DESC" },
    }
  ): Promise<LineItem[]> {
    const lineItemRepo = this.activeManager_.withRepository(
      this.lineItemRepository_
    )
    const query = buildQuery(selector, config)
    return await lineItemRepo.find(query)
  }

  /**
   * Retrieves a line item by its id.
   * @param id - the id of the line item to retrieve
   * @param config - the config to be used at query building
   * @return the line item
   */
  async retrieve(id: string, config = {}): Promise<LineItem | never> {
    const lineItemRepository = this.activeManager_.withRepository(
      this.lineItemRepository_
    )

    const query = buildQuery({ id }, config)

    const lineItem = await lineItemRepository.findOne(query)

    if (!lineItem) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Line item with ${id} was not found`
      )
    }

    return lineItem
  }

  /**
   * Creates return line items for a given cart based on the return items in a
   * return.
   * @param returnId - the id to generate return items from.
   * @param cartId - the cart to assign the return line items to.
   * @return the created line items
   */
  async createReturnLines(
    returnId: string,
    cartId: string
  ): Promise<LineItem[]> {
    return await this.atomicPhase_(
      async (transactionManager: EntityManager) => {
        const lineItemRepo = transactionManager.withRepository(
          this.lineItemRepository_
        )

        const itemTaxLineRepo = transactionManager.withRepository(
          this.itemTaxLineRepo_
        )

        const returnLineItems = await lineItemRepo
          .findByReturn(returnId)
          .then((lineItems) => {
            return lineItems.map((lineItem) =>
              lineItemRepo.create({
                cart_id: cartId,
                thumbnail: lineItem.thumbnail,
                is_return: true,
                title: lineItem.title,
                variant_id: lineItem.variant_id,
                unit_price: -1 * lineItem.unit_price,
                quantity: lineItem.return_item.quantity,
                allow_discounts: lineItem.allow_discounts,
                includes_tax: !!lineItem.includes_tax,
                tax_lines: lineItem.tax_lines.map((taxLine) => {
                  return itemTaxLineRepo.create({
                    name: taxLine.name,
                    code: taxLine.code,
                    rate: taxLine.rate,
                    metadata: taxLine.metadata,
                  })
                }),
                metadata: lineItem.metadata,
                adjustments: lineItem.adjustments.map((adjustment) => {
                  return {
                    amount: -1 * adjustment.amount,
                    description: adjustment.description,
                    discount_id: adjustment.discount_id,
                    metadata: adjustment.metadata,
                  }
                }),
              })
            )
          })

        return await lineItemRepo.save(returnLineItems)
      }
    )
  }

  /**
   * Generate a single or multiple line item without persisting the data into the db
   * @param variantIdOrData
   * @param regionIdOrContext
   * @param quantity
   * @param context
   */
  async generate<
    T = string | GenerateInputData | GenerateInputData[],
    TResult = T extends string
      ? LineItem
      : T extends LineItem
      ? LineItem
      : LineItem[]
  >(
    variantIdOrData: T,
    regionIdOrContext: T extends string ? string : GenerateLineItemContext,
    quantity?: number,
    context: GenerateLineItemContext = {}
  ): Promise<TResult> {
    return await this.atomicPhase_(
      async (transactionManager: EntityManager) => {
        this.validateGenerateArguments(
          variantIdOrData,
          regionIdOrContext,
          quantity
        )

        // Resolve data
        const data = isString(variantIdOrData)
          ? {
              variantId: variantIdOrData,
              quantity: quantity as number,
            }
          : variantIdOrData

        const resolvedContext = isString(variantIdOrData)
          ? context
          : (regionIdOrContext as GenerateLineItemContext)

        const regionId = (
          isString(variantIdOrData)
            ? regionIdOrContext
            : resolvedContext.region_id
        ) as string

        const resolvedData = (
          Array.isArray(data) ? data : [data]
        ) as GenerateInputData[]

        const resolvedDataMap = new Map(
          resolvedData.map((d) => [d.variantId, d])
        )

        // Retrieve variants
        const variants = await this.productVariantService_.list(
          {
            id: resolvedData.map((d) => d.variantId),
          },
          {
            relations: ["product"],
          }
        )

        // Validate that all variants has been found
        const inputDataVariantId = new Set(resolvedData.map((d) => d.variantId))
        const foundVariants = new Set(variants.map((v) => v.id))
        const notFoundVariants = new Set(
          [...inputDataVariantId].filter((x) => !foundVariants.has(x))
        )

        if (notFoundVariants.size) {
          throw new MedusaError(
            MedusaError.Types.INVALID_DATA,
            `Unable to generate the line items, some variant has not been found: ${[
              ...notFoundVariants,
            ].join(", ")}`
          )
        }

        // Prepare data to retrieve variant pricing
        const variantsMap = new Map<string, ProductVariant>()
        const variantsToCalculatePricingFor: {
          variantId: string
          quantity: number
        }[] = []

        for (const variant of variants) {
          variantsMap.set(variant.id, variant)

          const variantResolvedData = resolvedDataMap.get(variant.id)
          if (
            resolvedContext.unit_price == null &&
            variantResolvedData?.unit_price == null
          ) {
            variantsToCalculatePricingFor.push({
              variantId: variant.id,
              quantity: variantResolvedData!.quantity,
            })
          }
        }

        let variantsPricing = {}

        if (variantsToCalculatePricingFor.length) {
          variantsPricing = await this.pricingService_
            .withTransaction(transactionManager)
            .getProductVariantsPricing(variantsToCalculatePricingFor, {
              region_id: regionId,
              customer_id: context?.customer_id,
              include_discount_prices: true,
            })
        }

        // Generate line items
        const generatedItems: LineItem[] = []

        for (const variantData of resolvedData) {
          const variant = variantsMap.get(
            variantData.variantId
          ) as ProductVariant
          const variantPricing = variantsPricing[variantData.variantId]

          const lineItem = await this.generateLineItem(
            variant,
            variantData.quantity,
            {
              ...resolvedContext,
              unit_price: variantData.unit_price ?? resolvedContext.unit_price,
              metadata: variantData.metadata ?? resolvedContext.metadata,
              variantPricing,
            }
          )

          if (resolvedContext.cart) {
            const adjustments = await this.lineItemAdjustmentService_
              .withTransaction(transactionManager)
              .generateAdjustments(resolvedContext.cart, lineItem, { variant })
            lineItem.adjustments =
              adjustments as unknown as LineItemAdjustment[]
          }

          generatedItems.push(lineItem)
        }

        return (Array.isArray(data)
          ? generatedItems
          : generatedItems[0]) as unknown as TResult
      }
    )
  }

  protected async generateLineItem(
    variant: {
      id: string
      title: string
      product_id: string
      product: {
        title: string
        thumbnail: string | null
        discountable: boolean
        is_giftcard: boolean
      }
    },
    quantity: number,
    context: GenerateLineItemContext & {
      variantPricing: ProductVariantPricing
    }
  ): Promise<LineItem> {
    let unit_price = Number(context.unit_price) < 0 ? 0 : context.unit_price
    let unitPriceIncludesTax = false
    let shouldMerge = false

    if (context.unit_price == null) {
      shouldMerge = true

      unitPriceIncludesTax =
        !!context.variantPricing?.calculated_price_includes_tax
      unit_price = context.variantPricing?.calculated_price ?? undefined
    }

    if (unit_price == null) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Cannot generate line item for variant "${
          variant.title ?? variant.product.title ?? variant.id
        }" without a price`
      )
    }

    const rawLineItem: Partial<LineItem> = {
      unit_price: unit_price,
      title: variant.product.title,
      description: variant.title,
      thumbnail: variant.product.thumbnail,
      variant_id: variant.id,
      quantity: quantity || 1,
      allow_discounts: variant.product.discountable,
      is_giftcard: variant.product.is_giftcard,
      metadata: context?.metadata || {},
      should_merge: shouldMerge,
    }

    if (this.featureFlagRouter_.isFeatureEnabled(MedusaV2Flag.key)) {
      rawLineItem.product_id = variant.product_id
    }

    if (
      this.featureFlagRouter_.isFeatureEnabled(
        TaxInclusivePricingFeatureFlag.key
      )
    ) {
      rawLineItem.includes_tax = unitPriceIncludesTax
    }

    rawLineItem.order_edit_id = context.order_edit_id || null

    const lineItemRepo = this.activeManager_.withRepository(
      this.lineItemRepository_
    )

    const lineItem = lineItemRepo.create(rawLineItem)
    lineItem.variant = variant as ProductVariant

    return lineItem
  }

  /**
   * Create a line item
   * @param data - the line item object to create
   * @return the created line item
   */
  async create<
    T = LineItem | LineItem[],
    TResult = T extends LineItem[] ? LineItem[] : LineItem
  >(data: T): Promise<TResult> {
    return await this.atomicPhase_(
      async (transactionManager: EntityManager) => {
        const lineItemRepository = transactionManager.withRepository(
          this.lineItemRepository_
        )

        const data_ = (
          Array.isArray(data) ? data : [data]
        ) as DeepPartial<LineItem>[]

        const items = lineItemRepository.create(data_)
        const lineItems = await lineItemRepository.save(items)

        return (Array.isArray(data)
          ? lineItems
          : lineItems[0]) as unknown as TResult
      }
    )
  }

  /**
   * Updates a line item
   * @param idOrSelector - the id or selector of the line item(s) to update
   * @param data - the properties to update the line item(s)
   * @return the updated line item(s)
   */
  async update(
    idOrSelector: string | Selector<LineItem>,
    data: Partial<LineItem>
  ): Promise<LineItem[]> {
    const { metadata, ...rest } = data

    return await this.atomicPhase_(
      async (transactionManager: EntityManager) => {
        const lineItemRepository = transactionManager.withRepository(
          this.lineItemRepository_
        )

        const selector =
          typeof idOrSelector === "string" ? { id: idOrSelector } : idOrSelector

        let lineItems = await this.list(selector)

        if (!lineItems.length) {
          const selectorConstraints = Object.entries(selector)
            .map(([key, value]) => `${key}: ${value}`)
            .join(", ")

          throw new MedusaError(
            MedusaError.Types.NOT_FOUND,
            `Line item with ${selectorConstraints} was not found`
          )
        }

        lineItems = lineItems.map((item) => {
          item.metadata = metadata ? setMetadata(item, metadata) : item.metadata
          return Object.assign(item, rest)
        })

        return await lineItemRepository.save(lineItems)
      }
    )
  }

  /**
   * Deletes a line item.
   * @param id - the id of the line item to delete
   * @return the result of the delete operation
   */
  async delete(id: string | string[]): Promise<DeleteResult> {
    return await this.atomicPhase_(
      async (transactionManager: EntityManager) => {
        const lineItemRepository = transactionManager.withRepository(
          this.lineItemRepository_
        )

        const ids = Array.isArray(id) ? id : [id]
        return await lineItemRepository.delete({ id: In(ids) })
      }
    )
  }

  /**
   * @deprecated no the cascade on the entity takes care of it
   * Deletes a line item with the tax lines.
   * @param id - the id of the line item to delete
   * @return the result of the delete operation
   */
  async deleteWithTaxLines(id: string): Promise<DeleteResult> {
    return await this.atomicPhase_(
      async (transactionManager: EntityManager) => {
        await this.taxProviderService_
          .withTransaction(transactionManager)
          .clearLineItemsTaxLines([id])

        return await this.delete(id)
      }
    )
  }

  /**
   * Create a line item tax line.
   * @param args - tax line partial passed to the repo create method
   * @return a new line item tax line
   */
  public createTaxLine(args: DeepPartial<LineItemTaxLine>): LineItemTaxLine {
    const itemTaxLineRepo = this.activeManager_.withRepository(
      this.itemTaxLineRepo_
    )

    return itemTaxLineRepo.create(args)
  }

  async cloneTo(
    ids: string | string[],
    data: DeepPartial<LineItem> = {},
    options: { setOriginalLineItemId?: boolean } = {
      setOriginalLineItemId: true,
    }
  ): Promise<LineItem[]> {
    ids = typeof ids === "string" ? [ids] : ids
    return await this.atomicPhase_(async (manager) => {
      let lineItems: DeepPartial<LineItem>[] = await this.list(
        {
          id: In(ids as string[]),
        },
        {
          relations: ["tax_lines", "adjustments"],
        }
      )

      const lineItemRepository = manager.withRepository(
        this.lineItemRepository_
      )

      const {
        order_id,
        swap_id,
        claim_order_id,
        cart_id,
        order_edit_id,
        ...lineItemData
      } = data

      if (
        !order_id &&
        !swap_id &&
        !claim_order_id &&
        !cart_id &&
        !order_edit_id
      ) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Unable to clone a line item that is not attached to at least one of: order_edit, order, swap, claim or cart."
        )
      }

      lineItems = lineItems.map((item) => ({
        ...item,
        ...lineItemData,
        id: undefined,
        order_id,
        swap_id,
        claim_order_id,
        cart_id,
        order_edit_id,
        original_item_id: options?.setOriginalLineItemId ? item.id : undefined,
        tax_lines: item.tax_lines?.map((tax_line) => ({
          ...tax_line,
          id: undefined,
          item_id: undefined,
        })),
        adjustments: item.adjustments?.map((adj) => ({
          ...adj,
          id: undefined,
          item_id: undefined,
        })),
      }))

      const clonedLineItemEntities = lineItemRepository.create(lineItems)
      return await lineItemRepository.save(clonedLineItemEntities)
    })
  }

  protected validateGenerateArguments<
    T = string | GenerateInputData | GenerateInputData[],
    TResult = T extends string
      ? LineItem
      : T extends LineItem
      ? LineItem
      : LineItem[]
  >(
    variantIdOrData: string | T,
    regionIdOrContext: T extends string ? string : GenerateLineItemContext,
    quantity?: number
  ): void | never {
    const errorMessage =
      "Unable to generate the line item because one or more required argument(s) are missing"

    if (isString(variantIdOrData)) {
      if (!quantity || !regionIdOrContext || !isString(regionIdOrContext)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `${errorMessage}. Ensure quantity, regionId, and variantId are passed`
        )
      }

      if (!variantIdOrData) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `${errorMessage}. Ensure variant id is passed`
        )
      }
      return
    }

    const resolvedContext = regionIdOrContext as GenerateLineItemContext

    if (!resolvedContext?.region_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `${errorMessage}. Ensure region or region_id are passed`
      )
    }

    const variantsData = Array.isArray(variantIdOrData)
      ? variantIdOrData
      : [variantIdOrData]

    const hasMissingVariantId = variantsData.some((d) => !d?.variantId)

    if (hasMissingVariantId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `${errorMessage}. Ensure a variant id is passed for each variant`
      )
    }
  }
}

export default LineItemService
