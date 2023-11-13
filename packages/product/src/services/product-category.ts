import { Context, DAL, FindConfig, ProductTypes } from "@medusajs/types"
import {
  composeMessage,
  InjectManager,
  InjectTransactionManager,
  isDefined,
  MedusaContext,
  MedusaError,
  ModulesSdkUtils,
} from "@medusajs/utils"
import { ProductCategory } from "@models"
import { ProductCategoryRepository } from "@repositories"

import { Modules } from "@medusajs/modules-sdk"
import {
  InternalContext,
  ProductCategoryEvents,
  ProductCategoryServiceTypes,
} from "../types"

type InjectedDependencies = {
  productCategoryRepository: DAL.TreeRepositoryService
}

export default class ProductCategoryService<
  TEntity extends ProductCategory = ProductCategory
> {
  protected readonly productCategoryRepository_: DAL.TreeRepositoryService

  constructor({ productCategoryRepository }: InjectedDependencies) {
    this.productCategoryRepository_ = productCategoryRepository
  }

  @InjectManager("productCategoryRepository_")
  async retrieve(
    productCategoryId: string,
    config: FindConfig<ProductTypes.ProductCategoryDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TEntity> {
    if (!isDefined(productCategoryId)) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `"productCategoryId" must be defined`
      )
    }

    const queryOptions = ModulesSdkUtils.buildQuery<ProductCategory>(
      {
        id: productCategoryId,
      },
      config
    )

    const transformOptions = {
      includeDescendantsTree: true,
    }

    const productCategories = await this.productCategoryRepository_.find(
      queryOptions,
      transformOptions,
      sharedContext
    )

    if (!productCategories?.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `ProductCategory with id: ${productCategoryId} was not found`
      )
    }

    return productCategories[0] as TEntity
  }

  @InjectManager("productCategoryRepository_")
  async list(
    filters: ProductTypes.FilterableProductCategoryProps = {},
    config: FindConfig<ProductTypes.ProductCategoryDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TEntity[]> {
    const transformOptions = {
      includeDescendantsTree: filters?.include_descendants_tree || false,
    }
    delete filters.include_descendants_tree

    const queryOptions = ModulesSdkUtils.buildQuery<ProductCategory>(
      filters,
      config
    )
    queryOptions.where ??= {}

    return (await this.productCategoryRepository_.find(
      queryOptions,
      transformOptions,
      sharedContext
    )) as TEntity[]
  }

  @InjectManager("productCategoryRepository_")
  async listAndCount(
    filters: ProductTypes.FilterableProductCategoryProps = {},
    config: FindConfig<ProductTypes.ProductCategoryDTO> = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<[TEntity[], number]> {
    const transformOptions = {
      includeDescendantsTree: filters?.include_descendants_tree || false,
    }
    delete filters.include_descendants_tree

    const queryOptions = ModulesSdkUtils.buildQuery<ProductCategory>(
      filters,
      config
    )
    queryOptions.where ??= {}

    return (await this.productCategoryRepository_.findAndCount(
      queryOptions,
      transformOptions,
      sharedContext
    )) as [TEntity[], number]
  }

  @InjectTransactionManager("productCategoryRepository_")
  async create(
    data: ProductCategoryServiceTypes.CreateProductCategoryDTO,
    @MedusaContext() sharedContext: InternalContext = {}
  ): Promise<TEntity> {
    // TODO: bulk create
    const variant = await (
      this.productCategoryRepository_ as unknown as ProductCategoryRepository
    ).create(data, sharedContext)

    sharedContext.messageAggregator?.save(
      composeMessage(ProductCategoryEvents.CATEGORY_CREATED, {
        data: { id: variant.id },
        service: Modules.PRODUCT,
        entity: ProductCategory.name,
        context: sharedContext,
      })
    )

    return variant as TEntity
  }

  @InjectTransactionManager("productCategoryRepository_")
  async update(
    id: string,
    data: ProductCategoryServiceTypes.UpdateProductCategoryDTO,
    @MedusaContext() sharedContext: InternalContext = {}
  ): Promise<TEntity> {
    // TODO: bulk update
    const variant = await (
      this.productCategoryRepository_ as unknown as ProductCategoryRepository
    ).update(id, data, sharedContext)

    sharedContext.messageAggregator?.save(
      composeMessage(ProductCategoryEvents.CATEGORY_UPDATED, {
        data: { id: variant.id },
        service: Modules.PRODUCT,
        entity: ProductCategory.name,
        context: sharedContext,
      })
    )

    return variant as TEntity
  }

  @InjectTransactionManager("productCategoryRepository_")
  async delete(
    id: string,
    @MedusaContext() sharedContext: InternalContext = {}
  ): Promise<void> {
    // TODO: bulk delete
    await this.productCategoryRepository_.delete(id, sharedContext)

    sharedContext.messageAggregator?.save(
      composeMessage(ProductCategoryEvents.CATEGORY_DELETED, {
        data: { id },
        service: Modules.PRODUCT,
        entity: ProductCategory.name,
        context: sharedContext,
      })
    )
  }
}
