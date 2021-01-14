import { Validator, MedusaError } from "medusa-core-utils"
import { BaseService } from "medusa-interfaces"
import _ from "lodash"

/**
 * Provides layer to manipulate line items.
 * @implements BaseService
 */
class LineItemService extends BaseService {
  constructor({
    manager,
    lineItemRepository,
    productVariantService,
    productService,
    regionService,
    cartRepository,
  }) {
    super()

    /** @private @const {EntityManager} */
    this.manager_ = manager

    /** @private @const {LineItemRepository} */
    this.lineItemRepository_ = lineItemRepository

    /** @private @const {ProductVariantService} */
    this.productVariantService_ = productVariantService

    /** @private @const {ProductService} */
    this.productService_ = productService

    /** @private @const {RegionService} */
    this.regionService_ = regionService

    /** @private @const {CartRepository} */
    this.cartRepository_ = cartRepository
  }

  withTransaction(transactionManager) {
    if (!transactionManager) {
      return this
    }

    const cloned = new LineItemService({
      manager: transactionManager,
      lineItemRepository: this.lineItemRepository_,
      productVariantService: this.productVariantService_,
      productService: this.productService_,
      regionService: this.regionService_,
      cartRepository: this.cartRepository_,
    })

    cloned.transactionManager_ = transactionManager

    return cloned
  }

  async list(
    selector,
    config = { skip: 0, take: 50, order: { created_at: "DESC" } }
  ) {
    const liRepo = this.manager_.getCustomRepository(this.lineItemRepository_)
    const query = this.buildQuery_(selector, config)
    return liRepo.find(query)
  }

  /**
   * Retrieves a line item by its id.
   * @param {string} id - the id of the line item to retrieve
   * @return {LineItem} the line item
   */
  async retrieve(id, relations = []) {
    const lineItemRepository = this.manager_.getCustomRepository(
      this.lineItemRepository_
    )

    const validatedId = this.validateId_(id)

    const lineItem = await lineItemRepository.findOne({
      where: {
        id: validatedId,
      },
      relations,
    })

    if (!lineItem) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Line item with ${id} was not found`
      )
    }

    return lineItem
  }

  async generate(variantId, regionId, quantity, metadata = {}) {
    const variant = await this.productVariantService_.retrieve(variantId, [
      "product",
    ])

    const region = await this.regionService_.retrieve(regionId)

    const price = await this.productVariantService_.getRegionPrice(
      variant.id,
      region.id
    )

    const toCreate = {
      unit_price: price,
      title: variant.product.title,
      description: variant.title,
      thumbnail: variant.product.thumbnail,
      variant_id: variant.id,
      quantity: quantity || 1,
      is_giftcard: variant.product.is_giftcard,
      metadata,
    }

    return toCreate
  }

  /**
   * Create a line item
   * @param {LineItem} lineItem - the line item object to create
   * @return {LineItem} the created line item
   */
  async create(lineItem) {
    return this.atomicPhase_(async manager => {
      const lineItemRepository = manager.getCustomRepository(
        this.lineItemRepository_
      )

      const created = await lineItemRepository.create(lineItem)
      const result = await lineItemRepository.save(created)
      return result
    })
  }

  /**
   * Updates a line item
   * @param {string} id - the id of the line item to update
   * @param {object} update - the properties to update on line item
   * @return {LineItem} the update line item
   */
  async update(id, update) {
    return this.atomicPhase_(async manager => {
      const lineItemRepository = manager.getCustomRepository(
        this.lineItemRepository_
      )

      const lineItem = await this.retrieve(id)

      const { metadata, ...rest } = update

      if (metadata) {
        lineItem.metadata = this.setMetadata_(lineItem, metadata)
      }

      for (const [key, value] of Object.entries(rest)) {
        lineItem[key] = value
      }

      const result = await lineItemRepository.save(lineItem)
      return result
    })
  }

  /**
   * Deletes a line item.
   * @param {string} id - the id of the line item to delete
   * @return {Promise} the result of the delete operation
   */
  async delete(id) {
    return this.atomicPhase_(async manager => {
      const lineItemRepository = manager.getCustomRepository(
        this.lineItemRepository_
      )

      const lineItem = await lineItemRepository.findOne({ where: { id } })

      if (!lineItem) return Promise.resolve()

      await lineItemRepository.remove(lineItem)

      return Promise.resolve()
    })
  }
}

export default LineItemService
