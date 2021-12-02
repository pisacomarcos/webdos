import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator"
import { defaultAdminOrdersFields, defaultAdminOrdersRelations } from "."
import {
  ClaimService,
  OrderService,
  ServiceIdentifiers,
} from "../../../../services"
import { validator } from "../../../../utils/validator"

/**
 * @oas [post] /orders/{id}/claims/{claim_id}/shipments
 * operationId: "PostOrdersOrderClaimsClaimShipments"
 * summary: "Create Claim Shipment"
 * description: "Registers a Claim Fulfillment as shipped."
 * x-authenticated: true
 * parameters:
 *   - (path) id=* {string} The id of the Order.
 *   - (path) claim_id=* {string} The id of the Claim.
 * requestBody:
 *   content:
 *     application/json:
 *       schema:
 *         required:
 *           - fulfillment_id
 *         properties:
 *           fulfillment_id:
 *             description: The id of the Fulfillment.
 *             type: string
 *           tracking_numbers:
 *             description: The tracking numbers for the shipment.
 *             type: array
 *             items:
 *               type: string
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
  const { id, claim_id } = req.params

  const validated = await validator(
    AdminPostOrdersOrderClaimsClaimShipmentsReq,
    req.body
  )

  const orderService: OrderService = req.scope.resolve(
    ServiceIdentifiers.orderService
  )
  const claimService: ClaimService = req.scope.resolve(
    ServiceIdentifiers.claimService
  )

  await claimService.createShipment(
    claim_id,
    validated.fulfillment_id,
    validated.tracking_numbers?.map((n) => ({ tracking_number: n }))
  )

  const order = await orderService.retrieve(id, {
    select: defaultAdminOrdersFields,
    relations: defaultAdminOrdersRelations,
  })

  res.json({ order })
}

export class AdminPostOrdersOrderClaimsClaimShipmentsReq {
  @IsString()
  @IsNotEmpty()
  fulfillment_id: string

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tracking_numbers?: string[]
}
