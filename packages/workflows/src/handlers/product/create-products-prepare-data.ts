import { ProductTypes, SalesChannelTypes, WorkflowTypes } from "@medusajs/types"
import {
  FeatureFlagUtils,
  kebabCase,
  ShippingProfileUtils,
} from "@medusajs/utils"
import { WorkflowArguments } from "../../helper"

type ShippingProfileId = string
type SalesChannelId = string
type ProductHandle = string
type VariantIndexAndInventoryItems = {
  index: number
  inventoryItems: WorkflowTypes.ProductWorkflow.CreateVariantInventoryInputDTO[]
}
type VariantIndexAndPrices = {
  index: number
  prices: {
    region_id?: string
    currency_code?: string
    amount: number
    min_quantity?: number
    max_quantity?: number
  }[]
}

export type CreateProductsPreparedData = {
  products: ProductTypes.CreateProductDTO[]
  productsHandleVariantsIndexInventoryItemsMap: Map<
    ProductHandle,
    VariantIndexAndInventoryItems[]
  >
  productsHandleShippingProfileIdMap: Map<ProductHandle, ShippingProfileId>
  productsHandleSalesChannelsMap: Map<ProductHandle, SalesChannelId[]>
  productsHandleVariantsIndexPricesMap: Map<
    ProductHandle,
    VariantIndexAndPrices[]
  >
}

export async function createProductsPrepareData({
  container,
  context,
  data,
}: WorkflowArguments<WorkflowTypes.ProductWorkflow.CreateProductsWorkflowInputDTO>): Promise<CreateProductsPreparedData> {
  const { manager } = context
  let products = data.products

  const shippingProfileService = container
    .resolve("shippingProfileService")
    .withTransaction(manager)
  const featureFlagRouter = container.resolve("featureFlagRouter")
  const salesChannelService = container
    .resolve("salesChannelService")
    .withTransaction(manager)
  const salesChannelFeatureFlagKey =
    FeatureFlagUtils.SalesChannelFeatureFlag.key

  const shippingProfileServiceTx =
    shippingProfileService.withTransaction(manager)

  const shippingProfiles = await shippingProfileServiceTx.list({
    type: [
      ShippingProfileUtils.ShippingProfileType.DEFAULT,
      ShippingProfileUtils.ShippingProfileType.GIFT_CARD,
    ],
  })
  const defaultShippingProfile = shippingProfiles.find(
    (sp) => sp.type === ShippingProfileUtils.ShippingProfileType.DEFAULT
  )
  const gitCardShippingProfile = shippingProfiles.find(
    (sp) => sp.type === ShippingProfileUtils.ShippingProfileType.GIFT_CARD
  )

  let defaultSalesChannel: SalesChannelTypes.SalesChannelDTO | undefined
  if (featureFlagRouter.isFeatureEnabled(salesChannelFeatureFlagKey)) {
    defaultSalesChannel = await salesChannelService
      .withTransaction(manager)
      .retrieveDefault()
  }

  const productsHandleShippingProfileIdMap = new Map<
    ProductHandle,
    ShippingProfileId
  >()
  const productsHandleSalesChannelsMap = new Map<
    ProductHandle,
    SalesChannelId[]
  >()
  const productsHandleVariantsIndexPricesMap = new Map<
    ProductHandle,
    VariantIndexAndPrices[]
  >()
  const productsHandleVariantsIndexInventoryItemsMap = new Map<
    ProductHandle,
    VariantIndexAndInventoryItems[]
  >()

  for (const product of products) {
    product.handle ??= kebabCase(product.title)

    if (product.is_giftcard) {
      productsHandleShippingProfileIdMap.set(
        product.handle!,
        gitCardShippingProfile!.id
      )
    } else {
      productsHandleShippingProfileIdMap.set(
        product.handle!,
        defaultShippingProfile!.id
      )
    }

    if (
      featureFlagRouter.isFeatureEnabled(salesChannelFeatureFlagKey) &&
      !product.sales_channels?.length
    ) {
      productsHandleSalesChannelsMap.set(product.handle!, [
        defaultSalesChannel!.id,
      ])
    } else {
      productsHandleSalesChannelsMap.set(
        product.handle!,
        product.sales_channels!.map((s) => s.id)
      )
    }

    if (product.variants) {
      const hasPrices = product.variants.some((variant) => {
        return (variant.prices?.length ?? 0) > 0
      })

      const hasInventoryItems = product.variants.some((variant) => {
        return (variant.inventory_items?.length ?? 0) > 0
      })

      if (hasPrices) {
        const items =
          productsHandleVariantsIndexPricesMap.get(product.handle!) ?? []

        product.variants.forEach((variant, index) => {
          items.push({
            index,
            prices: variant.prices!,
          })
        })

        productsHandleVariantsIndexPricesMap.set(product.handle!, items)
      }

      if (hasInventoryItems) {
        const items =
          productsHandleVariantsIndexInventoryItemsMap.get(product.handle!) ??
          []

        product.variants.forEach((variant, index) => {
          items.push({
            index,
            inventoryItems: variant.inventory_items!,
          })
        })

        productsHandleVariantsIndexInventoryItemsMap.set(product.handle!, items)
      }
    }
  }

  products = products.map((productData) => {
    delete productData.sales_channels
    return productData
  })

  return {
    products: products as ProductTypes.CreateProductDTO[],
    productsHandleShippingProfileIdMap,
    productsHandleSalesChannelsMap,
    productsHandleVariantsIndexPricesMap,
    productsHandleVariantsIndexInventoryItemsMap,
  }
}

createProductsPrepareData.aliases = {
  payload: "payload",
}
