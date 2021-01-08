import _ from "lodash"
import { BaseService } from "medusa-interfaces"
import { MedusaError } from "medusa-core-utils"

/**
 * Handles Fulfillments
 * @implements BaseService
 */
class FulfillmentService extends BaseService {
  constructor({
    manager,
    totalsService,
    fulfillmentRepository,
    shippingProfileService,
    lineItemService,
    fulfillmentProviderService,
  }) {
    super()

    /** @private @const {EntityManager} */
    this.manager_ = manager

    /** @private @const {TotalsService} */
    this.totalsService_ = totalsService

    /** @private @const {FulfillmentRepository} */
    this.fulfillmentRepository_ = fulfillmentRepository

    /** @private @const {ShippingProfileService} */
    this.shippingProfileService_ = shippingProfileService

    /** @private @const {LineItemService} */
    this.lineItemService_ = lineItemService

    /** @private @const {FulfillmentProviderService} */
    this.fulfillmentProviderService_ = fulfillmentProviderService
  }

  withTransaction(transactionManager) {
    if (!transactionManager) {
      return this
    }

    const cloned = new FulfillmentService({
      manager: transactionManager,
      totalsService: this.totalsService_,
      fulfillmentRepository: this.fulfillmentRepository_,
      shippingProfileService: this.shippingProfileService_,
      lineItemService: this.lineItemService_,
      fulfillmentProviderService: this.fulfillmentProviderService_,
    })

    cloned.transactionManager_ = transactionManager

    return cloned
  }

  partitionItems_(shippingMethods, items) {
    let partitioned = []
    // partition order items to their dedicated shipping method
    await Promise.all(
      shippingMethods.map(async method => {
        const temp = { shipping_method: method }

        // for each method find the items in the order, that are associated
        // with the profile on the current shipping method
        if (shippingMethods.length === 1) {
          temp.items = items
        } else {
          const methodProfile = method.shipping_option.profile_id

          temp.items = items.filter(({ variant }) => {
            variant.product.profile_id === methodProfile
          })
        }
        partitioned.push(temp)
      })
    )
    return partitioned
  }

  /**
   * Retrieves the order line items, given an array of items.
   * @param {Order} order - the order to get line items from
   * @param {{ item_id: string, quantity: number }} items - the items to get
   * @param {function} transformer - a function to apply to each of the items
   *    retrieved from the order, should return a line item. If the transformer
   *    returns an undefined value the line item will be filtered from the
   *    returned array.
   * @return {Promise<Array<LineItem>>} the line items generated by the transformer.
   */
  async getFulfillmentItems_(order, items, transformer) {
    const toReturn = await Promise.all(
      items.map(async ({ item_id, quantity }) => {
        const item = order.items.find(i => i.id === item_id)
        return transformer(item, quantity)
      })
    )

    return toReturn.filter(i => !!i)
  }

  /**
   * Checks that a given quantity of a line item can be fulfilled. Fails if the
   * fulfillable quantity is lower than the requested fulfillment quantity.
   * Fulfillable quantity is calculated by subtracting the already fulfilled
   * quantity from the quantity that was originally purchased.
   * @param {LineItem} item - the line item to check has sufficient fulfillable
   *   quantity.
   * @param {number} quantity - the quantity that is requested to be fulfilled.
   * @return {LineItem} a line item that has the requested fulfillment quantity
   *   set.
   */
  validateFulfillmentLineItem_(item, quantity) {
    if (!item) {
      // This will in most cases be called by a webhook so to ensure that
      // things go through smoothly in instances where extra items outside
      // of Medusa are added we allow unknown items
      return null
    }

    if (quantity > item.quantity - item.fulfilled_quantity) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Cannot fulfill more items than have been purchased"
      )
    }
    return {
      ...item,
      quantity,
    }
  }

  /**
   * Retrieves a fulfillment by its id.
   * @param {string} id - the id of the fulfillment to retrieve
   * @return {Fulfillment} the fulfillment
   */
  async retrieve(id, relations = []) {
    const fulfillmentRepository = this.manager_.getCustomRepository(
      this.fulfillmentRepository_
    )

    const validatedId = this.validateId_(id)

    const fulfillment = await fulfillmentRepository.findOne({
      where: {
        id: validatedId,
      },
      relations,
    })

    if (!fulfillment) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Fulfillment with id: ${id} was not found`
      )
    }
    return fulfillment
  }

  /**
   * Creates an order fulfillment
   * If items needs to be fulfilled by different provider, we make
   * sure to partition those items, and create fulfillment for
   * those partitions.
   * @param {Order} order - order to create fulfillment for
   * @param {{ item_id: string, quantity: number}[]} itemsToFulfill - the items in the order to fulfill
   * @param {object} metadata - potential metadata to add
   * @return {Fulfillment[]} the created fulfillments
   */
  async createFulfillment(order, itemsToFulfill, metadata = {}) {
    return this.atomicPhase_(async manager => {
      const fulfillmentRepository = manager.getCustomRepository(
        this.fulfillmentRepository_
      )

      const lineItems = await this.getFulfillmentItems_(
        order,
        itemsToFulfill,
        this.validateFulfillmentLineItem_
      )

      const { shipping_methods } = order

      // partition order items to their dedicated shipping method
      const fulfillments = await this.partitionItems_(
        shipping_methods,
        lineItems
      )

      const created = await Promise.all(
        fulfillments.map(async ({ shipping_method, items }) => {
          const data = await this.fulfillmentProviderService_.createFulfillment(
            shipping_method,
            items,
            {
              ...order,
            }
          )

          return fulfillmentRepository.create({
            provider: shipping_method.provider_id,
            items,
            data,
            metadata,
          })
        })
      )

      return created
    })
  }

  cancelFulfillment(fulfillmentId) {
    return this.atomicPhase_(async manager => {
      const fulfillment = await this.retrieve(fulfillmentId)

      await this.fulfillmentProviderService_.cancelFulfillment(fulfillment)

      fulfillment.status = "canceled"

      const fulfillmentRepo = manager.getCustomRepository(
        this.fulfillmentRepository_
      )
      const result = await fulfillmentRepo.save(fulfillment)
      return result
    })
  }

  /**
   * Creates a shipment by marking a fulfillment as shipped. Adds
   * tracking numbers and potentially more metadata.
   * @param {Order} fulfillmentId - the fulfillment to ship
   * @param {string[]} trackingNumbers - tracking numbers for the shipment
   * @param {object} metadata - potential metadata to add
   * @return {Fulfillment} the shipped fulfillment
   */
  async createShipment(fulfillmentId, trackingNumbers, metadata) {
    return this.atomicPhase_(async manager => {
      const fulfillmentRepository = manager.getCustomRepository(
        this.fulfillmentRepository_
      )

      const fulfillment = await this.retrieve(fulfillmentId, ["items"])

      fulfillment.shipped_at = Date.now()
      fulfillment.tracking_numbers = trackingNumbers
      fulfillment.metadata = {
        ...fulfillment.metadata,
        ...metadata,
      }

      const updated = fulfillmentRepository.save(fulfillment)
      return updated
    })
  }
}

export default FulfillmentService
