/**
 * @oas [delete] /admin/tax-regions/{id}
 * operationId: DeleteTaxRegionsId
 * summary: Delete a Tax Region
 * description: Delete a tax region.
 * x-authenticated: true
 * parameters:
 *   - name: id
 *     in: path
 *     description: The tax region's ID.
 *     required: true
 *     schema:
 *       type: string
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 *   - jwt_token: []
 * x-codeSamples:
 *   - lang: Shell
 *     label: cURL
 *     source: |-
 *       curl -X DELETE '{backend_url}/admin/tax-regions/{id}' \
 *       -H 'x-medusa-access-token: {api_token}'
 * tags:
 *   - Tax Regions
 * responses:
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
 * requestBody:
 *   content:
 *     application/json:
 *       schema: {}
 * 
*/

