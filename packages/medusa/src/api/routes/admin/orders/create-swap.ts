import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator"
import {
  IdempotencyKeyService,
  OrderService,
  ReturnService,
  SwapService,
} from "../../../../services"

import { Type } from "class-transformer"
import { MedusaError } from "medusa-core-utils"
import { EntityManager } from "typeorm"
import { FindParams } from "../../../../types/common"
import { cleanResponseData } from "../../../../utils/clean-response-data"

/**
 * @oas [post] /admin/orders/{id}/swaps
 * operationId: "PostOrdersOrderSwaps"
 * summary: "Create a Swap"
 * description: "Create a Swap. This includes creating a return that is associated with the swap."
 * x-authenticated: true
 * externalDocs:
 *   description: How are swaps created
 *   url: https://docs.medusajs.com/modules/orders/swaps#how-are-swaps-created
 * parameters:
 *   - (path) id=* {string} The ID of the Order.
 *   - (query) expand {string} Comma-separated relations that should be expanded in the returned order.
 *   - (query) fields {string} Comma-separated fields that should be included in the returned order.
 * requestBody:
 *   content:
 *     application/json:
 *       schema:
 *         $ref: "#/components/schemas/AdminPostOrdersOrderSwapsReq"
 * x-codegen:
 *   method: createSwap
 *   queryParams: AdminPostOrdersOrderSwapsParams
 * x-codeSamples:
 *   - lang: JavaScript
 *     label: JS Client
 *     source: |
 *       import Medusa from "@medusajs/medusa-js"
 *       const medusa = new Medusa({ baseUrl: MEDUSA_BACKEND_URL, maxRetries: 3 })
 *       // must be previously logged in or use api token
 *       medusa.admin.orders.createSwap(orderId, {
 *         return_items: [
 *           {
 *             item_id,
 *             quantity: 1
 *           }
 *         ]
 *       })
 *       .then(({ order }) => {
 *         console.log(order.id);
 *       })
 *   - lang: tsx
 *     label: Medusa React
 *     source: |
 *       import React from "react"
 *       import { useAdminCreateSwap } from "medusa-react"
 *
 *       type Props = {
 *         orderId: string
 *       }
 *
 *       const CreateSwap = ({ orderId }: Props) => {
 *         const createSwap = useAdminCreateSwap(orderId)
 *         // ...
 *
 *         const handleCreate = (
 *           returnItems: {
 *             item_id: string,
 *             quantity: number
 *           }[]
 *         ) => {
 *           createSwap.mutate({
 *             return_items: returnItems
 *           }, {
 *             onSuccess: ({ order }) => {
 *               console.log(order.swaps)
 *             }
 *           })
 *         }
 *
 *         // ...
 *       }
 *
 *       export default CreateSwap
 *   - lang: Shell
 *     label: cURL
 *     source: |
 *       curl -X POST '{backend_url}/admin/orders/{id}/swaps' \
 *       -H 'x-medusa-access-token: {api_token}' \
 *       -H 'Content-Type: application/json' \
 *       --data-raw '{
 *           "return_items": [
 *             {
 *               "item_id": "asfasf",
 *               "quantity": 1
 *             }
 *           ]
 *       }'
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 *   - jwt_token: []
 * tags:
 *   - Orders
 * responses:
 *   200:
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           $ref: "#/components/schemas/AdminOrdersRes"
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
  const { id } = req.params

  const validated = req.validatedBody

  const idempotencyKeyService: IdempotencyKeyService = req.scope.resolve(
    "idempotencyKeyService"
  )
  const orderService: OrderService = req.scope.resolve("orderService")
  const swapService: SwapService = req.scope.resolve("swapService")
  const returnService: ReturnService = req.scope.resolve("returnService")
  const manager: EntityManager = req.scope.resolve("manager")

  const headerKey = req.get("Idempotency-Key") || ""

  let idempotencyKey
  try {
    await manager.transaction(async (transactionManager) => {
      idempotencyKey = await idempotencyKeyService
        .withTransaction(transactionManager)
        .initializeRequest(headerKey, req.method, req.params, req.path)
    })
  } catch (error) {
    res.status(409).send("Failed to create idempotency key")
    return
  }

  res.setHeader("Access-Control-Expose-Headers", "Idempotency-Key")
  res.setHeader("Idempotency-Key", idempotencyKey.idempotency_key)

  let inProgress = true
  let err: unknown = false

  while (inProgress) {
    switch (idempotencyKey.recovery_point) {
      case "started": {
        await manager
          .transaction("SERIALIZABLE", async (transactionManager) => {
            idempotencyKey = await idempotencyKeyService
              .withTransaction(transactionManager)
              .workStage(idempotencyKey.idempotency_key, async (manager) => {
                const order = await orderService
                  .withTransaction(manager)
                  .retrieveWithTotals(id, {
                    relations: [
                      "cart",
                      "items",
                      "items.variant",
                      "items.tax_lines",
                      "swaps",
                      "swaps.additional_items",
                      "swaps.additional_items.variant",
                      "swaps.additional_items.tax_lines",
                    ],
                  })

                const swap = await swapService
                  .withTransaction(manager)
                  .create(
                    order,
                    validated.return_items,
                    validated.additional_items,
                    validated.return_shipping,
                    {
                      idempotency_key: idempotencyKey.idempotency_key,
                      no_notification: validated.no_notification,
                      allow_backorder: validated.allow_backorder,
                      location_id: validated.return_location_id,
                    }
                  )

                await swapService
                  .withTransaction(manager)
                  .createCart(swap.id, validated.custom_shipping_options, {
                    sales_channel_id: validated.sales_channel_id,
                  })

                const returnOrder = await returnService
                  .withTransaction(manager)
                  .retrieveBySwap(swap.id)

                await returnService
                  .withTransaction(manager)
                  .fulfill(returnOrder.id)

                return {
                  recovery_point: "swap_created",
                }
              })
          })
          .catch((e) => {
            inProgress = false
            err = e
          })
        break
      }

      case "swap_created": {
        await manager
          .transaction("SERIALIZABLE", async (transactionManager) => {
            idempotencyKey = await idempotencyKeyService
              .withTransaction(transactionManager)
              .workStage(idempotencyKey.idempotency_key, async (manager) => {
                const swaps = await swapService
                  .withTransaction(transactionManager)
                  .list({
                    idempotency_key: idempotencyKey.idempotency_key,
                  })

                if (!swaps.length) {
                  throw new MedusaError(
                    MedusaError.Types.INVALID_DATA,
                    "Swap not found"
                  )
                }

                const order = await orderService
                  .withTransaction(transactionManager)
                  .retrieveWithTotals(id, req.retrieveConfig, {
                    includes: req.includes,
                  })

                return {
                  response_code: 200,
                  response_body: {
                    order: cleanResponseData(order, []),
                  },
                }
              })
          })
          .catch((e) => {
            inProgress = false
            err = e
          })
        break
      }

      case "finished": {
        inProgress = false
        break
      }

      default:
        await manager.transaction(async (transactionManager) => {
          idempotencyKey = await idempotencyKeyService
            .withTransaction(transactionManager)
            .update(idempotencyKey.idempotency_key, {
              recovery_point: "finished",
              response_code: 500,
              response_body: { message: "Unknown recovery point" },
            })
        })
        break
    }
  }

  if (err) {
    throw err
  }

  res.status(idempotencyKey.response_code).json(idempotencyKey.response_body)
}

class ReturnItem {
  @IsString()
  @IsNotEmpty()
  item_id: string

  @IsNumber()
  @IsNotEmpty()
  @Min(1)
  quantity: number

  @IsOptional()
  @IsString()
  reason_id?: string

  @IsOptional()
  @IsString()
  note?: string
}

/**
 * The return's shipping method details.
 */
class ReturnShipping {
  /**
   * The ID of the shipping option used for the return.
   */
  @IsString()
  @IsNotEmpty()
  option_id: string

  /**
   * The shipping method's price.
   */
  @IsInt()
  @IsOptional()
  price?: number
}

class CustomShippingOption {
  @IsString()
  @IsNotEmpty()
  option_id: string

  @IsInt()
  @IsNotEmpty()
  price: number
}

class AdditionalItem {
  @IsString()
  @IsNotEmpty()
  variant_id: string

  @IsNumber()
  @IsNotEmpty()
  quantity: number
}

/**
 * @schema AdminPostOrdersOrderSwapsReq
 * type: object
 * description: "The details of the swap to create."
 * required:
 *   - return_items
 * properties:
 *   return_items:
 *     description: The Line Items to associate with the swap's return.
 *     type: array
 *     items:
 *       type: object
 *       required:
 *         - item_id
 *         - quantity
 *       properties:
 *         item_id:
 *           description: The ID of the Line Item that will be returned.
 *           type: string
 *         quantity:
 *           description: The number of items that will be returned
 *           type: integer
 *         reason_id:
 *           description: The ID of the Return Reason to use.
 *           type: string
 *         note:
 *           description: An optional note with information about the Return.
 *           type: string
 *   return_shipping:
 *     description: The shipping method associated with the swap's return.
 *     type: object
 *     required:
 *       - option_id
 *     properties:
 *       option_id:
 *         type: string
 *         description: The ID of the Shipping Option to create the Shipping Method from.
 *       price:
 *         type: integer
 *         description: The price to charge for the Shipping Method.
 *   additional_items:
 *     description: The new items to send to the Customer.
 *     type: array
 *     items:
 *       type: object
 *       required:
 *         - variant_id
 *         - quantity
 *       properties:
 *         variant_id:
 *           description: The ID of the Product Variant.
 *           type: string
 *         quantity:
 *           description: The quantity of the Product Variant.
 *           type: integer
 *   sales_channel_id:
 *     type: string
 *     description: "The ID of the sales channel associated with the swap."
 *   custom_shipping_options:
 *     description: An array of custom shipping options to potentially create a Shipping Method from to send the additional items.
 *     type: array
 *     items:
 *       type: object
 *       required:
 *         - option_id
 *         - price
 *       properties:
 *         option_id:
 *           description: The ID of the Shipping Option.
 *           type: string
 *         price:
 *           description: The custom price of the Shipping Option.
 *           type: integer
 *   no_notification:
 *     description: >-
 *       If set to `true`, no notification will be sent to the customer related to this Swap.
 *     type: boolean
 *   return_location_id:
 *     type: string
 *     description: "The ID of the location used for the associated return."
 *   allow_backorder:
 *     description: >-
 *       If set to `true`, swaps can be completed with items out of stock
 *     type: boolean
 *     default: true
 */
export class AdminPostOrdersOrderSwapsReq {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReturnItem)
  return_items: ReturnItem[]

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => ReturnShipping)
  return_shipping?: ReturnShipping

  @IsOptional()
  @IsString()
  sales_channel_id?: string

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdditionalItem)
  additional_items?: AdditionalItem[]

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CustomShippingOption)
  custom_shipping_options?: CustomShippingOption[] = []

  @IsBoolean()
  @IsOptional()
  no_notification?: boolean

  @IsOptional()
  @IsString()
  return_location_id?: string

  @IsBoolean()
  @IsOptional()
  allow_backorder?: boolean = true
}

export class AdminPostOrdersOrderSwapsParams extends FindParams {}
