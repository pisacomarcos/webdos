import { defaultRelations, defaultFields } from "."
import { validator } from "medusa-core-utils"
import { Region } from "../../../.."
import RegionService from "../../../../services/region"
import { IsArray, IsNumber, IsString } from "class-validator"

/**
 * @oas [post] /regions/{id}
 * operationId: "PostRegionsRegion"
 * summary: "Update a Region"
 * description: "Updates a Region"
 * x-authenticated: true
 * parameters:
 *   - (path) id=* {string} The id of the Region.
 * requestBody:
 *   content:
 *     application/json:
 *       schema:
 *         properties:
 *           name:
 *             description: "The name of the Region"
 *             type: string
 *           currency_code:
 *             description: "The 3 character ISO currency code to use for the Region."
 *             type: string
 *           tax_code:
 *             description: "An optional tax code the Region."
 *             type: string
 *           tax_rate:
 *             description: "The tax rate to use on Orders in the Region."
 *             type: number
 *           payment_providers:
 *             description: "A list of Payment Providers that should be enabled for the Region"
 *             type: array
 *             items:
 *               type: string
 *           fulfillment_providers:
 *             description: "A list of Fulfillment Providers that should be enabled for the Region"
 *             type: array
 *             items:
 *               type: string
 *           countries:
 *             description: "A list of countries that should be included in the Region."
 *             type: array
 *             items:
 *               type: string
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
  const validated = await validator(AdminUpdateRegionRequest, req.body)

  const regionService = req.scope.resolve("regionService") as RegionService
  await regionService.update(region_id, validated)
  const region: Region = await regionService.retrieve(region_id, {
    select: defaultFields,
    relations: defaultRelations,
  })

  res.status(200).json({ region })
}

export class AdminUpdateRegionRequest {
  @IsString()
  name: string
  @IsString()
  currency_code: string
  @IsString()
  tax_code: string
  @IsNumber()
  tax_rate: number
  @IsArray()
  @IsString({ each: true })
  payment_providers: string[]
  @IsArray()
  @IsString({ each: true })
  fulfillment_providers: string[]
  // iso_2 country codes
  @IsArray()
  @IsString({ each: true })
  countries: string[]
}

export class AdminUpdateRegionResponse {
  region: Region
}
