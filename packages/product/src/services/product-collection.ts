import { ProductCollection } from "@models"
import { Context, DAL, FindConfig, ProductTypes } from "@medusajs/types"
import { ModulesSdkUtils, MedusaError, isDefined } from "@medusajs/utils"

import { retrieveEntity } from "./helpers"

type InjectedDependencies = {
  productCollectionRepository: DAL.RepositoryService
}

export default class ProductCollectionService<
  TEntity extends ProductCollection = ProductCollection
> {
  protected readonly productCollectionRepository_: DAL.TreeRepositoryService

  constructor({ productCollectionRepository }: InjectedDependencies) {
    this.productCollectionRepository_ = productCollectionRepository
  }

  async retrieve(
    productCollectionId: string,
    config: FindConfig<ProductTypes.ProductCollectionDTO> = {},
    sharedContext?: Context
  ): Promise<TEntity> {
    return await retrieveEntity<ProductCollection, ProductTypes.ProductCollectionDTO>({
      id: productCollectionId,
      entityName: ProductCollection.name,
      repository: this.productCollectionRepository_,
      config,
      sharedContext,
    }) as TEntity
  }

  async list(
    filters: ProductTypes.FilterableProductCollectionProps = {},
    config: FindConfig<ProductTypes.ProductCollectionDTO> = {},
    sharedContext?: Context
  ): Promise<TEntity[]> {
    return (await this.productCollectionRepository_.find(
      this.buildListQueryOptions(filters, config),
      sharedContext
    )) as TEntity[]
  }

  async listAndCount(
    filters: ProductTypes.FilterableProductCollectionProps = {},
    config: FindConfig<ProductTypes.ProductCollectionDTO> = {},
    sharedContext?: Context
  ): Promise<[TEntity[], number]> {
    return (await this.productCollectionRepository_.findAndCount(
      this.buildListQueryOptions(filters, config),
      sharedContext
    )) as [TEntity[], number]
  }

  private buildListQueryOptions(
    filters: ProductTypes.FilterableProductCollectionProps = {},
    config: FindConfig<ProductTypes.ProductCollectionDTO> = {},
  ) {
    const queryOptions = ModulesSdkUtils.buildQuery<ProductCollection>(
      filters,
      config
    )

    queryOptions.where ??= {}

    if (filters.title) {
      queryOptions.where["title"] = { $like: filters.title }
    }

    return queryOptions
  }
}
