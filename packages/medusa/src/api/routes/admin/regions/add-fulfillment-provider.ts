import { defaultRelations, defaultFields } from "."
import { validator } from "medusa-core-utils"
import { Region } from "../../../.."
import RegionService from "../../../../services/region"
import { IsString } from "class-validator"
/**
 * @oas [post] /regions/{id}/fulfillment-providers
 * operationId: "PostRegionsRegionFulfillmentProviders"
 * summary: "Add Fulfillment Provider"
 * description: "Adds a Fulfillment Provider to a Region"
 * x-authenticated: true
 * parameters:
 *   - (path) id=* {string} The id of the Region.
 * requestBody:
 *   content:
 *     application/json:
 *       schema:
 *         properties:
 *           provider_id:
 *             description: "The id of the Fulfillment Provider to add."
 *             type: string
 * tags:
 *   - Region
 * responses:
 *   200:
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           properties:
 *             region:
 *               $ref: "#/components/schemas/region"
 */
export default async (req, res) => {
  const { region_id } = req.params
  const validated = await validator(
    AdminRegionAddFulfillmentProviderRequest,
    req.body
  )

  const regionService = req.scope.resolve("regionService") as RegionService
  await regionService.addFulfillmentProvider(region_id, validated.provider_id)

  const region: Region = await regionService.retrieve(region_id, {
    select: defaultFields,
    relations: defaultRelations,
  })
  res.status(200).json({ region })
}

export class AdminRegionAddFulfillmentProviderRequest {
  @IsString()
  provider_id: string
}

export class AdminRegionAddFulfillmentProviderResponse {
  region: Region
}
