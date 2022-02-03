import { EntityManager } from "typeorm"
import { BaseService } from "medusa-interfaces"
import { MedusaError } from "medusa-core-utils"
import { ProductTagRepository } from "../repositories/product-tag"
import { ProductTag } from "../models/product-tag"
import { FindConfig } from "../types/common"
import { FilterableProductTagProps } from "../types/product"

type ProductTagConstructorProps = {
  manager: EntityManager
  productTagRepository: typeof ProductTagRepository
}

/**
 * Provides layer to manipulate product collections.
 * @extends BaseService
 */
class ProductTagService extends BaseService {
  private manager_: EntityManager
  private tagRepo_: typeof ProductTagRepository

  constructor({ manager, productTagRepository }: ProductTagConstructorProps) {
    super()
    this.manager_ = manager
    this.tagRepo_ = productTagRepository
  }

  withTransaction(transactionManager: EntityManager): ProductTagService {
    if (!transactionManager) {
      return this
    }

    const cloned = new ProductTagService({
      manager: transactionManager,
      productTagRepository: this.tagRepo_,
    })

    cloned.transactionManager_ = transactionManager

    return cloned
  }

  /**
   * Retrieves a product collection by id.
   * @param {string} tagId - the id of the product tag to retrieve
   * @param {Object} config - the config to retrieve the tag by
   * @return {Promise<ProductTag>} the collection.
   */
  async retrieve(
    tagId: string,
    config: FindConfig<ProductTag> = {}
  ): Promise<ProductTag> {
    const tagRepo = this.manager_.getCustomRepository(this.tagRepo_)

    const query = this.buildQuery_({ id: tagId }, config)
    const collection = await tagRepo.findOne(query)

    if (!collection) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Product tag with id: ${tagId} was not found`
      )
    }

    return collection
  }

  /**
   * Creates a product tag
   * @param {object} tag - the product tag to create
   * @return {Promise<ProductTag>} created product tag
   */
  async create(tag: Partial<ProductTag>): Promise<ProductTag> {
    return await this.atomicPhase_(async (manager: EntityManager) => {
      const tagRepo = manager.getCustomRepository(this.tagRepo_)

      const productCollection = tagRepo.create(tag)
      return await tagRepo.save(productCollection)
    })
  }

  /**
   * Lists product tags
   * @param {Object} selector - the query object for find
   * @param {Object} config - the config to be used for find
   * @return {Promise} the result of the find operation
   */
  async list(
    selector: FilterableProductTagProps = {},
    config: FindConfig<ProductTag> = { skip: 0, take: 20 }
  ): Promise<ProductTag[]> {
    const tagRepo = this.manager_.getCustomRepository(this.tagRepo_)

    const query = this.buildQuery_(selector, config)
    return await tagRepo.find(query)
  }

  /**
   * Lists product tags and adds count.
   * @param {Object} selector - the query object for find
   * @param {Object} config - the config to be used for find
   * @return {Promise} the result of the find operation
   */
  async listAndCount(
    selector: FilterableProductTagProps = {},
    config: FindConfig<ProductTag> = { skip: 0, take: 20 }
  ): Promise<[ProductTag[], number]> {
    const tagRepo = this.manager_.getCustomRepository(this.tagRepo_)

    const query = this.buildQuery_(selector, config)
    return await tagRepo.findAndCount(query)
  }
}

export default ProductTagService
