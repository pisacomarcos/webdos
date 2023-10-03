import { Type } from "class-transformer"
import { IsNumber, IsOptional, IsString } from "class-validator"
import IsolateProductDomain from "../../../../loaders/feature-flags/isolate-product-domain"
import { OrderService } from "../../../../services"
import { AdminListOrdersSelector } from "../../../../types/orders"
import { cleanResponseData } from "../../../../utils/clean-response-data"

/**
 * @oas [get] /admin/orders
 * operationId: "GetOrders"
 * summary: "List Orders"
 * description: "Retrieve a list of Orders. The orders can be filtered by fields such as `status` or `display_id`. The order can also be paginated."
 * x-authenticated: true
 * parameters:
 *   - (query) q {string} term to search orders' shipping address, first name, email, and display ID
 *   - (query) id {string} Filter by ID.
 *   - in: query
 *     name: status
 *     style: form
 *     explode: false
 *     description: Filter by status
 *     schema:
 *       type: array
 *       items:
 *         type: string
 *         enum: [pending, completed, archived, canceled, requires_action]
 *   - in: query
 *     name: fulfillment_status
 *     style: form
 *     explode: false
 *     description: Filter by fulfillment status
 *     schema:
 *       type: array
 *       items:
 *         type: string
 *         enum: [not_fulfilled, fulfilled, partially_fulfilled, shipped, partially_shipped, canceled, returned, partially_returned, requires_action]
 *   - in: query
 *     name: payment_status
 *     style: form
 *     explode: false
 *     description: Filter by payment status
 *     schema:
 *       type: array
 *       items:
 *         type: string
 *         enum: [captured, awaiting, not_paid, refunded, partially_refunded, canceled, requires_action]
 *   - (query) display_id {string} Filter by display ID
 *   - (query) cart_id {string} Filter by cart ID
 *   - (query) customer_id {string} Filter by customer ID
 *   - (query) email {string} Filter by email
 *   - in: query
 *     name: region_id
 *     style: form
 *     explode: false
 *     description: Filter by region IDs.
 *     schema:
 *       oneOf:
 *         - type: string
 *           description: ID of a Region.
 *         - type: array
 *           items:
 *             type: string
 *             description: ID of a Region.
 *   - in: query
 *     name: currency_code
 *     style: form
 *     explode: false
 *     description: Filter by currency codes.
 *     schema:
 *       type: string
 *       externalDocs:
 *         url: https://en.wikipedia.org/wiki/ISO_4217#Active_codes
 *         description: See a list of codes.
 *   - (query) tax_rate {string} Filter by tax rate.
 *   - in: query
 *     name: created_at
 *     description: Filter by a creation date range.
 *     schema:
 *       type: object
 *       properties:
 *         lt:
 *            type: string
 *            description: filter by dates less than this date
 *            format: date
 *         gt:
 *            type: string
 *            description: filter by dates greater than this date
 *            format: date
 *         lte:
 *            type: string
 *            description: filter by dates less than or equal to this date
 *            format: date
 *         gte:
 *            type: string
 *            description: filter by dates greater than or equal to this date
 *            format: date
 *   - in: query
 *     name: updated_at
 *     description: Filter by an update date range.
 *     schema:
 *       type: object
 *       properties:
 *         lt:
 *            type: string
 *            description: filter by dates less than this date
 *            format: date
 *         gt:
 *            type: string
 *            description: filter by dates greater than this date
 *            format: date
 *         lte:
 *            type: string
 *            description: filter by dates less than or equal to this date
 *            format: date
 *         gte:
 *            type: string
 *            description: filter by dates greater than or equal to this date
 *            format: date
 *   - in: query
 *     name: canceled_at
 *     description: Filter by a cancelation date range.
 *     schema:
 *       type: object
 *       properties:
 *         lt:
 *            type: string
 *            description: filter by dates less than this date
 *            format: date
 *         gt:
 *            type: string
 *            description: filter by dates greater than this date
 *            format: date
 *         lte:
 *            type: string
 *            description: filter by dates less than or equal to this date
 *            format: date
 *         gte:
 *            type: string
 *            description: filter by dates greater than or equal to this date
 *            format: date
 *   - in: query
 *     name: sales_channel_id
 *     style: form
 *     explode: false
 *     description: Filter by Sales Channel IDs
 *     schema:
 *       type: array
 *       items:
 *         type: string
 *         description: The ID of a Sales Channel
 *   - (query) offset=0 {integer} The number of orders to skip when retrieving the orders.
 *   - (query) limit=50 {integer} Limit the number of orders returned.
 *   - (query) expand {string} Comma-separated relations that should be expanded in the returned order.
 *   - (query) fields {string} Comma-separated fields that should be included in the returned order.
 * x-codegen:
 *   method: list
 *   queryParams: AdminGetOrdersParams
 * x-codeSamples:
 *   - lang: JavaScript
 *     label: JS Client
 *     source: |
 *       import Medusa from "@medusajs/medusa-js"
 *       const medusa = new Medusa({ baseUrl: MEDUSA_BACKEND_URL, maxRetries: 3 })
 *       // must be previously logged in or use api token
 *       medusa.admin.orders.list()
 *       .then(({ orders, limit, offset, count }) => {
 *         console.log(orders.length);
 *       });
 *   - lang: Shell
 *     label: cURL
 *     source: |
 *       curl '{backend_url}/admin/orders' \
 *       -H 'x-medusa-access-token: {api_token}'
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
 *           $ref: "#/components/schemas/AdminOrdersListRes"
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
  const orderService: OrderService = req.scope.resolve("orderService")
  const featureFlagRouter = req.scope.resolve("featureFlagRouter")

  const { skip, take } = req.listConfig

  const isIsolateProductDomain = featureFlagRouter.isFeatureEnabled(
    IsolateProductDomain.key
  )

  let promise: Promise<any>

  if (isIsolateProductDomain) {
    promise = listAndCountOrders(req, req.filterableFields, req.listConfig)
  } else {
    promise = orderService.listAndCount(req.filterableFields, req.listConfig)
  }

  const [orders, count] = await promise

  const data = cleanResponseData(orders, req.allowedProperties)

  res.json({
    orders: cleanResponseData(data, []),
    count,
    offset: skip,
    limit: take,
  })
}

async function listAndCountOrders(req, filterableFields, listConfig) {
  // TODO: Add support for fields/expands

  const remoteQuery = req.scope.resolve("remoteQuery")

  const variables = {
    filters: filterableFields,
    sort: listConfig.order,
    skip: listConfig.skip,
    take: listConfig.take,
  }

  const query = {
    orders: {
      __args: variables,
      fields: [
        "id",
        "status",
        "display_id",
        "created_at",
        "email",
        "fulfillment_status",
        "payment_status",
        "total",
        "currency_code",
      ],
      customer: {
        fields: [
          "id",
          "created_at",
          "updated_at",
          "deleted_at",
          "email",
          "first_name",
          "last_name",
          "billing_address_id",
          "phone",
          "has_account",
          "metadata",
        ],
      },
      sales_channel: {
        fields: [
          "id",
          "created_at",
          "updated_at",
          "deleted_at",
          "name",
          "description",
          "is_disabled",
          "metadata",
        ],
      },
      shipping_address: {
        fields: [
          "id",
          "created_at",
          "updated_at",
          "deleted_at",
          "customer_id",
          "company",
          "first_name",
          "last_name",
          "address_1",
          "address_2",
          "city",
          "country_code",
          "province",
          "postal_code",
          "phone",
          "metadata",
        ],
      },
    },
  }

  const {
    rows: orders,
    metadata: { count },
  } = await remoteQuery(query)

  return [orders, count]
}

export class AdminGetOrdersParams extends AdminListOrdersSelector {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  offset = 0

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit = 50

  @IsString()
  @IsOptional()
  expand?: string

  @IsString()
  @IsOptional()
  fields?: string
}
