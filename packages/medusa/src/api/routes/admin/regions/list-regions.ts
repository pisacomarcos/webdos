import { validator } from "../../../../utils/validator"
import { Region } from "../../../.."
import RegionService from "../../../../services/region"
import { defaultAdminRegionFields, defaultAdminRegionRelations } from "."
import { IsInt, IsOptional } from "class-validator"
import { Type } from "class-transformer"

/**
 * @oas [get] /regions
 * operationId: "GetRegions"
 * summary: "List Regions"
 * description: "Retrieves a list of Regions."
 * x-authenticated: true
 * parameters:
 *  - in: path
 *    name: limit
 *    schema:
 *      type: integer
 *    required: false
 *    description: limit the number of regions in response
 *  - in: path
 *    name: offset
 *    schema:
 *      type: integer
 *    required: false
 *    description: Offset of regions in response (used for pagination)
 * tags:
 *   - Region
 * responses:
 *   200:
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           properties:
 *             regions:
 *               type: array
 *               items:
 *                 $ref: "#/components/schemas/region"
 */
export default async (req, res) => {
  const validated = await validator(AdminGetRegionsParams, req.query)

  const regionService: RegionService = req.scope.resolve("regionService")

  const limit: number = validated.limit || 50
  const offset: number = validated.offset || 0

  const selector = {}

  const listConfig = {
    select: defaultAdminRegionFields,
    relations: defaultAdminRegionRelations,
    skip: offset,
    take: limit,
  }

  const regions: Region[] = await regionService.list(selector, listConfig)

  res.json({ regions, count: regions.length, offset, limit })
}

export class AdminGetRegionsParams {
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  limit?: number

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  offset?: number
}
