import _ from "lodash"
import { BaseService } from "medusa-interfaces"
import { MedusaError } from "medusa-core-utils"

/**
 * Handles Returns
 * @implements BaseService
 */
class ReturnService extends BaseService {
  constructor({
    totalsService,
    shippingOptionService,
    fulfillmentProviderService,
  }) {
    super()

    /** @private @const {TotalsService} */
    this.totalsService_ = totalsService

    this.shippingOptionService_ = shippingOptionService

    this.fulfillmentProviderService_ = fulfillmentProviderService
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
        const item = order.items.find(i => i._id.equals(item_id))
        return transformer(item, quantity)
      })
    )

    return toReturn.filter(i => !!i)
  }

  /**
   * Checks that an order has the statuses necessary to complete a return.
   * fulfillment_status cannot be not_fulfilled or returned.
   * payment_status must be captured.
   * @param {Order} order - the order to check statuses on
   * @throws when statuses are not sufficient for returns.
   */
  validateReturnStatuses_(order) {
    if (
      order.fulfillment_status === "not_fulfilled" ||
      order.fulfillment_status === "returned"
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Can't return an unfulfilled or already returned order"
      )
    }

    if (order.payment_status !== "captured") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Can't return an order with payment unprocessed"
      )
    }
  }

  /**
   * Checks that a given quantity of a line item can be returned. Fails if the
   * item is undefined or if the returnable quantity of the item is lower, than
   * the quantity that is requested to be returned.
   * @param {LineItem?} item - the line item to check has sufficient returnable
   *   quantity.
   * @param {number} quantity - the quantity that is requested to be returned.
   * @return {LineItem} a line item where the quantity is set to the requested
   *   return quantity.
   */
  validateReturnLineItem_(item, quantity) {
    if (!item) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Return contains invalid line item"
      )
    }

    const returnable = item.quantity - item.returned_quantity
    if (quantity > returnable) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Cannot return more items than have been purchased"
      )
    }

    return {
      ...item,
      quantity,
    }
  }

  /**
   * Creates a return request for an order, with given items, and a shipping
   * method. If no refundAmount is provided the refund amount is calculated from
   * the return lines and the shipping cost.
   * @param {String} orderId - the id of the order to create a return for.
   * @param {Array<{item_id: String, quantity: Int}>} items - the line items to
   *   return
   * @param {ShippingMethod?} shippingMethod - the shipping method used for the
   *   return
   * @param {Number?} refundAmount - the amount to refund when the return is
   *   received.
   * @returns {Promise<Order>} the resulting order.
   */
  async requestReturn(order, items, shippingMethod, refundAmount) {
    // Throws if the order doesn't have the necessary status for return
    this.validateReturnStatuses_(order)

    const returnLines = await this.getFulfillmentItems_(
      order,
      items,
      this.validateReturnLineItem_
    )

    let toRefund = refundAmount
    if (typeof refundAmount !== "undefined") {
      const total = await this.totalsService_.getTotal(order)
      const refunded = await this.totalsService_.getRefundedTotal(order)
      const refundable = total - refunded
      if (refundAmount > refundable) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Cannot refund more than the original payment"
        )
      }
    } else {
      toRefund = await this.totalsService_.getRefundTotal(order, returnLines)
    }

    let fulfillmentData = {}
    let shipping_method = {}
    if (typeof shippingMethod !== "undefined") {
      shipping_method = await this.shippingOptionService_.retrieve(
        shippingMethod.id
      )
      const provider = await this.fulfillmentProviderService_.retrieveProvider(
        shipping_method.provider_id
      )
      fulfillmentData = await provider.createReturn(
        shipping_method.data,
        returnLines,
        order
      )

      if (typeof shippingMethod.price !== "undefined") {
        shipping_method.price = shippingMethod.price
      } else {
        shipping_method.price = await this.shippingOptionService_.getPrice(
          shipping_method,
          {
            ...order,
            items: returnLines,
          }
        )
      }

      toRefund = Math.max(
        0,
        toRefund - shipping_method.price * (1 + order.tax_rate)
      )
    }

    return {
      shipping_method,
      refund_amount: toRefund,
      items: returnLines.map(i => ({
        item_id: i._id,
        content: i.content,
        quantity: i.quantity,
        is_requested: true,
        metadata: i.metadata,
      })),
      shipping_data: fulfillmentData,
    }

    //return this.orderModel_
    //  .updateOne(
    //    {
    //      _id: order._id,
    //    },
    //    {
    //      $push: {
    //        returns: newReturn,
    //      },
    //    }
    //  )
    //  .then(result => {
    //    this.eventBus_.emit(OrderService.Events.RETURN_REQUESTED, {
    //      order: result,
    //      return: newReturn,
    //    })
    //    return result
    //  })
  }

  /**
   * Registers a previously requested return as received. This will create a
   * refund to the customer. If the returned items don't match the requested
   * items the return status will be updated to requires_action. This behaviour
   * is useful in sitautions where a custom refund amount is requested, but the
   * retuned items are not matching the requested items. Setting the
   * allowMismatch argument to true, will process the return, ignoring any
   * mismatches.
   * @param {string} orderId - the order to return.
   * @param {string[]} lineItems - the line items to return
   * @return {Promise} the result of the update operation
   */
  async receiveReturn(
    order,
    returnRequest,
    items,
    refundAmount,
    allowMismatch = false
  ) {
    if (returnRequest.status === "received") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Return with id ${returnId} has already been received`
      )
    }

    const returnLines = await this.getFulfillmentItems_(
      order,
      items,
      this.validateReturnLineItem_
    )

    const newLines = returnLines.map(l => {
      const existing = returnRequest.items.find(i => l._id.equals(i.item_id))
      if (existing) {
        return {
          ...existing,
          quantity: l.quantity,
          requested_quantity: existing.quantity,
          is_requested: l.quantity === existing.quantity,
          is_registered: true,
        }
      } else {
        return {
          item_id: l._id,
          content: l.content,
          quantity: l.quantity,
          is_requested: false,
          is_registered: true,
          metadata: l.metadata,
        }
      }
    })

    const isMatching = newLines.every(l => l.is_requested)
    if (!isMatching && !allowMismatch) {
      // Should update status
      return {
        ...returnRequest,
        status: "requires_action",
        items: newLines,
      }
    }

    const toRefund = refundAmount || returnRequest.refund_amount
    const total = await this.totalsService_.getTotal(order)
    const refunded = await this.totalsService_.getRefundedTotal(order)

    if (toRefund > total - refunded) {
      return {
        ...returnRequest,
        status: "requires_action",
        items: newLines,
      }
    }

    return {
      ...returnRequest,
      status: "received",
      items: newLines,
      refund_amount: toRefund,
    }
  }
}

export default ReturnService
