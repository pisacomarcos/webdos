import { SamlTokenUserAccountAuthMutationVariables } from "@linear/sdk/dist/_generated_documents"
import { IsNotEmpty, IsString } from "class-validator"
import { MedusaError } from "medusa-core-utils"
import { EntityManager } from "typeorm"
import { Order } from "../../../../models"
import {
  CustomerService,
  EventBusService,
  OrderService,
} from "../../../../services"
import TokenService from "../../../../services/token"

/**
 * @oas [post] /customers/claim-orders
 * operationId: "PostCustomersCustomerOrderClaim"
 * summary: "Claim orders for signed in account"
 * description: "Sends an email to emails registered to orders provided with link to transfer order ownership"
 * requestBody:
 *   content:
 *     application/json:
 *       schema:
 *         required:
 *           - order_ids
 *         properties:
 *           order_ids:
 *             description: "The ids of the orders to claim"
 *             type: array
 *             items:
 *              type: string
 * x-codeSamples:
 *   - lang: JavaScript
 *     label: JS Client
 *     source: |
 *       import Medusa from "@medusajs/medusa-js"
 *       const medusa = new Medusa({ baseUrl: MEDUSA_BACKEND_URL, maxRetries: 3 })
 *       // must be previously logged in or use api token
 *       medusa.customers.claimOrders({
 *         order_ids,
 *       })
 *       .then(() => {
 *         // successful
 *       })
 *       .catch(() => {
 *         // an error occurred
 *       });
 *   - lang: Shell
 *     label: cURL
 *     source: |
 *       curl --location --request POST 'https://medusa-url.com/store/customers/claim-orders' \
 *       --header 'Content-Type: application/json' \
 *       --data-raw '{
 *           "order_ids": ["id"],
 *       }'
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 * tags:
 *   - Invite
 * responses:
 *   200:
 *     description: OK
 *   "400":
 *     $ref: "#/components/responses/400_error"
 *   "401":
 *     $ref: "#/components/responses/unauthorized"
 *   "404":
 *     $ref: "#/components/responses/not_found_error"
 *   "409":
 *     $ref: "#/components/responses/invalid_state_error"
 *   "422":
 *     $ref: "#/components/responses/invalid_request_error"
 *   "500":
 *     $ref: "#/components/responses/500_error"
 */
export default async (req, res) => {
  const { display_ids } = req.validatedBody

  const eventBusService: EventBusService = req.scope.resolve("eventBusService")
  const orderService: OrderService = req.scope.resolve("orderService")
  const customerService: CustomerService = req.scope.resolve("customerService")
  const tokenService: TokenService = req.scope.resolve(
    TokenService.RESOLUTION_KEY
  )

  const customerId: string = req.user?.customer_id
  const customer = await customerService.retrieve(customerId)

  if (!customer.has_account) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Customer does not have an account"
    )
  }

  const orders = await orderService.list(
    { display_id: display_ids },
    { select: ["id", "email"] }
  )

  const emailOrderMapping: { [email: string]: string[] } = orders.reduce(
    (acc, order) => {
      acc[order.email] = [...(acc[order.email] || []), order.id]
      return acc
    },
    {}
  )

  await Promise.all(
    Object.entries(emailOrderMapping).map(async ([email, order_ids]) => {
      const token = tokenService.signToken(
        {
          claimingCustomerId: customerId,
          orders: order_ids,
        },
        { expiresIn: "1h" }
      )

      await eventBusService.emit(OrderService.Events.ORDERS_CLAIMED, {
        old_email: email,
        new_customer_id: customer.id,
        orders: order_ids,
        token,
      })
    })
  )

  res.sendStatus(200)
}

export class StorePostCustomersCustomerOrderClaimReq {
  @IsNotEmpty({ each: true })
  @IsString({ each: true })
  display_ids: string[]
}
