import type { NextFunction, Request, Response } from "express"
import type { Customer, User } from "../models"

import { MedusaContainer, RequestQueryFields } from "@medusajs/types"
import { FindConfig } from "./common"

export interface MedusaRequest<Body = unknown> extends Request {
  validatedBody: Body
  validatedQuery: RequestQueryFields & Record<string, unknown>
  /**
   * TODO: shouldn't this correspond to returnable fields instead of allowed fields? also it is used by the cleanResponseData util
   */
  allowedProperties: string[]
  /**
   * An object containing the select, relation, skip, take and order to be used with medusa internal services
   */
  listConfig: FindConfig<unknown>
  /**
   * An object containing the select, relation to be used with medusa internal services
   */
  retrieveConfig: FindConfig<unknown>
  /**
   * An object containing fields and variables to be used with the remoteQuery
   */
  remoteQueryConfig: { fields: string[]; pagination: { order?: Record<string, string>, skip?: number, take?: number } }
  /**
   * An object containing the fields that are filterable e.g `{ id: Any<String> }`
   */
  filterableFields: Record<string, unknown>
  includes?: Record<string, boolean>
  /**
   * An array of fields and relations that are allowed to be queried, this can be set by the
   * consumer as part of a middleware and it will take precedence over the defaultAllowedFields
   * @deprecated use `allowed` instead
   */
  allowedFields?: string[]
  /**
   * An array of fields and relations that are allowed to be queried, this can be set by the
   * consumer as part of a middleware and it will take precedence over the defaultAllowedFields set
   * by the api
   */
  allowed?: string[]
  errors: string[]
  scope: MedusaContainer
  session?: any
  rawBody?: any
  requestId?: string
}

export interface AuthenticatedMedusaRequest<Body = never>
  extends MedusaRequest<Body> {
  user: (User | Customer) & { customer_id?: string; userId?: string } // TODO: Remove this property when v2 is released
  auth: {
    actor_id: string
    auth_user_id: string
    app_metadata: Record<string, any>
    scope: string
  }
}

export type MedusaResponse = Response

export type MedusaNextFunction = NextFunction

export type MedusaRequestHandler = (
  req: MedusaRequest<unknown>,
  res: MedusaResponse,
  next: MedusaNextFunction
) => Promise<void> | void
