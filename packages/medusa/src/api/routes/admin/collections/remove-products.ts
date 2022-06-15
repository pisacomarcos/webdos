import { ArrayNotEmpty, IsString } from "class-validator"
import ProductCollectionService from "../../../../services/product-collection"
import { Request } from "express"

/**
 * @oas [delete] /collections/{id}/products/batch
 * operationId: "DeleteProductsFromCollection"
 * summary: "Removes products associated with a Product Collection"
 * description: "Removes products associated with a Product Collection"
 * x-authenticated: true
 * parameters:
 *   - (path) id=* {string} The id of the Collection.
 * requestBody:
 *   content:
 *     application/json:
 *       schema:
 *         properties:
 *           product_ids:
 *             description: "An array of Product IDs to remove from the Product Collection."
 *             type: array
 *             items:
 *               properties:
 *                 id:
 *                   description: "The ID of a Product to remove from the Product Collection."
 *                   type: string
 * tags:
 *   - Collection
 * responses:
 *  "200":
 *    description: OK
 */
export default async (req: Request, res) => {
  const { id } = req.params
  const { validatedBody } = req as { validatedBody: AdminDeleteProductsFromCollectionReq }

  const productCollectionService: ProductCollectionService = req.scope.resolve(
    "productCollectionService"
  )

  await productCollectionService.removeProducts(id, validatedBody.product_ids)

  res.json({
    id,
    object: "product-collection",
    removed_products: validatedBody.product_ids,
  })
}

export class AdminDeleteProductsFromCollectionReq {
  @ArrayNotEmpty()
  @IsString({ each: true })
  product_ids: string[]
}
