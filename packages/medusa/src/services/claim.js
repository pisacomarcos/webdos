import _ from "lodash"
import { Validator, MedusaError } from "medusa-core-utils"
import { BaseService } from "medusa-interfaces"
import { Brackets } from "typeorm"

class ClaimService extends BaseService {
  static Events = {
    CREATED: "claim.created",
    UPDATED: "claim.updated",
    CANCELED: "claim.canceled",
    FULFILLMENT_CREATED: "claim.fulfillment_created",
  }

  constructor({
    manager,
    claimRepository,
    fulfillmentProviderService,
    fulfillmentService,
    lineItemService,
    returnService,
    shippingOptionService,
    claimItemService,
    regionService,
    eventBusService,
  }) {
    super()

    /** @private @constant {EntityManager} */
    this.manager_ = manager

    /** @private @constant {ClaimRepository} */
    this.claimRepository_ = claimRepository

    /** @private @constant {FulfillmentProviderService} */
    this.fulfillmentProviderService_ = fulfillmentProviderService

    /** @private @constant {LineItemService} */
    this.lineItemService_ = lineItemService

    /** @private @constant {RegionService} */
    this.regionService_ = regionService

    /** @private @constant {ReturnService} */
    this.returnService_ = returnService

    /** @private @constant {FulfillmentService} */
    this.fulfillmentService_ = fulfillmentService

    /** @private @constant {ClaimItemService} */
    this.claimItemService_ = claimItemService

    /** @private @constant {EventBus} */
    this.eventBus_ = eventBusService

    /** @private @constant {ShippingOptionService} */
    this.shippingOptionService_ = shippingOptionService
  }

  withTransaction(manager) {
    if (!manager) {
      return this
    }

    const cloned = new ClaimService({
      manager,
      claimRepository: this.claimRepository_,
      fulfillmentProviderService: this.fulfillmentProviderService_,
      fulfillmentService: this.fulfillmentService_,
      lineItemService: this.lineItemService_,
      regionService: this.regionService_,
      returnService: this.returnService_,
      claimItemService: this.claimItemService_,
      eventBusService: this.eventBus_,
      shippingOptionService: this.shippingOptionService_,
    })

    cloned.transactionManager_ = manager

    return cloned
  }

  update(id, data) {
    return this.atomicPhase_(async manager => {
      const claim = await this.retrieve(id, { relations: ["shipping_methods"] })

      const { shipping_methods } = data

      for (const m of claim.shipping_methods) {
        await this.shippingOptionService_
          .withTransaction(manager)
          .updateShippingMethod(m.id, {
            claim_order_id: null,
          })
      }

      if (shipping_methods) {
        for (const method of shipping_methods) {
          if (method.id) {
            await this.shippingOptionService_
              .withTransaction(manager)
              .updateShippingMethod(method.id, {
                claim_order_id: claim.id,
              })
          } else {
            await this.shippingOptionService_
              .withTransaction(manager)
              .createShippingMethod(method.option_id, method.data, {
                claim_order_id: claim.id,
                price: method.price,
              })
          }
        }
      }

      await this.eventBus_
        .withTransaction(manager)
        .emit(ClaimService.Events.UPDATED, {
          id: claim.id,
        })

      return claim
    })
  }

  create(data) {
    return this.atomicPhase_(async manager => {
      const claimRepo = manager.getCustomRepository(this.claimRepository_)

      const {
        type,
        claim_items,
        order,
        return_shipping,
        additional_items,
        shipping_methods,
        ...rest
      } = data

      if (type !== "refund" && type !== "replace") {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Claim type must be one of "refund" or "replace".`
        )
      }

      if (type === "replace" && !additional_items?.length) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Claims with type "replace" must have at least one additional item.`
        )
      }

      if (!claim_items?.length) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Claims must have at least one claim item.`
        )
      }

      const newItems = await Promise.all(
        additional_items.map(i =>
          this.lineItemService_
            .withTransaction(manager)
            .generate(i.variant_id, order.region_id, i.quantity)
        )
      )

      const created = claimRepo.create({
        shipping_address_id: order.shipping_address_id,
        ...rest,
        type,
        additional_items: newItems,
        order_id: order.id,
      })

      const result = await claimRepo.save(created)

      if (shipping_methods) {
        for (const method of shipping_methods) {
          if (method.id) {
            await this.shippingOptionService_
              .withTransaction(manager)
              .updateShippingMethod(method.id, {
                claim_order_id: result.id,
              })
          } else {
            await this.shippingOptionService_
              .withTransaction(manager)
              .createShippingMethod(method.option_id, method.data, {
                claim_order_id: result.id,
                price: method.price,
              })
          }
        }
      }

      for (const ci of claim_items) {
        await this.claimItemService_.withTransaction(manager).create({
          ...ci,
          claim_order_id: result.id,
        })
      }

      if (return_shipping) {
        await this.returnService_.withTransaction(manager).create(
          {
            claim_order_id: result.id,
            items: claim_items.map(ci => ({
              id: ci.item_id,
              quantity: ci.quantity,
              metadata: ci.metadata,
            })),
            shipping_method: return_shipping,
          },
          order
        )
      }

      await this.eventBus_
        .withTransaction(manager)
        .emit(ClaimService.Events.CREATED, {
          id: result.id,
        })

      return result
    })
  }

  createFulfillment(id, metadata = {}) {
    return this.atomicPhase_(async manager => {
      const claim = await this.retrieve(id, {
        relations: [
          "additional_items",
          "shipping_methods",
          "shipping_address",
          "order",
          "order.billing_address",
          "order.discounts",
          "order.payments",
        ],
      })

      const order = claim.order

      if (claim.fulfillment_status !== "not_fulfilled") {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "The claim has already been fulfilled."
        )
      }

      if (claim.type !== "replace") {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Claims with the type "${claim.type}" can not be fulfilled.`
        )
      }

      if (!claim.shipping_methods?.length) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Cannot fulfill a claim without a shipping method."
        )
      }

      const fulfillments = await this.fulfillmentService_
        .withTransaction(manager)
        .createFulfillment(
          {
            ...claim,
            email: order.email,
            payments: order.payments,
            discounts: order.discounts,
            currency_code: order.currency_code,
            tax_rate: order.tax_rate,
            region_id: order.region_id,
            display_id: order.display_id,
            billing_address: order.billing_address,
            items: claim.additional_items,
            shipping_methods: claim.shipping_methods,
            is_claim: true,
          },
          claim.additional_items.map(i => ({
            item_id: i.id,
            quantity: i.quantity,
          })),
          { claim_order_id: id, metadata }
        )

      let successfullyFulfilled = []
      for (const f of fulfillments) {
        successfullyFulfilled = successfullyFulfilled.concat(f.items)
      }

      claim.fulfillment_status = "fulfilled"

      for (const item of claim.additional_items) {
        const fulfillmentItem = successfullyFulfilled.find(
          f => item.id === f.item_id
        )

        if (fulfillmentItem) {
          const fulfilledQuantity =
            (item.fulfilled_quantity || 0) + fulfillmentItem.quantity

          // Update the fulfilled quantity
          await this.lineItemService_.withTransaction(manager).update(item.id, {
            fulfilled_quantity: fulfilledQuantity,
          })

          if (item.quantity !== fulfilledQuantity) {
            claim.fulfillment_status = "requires_action"
          }
        } else {
          if (item.quantity !== item.fulfilled_quantity) {
            claim.fulfillment_status = "requires_action"
          }
        }
      }

      const claimRepo = manager.getCustomRepository(this.claimRepository_)
      const result = await claimRepo.save(claim)

      for (const fulfillment of fulfillments) {
        await this.eventBus_
          .withTransaction(manager)
          .emit(ClaimService.Events.FULFILLMENT_CREATED, {
            id: id,
            fulfillment_id: fulfillment.id,
          })
      }

      return result
    })
  }

  async createShipment(id, fulfillmentId, trackingNumbers, metadata = []) {
    return this.atomicPhase_(async manager => {
      const claim = await this.retrieve(id, {
        relations: ["additional_items"],
      })

      const shipment = await this.fulfillmentService_
        .withTransaction(manager)
        .createShipment(fulfillmentId, trackingNumbers, metadata)

      claim.fulfillment_status = "shipped"

      for (const i of claim.additional_items) {
        const shipped = shipment.items.find(si => si.item_id === i.id)
        if (shipped) {
          const shippedQty = (i.shipped_quantity || 0) + shipped.quantity
          await this.lineItemService_.withTransaction(manager).update(i.id, {
            shipped_quantity: shippedQty,
          })

          if (shippedQty !== i.quantity) {
            claim.fulfillment_status = "partially_shipped"
          }
        } else {
          if (i.shipped_quantity !== i.quantity) {
            claim.fulfillment_status = "partially_shipped"
          }
        }
      }

      const claimRepo = manager.getCustomRepository(this.claimRepository_)
      const result = await claimRepo.save(claim)

      await this.eventBus_
        .withTransaction(manager)
        .emit(ClaimService.Events.SHIPMENT_CREATED, {
          id,
          fulfillment_id: shipment.id,
        })

      return result
    })
  }

  async cancel(id) {
    return this.atomicPhase_(async manager => {
      const claim = await this.retrieve(id, {
        relations: ["return_order", "fulfillments"],
      })

      if (
        claim.fulfillment_status === "shipped" ||
        claim.fulfillment_status === "partially_shipped"
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Cannot cancel a claim that has been shipped.`
        )
      }

      if (claim?.return_order?.status === "received") {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Cannot cancel a claim that has a received return.`
        )
      }

      if (claim.return_order) {
        await this.returnService_
          .withTransaction(manager)
          .cancel(claim.return_order.id)
      }

      await Promise.all(
        claim.fulfillments.map(f =>
          this.fulfillmentService_.withTransaction(manager).cancelFulfillment(f)
        )
      )

      claim.fulfillment_status = "canceled"

      const claimRepo = manager.getCustomRepository(this.claimRepository_)
      const result = claimRepo.save(claim)

      await this.eventBus_
        .withTransaction(manager)
        .emit(ClaimService.Events.CANCELED, {
          id: result.id,
        })

      return result
    })
  }

  /**
   * @param {Object} selector - the query object for find
   * @return {Promise} the result of the find operation
   */
  async list(
    selector,
    config = { skip: 0, take: 50, order: { created_at: "DESC" } }
  ) {
    const claimRepo = this.manager_.getCustomRepository(this.claimRepository_)
    const query = this.buildQuery_(selector, config)
    return claimRepo.find(query)
  }

  /**
   * Gets an order by id.
   * @param {string} orderId - id of order to retrieve
   * @return {Promise<Order>} the order document
   */
  async retrieve(claimId, config = {}) {
    const claimRepo = this.manager_.getCustomRepository(this.claimRepository_)
    const validatedId = this.validateId_(claimId)

    const query = this.buildQuery_({ id: validatedId }, config)
    const claim = await claimRepo.findOne(query)

    if (!claim) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Claim with ${claimId} was not found`
      )
    }

    return claim
  }

  /**
   * Dedicated method to set metadata for an order.
   * To ensure that plugins does not overwrite each
   * others metadata fields, setMetadata is provided.
   * @param {string} orderId - the order to decorate.
   * @param {string} key - key for metadata field
   * @param {string} value - value for metadata field.
   * @return {Promise} resolves to the updated result.
   */
  setMetadata_(order, metadata) {
    const existing = order.metadata || {}
    const newData = {}
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof key !== "string") {
        throw new MedusaError(
          MedusaError.Types.INVALID_ARGUMENT,
          "Key type is invalid. Metadata keys must be strings"
        )
      }

      newData[key] = value
    }

    const updated = {
      ...existing,
      ...newData,
    }

    return updated
  }

  /**
   * Dedicated method to delete metadata for an order.
   * @param {string} orderId - the order to delete metadata from.
   * @param {string} key - key for metadata field
   * @return {Promise} resolves to the updated result.
   */
  async deleteMetadata(orderId, key) {
    const validatedId = this.validateId_(orderId)

    if (typeof key !== "string") {
      throw new MedusaError(
        MedusaError.Types.INVALID_ARGUMENT,
        "Key type is invalid. Metadata keys must be strings"
      )
    }

    const keyPath = `metadata.${key}`
    return this.orderModel_
      .updateOne({ _id: validatedId }, { $unset: { [keyPath]: "" } })
      .catch(err => {
        throw new MedusaError(MedusaError.Types.DB_ERROR, err.message)
      })
  }
}

export default ClaimService
