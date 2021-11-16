import { IsOptional, IsString } from "class-validator"
import NoteService from "../../../../services/note"
import { validator } from "../../../../utils/validator"

/**
 * @oas [post] /notes
 * operationId: "PostNotes"
 * summary: "Creates a Note"
 * description: "Creates a Note which can be associated with any resource as required."
 * x-authenticated: true
 * requestBody:
 *  content:
 *    application/json:
 *      schema:
 *        properties:
 *          resource_id:
 *            type: string
 *            description: The id of the resource which the Note relates to.
 *          resource_type:
 *            type: string
 *            description: The type of resource which the Note relates to.
 *          value:
 *            type: string
 *            description: The content of the Note to create.
 * tags:
 *   - Note
 * responses:
 *   200:
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           properties:
 *             note:
 *               $ref: "#/components/schemas/note"
 *
 */
export default async (req, res) => {
  const validated = await validator(AdminPostNotesReq, req.body)

  const userId: string = req.user.id || req.user.userId

  const noteService: NoteService = req.scope.resolve("noteService")

  const result = await noteService.create({
    resource_id: validated.resource_id,
    resource_type: validated.resource_type,
    value: validated.value,
    author_id: userId,
  })

  res.status(200).json({ note: result })
}

export class AdminPostNotesReq {
  @IsString()
  @IsOptional()
  resource_id: string

  @IsString()
  @IsOptional()
  resource_type?: string

  @IsString()
  @IsOptional()
  value?: string
}
