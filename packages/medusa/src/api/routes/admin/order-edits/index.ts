import { Router } from "express"
import middlewares, { transformQuery } from "../../../middlewares"
import { EmptyQueryParams } from "../../../../types/common"
import { isFeatureFlagEnabled } from "../../../middlewares/feature-flag-enabled"
import OrderEditingFeatureFlag from "../../../../loaders/feature-flags/order-editing"
import {
  defaultOrderEditFields,
  defaultOrderEditRelations,
} from "../../../../types/order-edit"
import { OrderEdit } from "../../../../models"
import { DeleteResponse } from "../../../../types/common"

const route = Router()

export default (app) => {
  app.use(
    "/order-edits",
    isFeatureFlagEnabled(OrderEditingFeatureFlag.key),
    route
  )

  route.get(
    "/:id",
    transformQuery(EmptyQueryParams, {
      defaultRelations: defaultOrderEditRelations,
      defaultFields: defaultOrderEditFields,
      isList: false,
    }),
    middlewares.wrap(require("./get-order-edit").default)
  )

  route.delete(
    "/:edit_id",
    middlewares.wrap(require("./delete-order-edit").default)
  )

  return app
}

export type AdminOrdersEditsRes = {
  order_edit: OrderEdit
}
export type AdminOrderEditDeleteRes = DeleteResponse

export const defaultAdminOrderEditRelations = []
export const defaultAdminOrderEditFields = []
