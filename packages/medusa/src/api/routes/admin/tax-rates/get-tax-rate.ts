import { FindParams } from "../../../../types/common"
import { TaxRateService } from "../../../../services"
import { validator } from "../../../../utils/validator"

/**
 * @oas [get] /admin/tax-rates/{id}
 * operationId: "GetTaxRatesTaxRate"
 * summary: "Get a Tax Rate"
 * description: "Retrieve a Tax Rate's details."
 * parameters:
 *   - (path) id=* {string} ID of the tax rate.
 *   - (query) fields {string} Comma-separated fields that should be included in the returned tax rate.
 *   - (query) expand {string} Comma-separated relations that should be expanded in the returned tax rate.
 * x-authenticated: true
 * x-codegen:
 *   method: retrieve
 *   queryParams: AdminGetTaxRatesTaxRateParams
 * x-codeSamples:
 *   - lang: JavaScript
 *     label: JS Client
 *     source: |
 *       import Medusa from "@medusajs/medusa-js"
 *       const medusa = new Medusa({ baseUrl: MEDUSA_BACKEND_URL, maxRetries: 3 })
 *       // must be previously logged in or use api token
 *       medusa.admin.taxRates.retrieve(taxRateId)
 *       .then(({ tax_rate }) => {
 *         console.log(tax_rate.id);
 *       });
 *   - lang: Shell
 *     label: cURL
 *     source: |
 *       curl 'https://medusa-url.com/admin/tax-rates/{id}' \
 *       -H 'Authorization: Bearer {api_token}'
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 * tags:
 *   - Tax Rates
 * responses:
 *   200:
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           $ref: "#/components/schemas/AdminTaxRatesRes"
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
  const value = await validator(AdminGetTaxRatesTaxRateParams, req.query)

  const rateService: TaxRateService = req.scope.resolve("taxRateService")
  const rate = await rateService.retrieve(req.params.id, req.retrieveConfig)

  res.json({ tax_rate: rate })
}

export class AdminGetTaxRatesTaxRateParams extends FindParams { }
