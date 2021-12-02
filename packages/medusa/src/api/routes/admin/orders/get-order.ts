import { defaultAdminOrdersRelations, defaultAdminOrdersFields } from "."
import { OrderService, ServiceIdentifiers } from "../../../../services"

/**
 * @oas [get] /orders/{id}
 * operationId: "GetOrdersOrder"
 * summary: "Retrieve an Order"
 * description: "Retrieves an Order"
 * x-authenticated: true
 * parameters:
 *   - (path) id=* {string} The id of the Order.
 * tags:
 *   - Order
 * responses:
 *   200:
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           properties:
 *             order:
 *               $ref: "#/components/schemas/order"
 */
export default async (req, res) => {
  const { id } = req.params

  const orderService: OrderService = req.scope.resolve(
    ServiceIdentifiers.orderService
  )

  const order = await orderService.retrieve(id, {
    select: defaultAdminOrdersFields,
    relations: defaultAdminOrdersRelations,
  })

  res.json({ order })
}
