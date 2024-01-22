import { FindConfig } from "../common"
import { IModuleService } from "../modules-sdk"
import { Context } from "../shared-context"
import {
  CartAddressDTO,
  CartDTO,
  CartLineItemDTO,
  CartShippingMethodDTO,
  FilterableAddressProps,
  FilterableCartProps,
  FilterableLineItemAdjustmentProps,
  FilterableLineItemProps,
  FilterableShippingMethodProps,
  LineItemAdjustmentDTO,
  ShippingMethodAdjustmentDTO,
} from "./common"
import {
  CreateAddressDTO,
  CreateAdjustmentDTO,
  CreateCartDTO,
  CreateLineItemDTO,
  CreateLineItemForCartDTO,
  CreateShippingMethodAdjustmentDTO,
  CreateShippingMethodDTO,
  UpdateAddressDTO,
  UpdateCartDTO,
  UpdateLineItemDTO,
  UpdateLineItemWithSelectorDTO,
  UpdateShippingMethodAdjustmentDTO,
  UpsertLineItemAdjustmentDTO,
} from "./mutations"

export interface ICartModuleService extends IModuleService {
  retrieve(
    cartId: string,
    config?: FindConfig<CartDTO>,
    sharedContext?: Context
  ): Promise<CartDTO>

  list(
    filters?: FilterableCartProps,
    config?: FindConfig<CartDTO>,
    sharedContext?: Context
  ): Promise<CartDTO[]>

  listAndCount(
    filters?: FilterableCartProps,
    config?: FindConfig<CartDTO>,
    sharedContext?: Context
  ): Promise<[CartDTO[], number]>

  create(data: CreateCartDTO[], sharedContext?: Context): Promise<CartDTO[]>
  create(data: CreateCartDTO, sharedContext?: Context): Promise<CartDTO>

  update(data: UpdateCartDTO[], sharedContext?: Context): Promise<CartDTO[]>
  update(data: UpdateCartDTO, sharedContext?: Context): Promise<CartDTO>

  delete(cartIds: string[], sharedContext?: Context): Promise<void>
  delete(cartId: string, sharedContext?: Context): Promise<void>

  listAddresses(
    filters?: FilterableAddressProps,
    config?: FindConfig<CartAddressDTO>,
    sharedContext?: Context
  ): Promise<CartAddressDTO[]>

  createAddresses(
    data: CreateAddressDTO[],
    sharedContext?: Context
  ): Promise<CartAddressDTO[]>
  createAddresses(
    data: CreateAddressDTO,
    sharedContext?: Context
  ): Promise<CartAddressDTO>

  updateAddresses(
    data: UpdateAddressDTO[],
    sharedContext?: Context
  ): Promise<CartAddressDTO[]>
  updateAddresses(
    data: UpdateAddressDTO,
    sharedContext?: Context
  ): Promise<CartAddressDTO>

  deleteAddresses(ids: string[], sharedContext?: Context): Promise<void>
  deleteAddresses(ids: string, sharedContext?: Context): Promise<void>

  retrieveLineItem(
    itemId: string,
    config?: FindConfig<CartLineItemDTO>,
    sharedContext?: Context
  ): Promise<CartLineItemDTO>

  listLineItems(
    filters: FilterableLineItemProps,
    config?: FindConfig<CartLineItemDTO>,
    sharedContext?: Context
  ): Promise<CartLineItemDTO[]>

  addLineItems(data: CreateLineItemForCartDTO): Promise<CartLineItemDTO[]>
  addLineItems(data: CreateLineItemForCartDTO[]): Promise<CartLineItemDTO[]>
  addLineItems(
    cartId: string,
    items: CreateLineItemDTO[],
    sharedContext?: Context
  ): Promise<CartLineItemDTO[]>

  updateLineItems(
    data: UpdateLineItemWithSelectorDTO[]
  ): Promise<CartLineItemDTO[]>
  updateLineItems(
    selector: Partial<CartLineItemDTO>,
    data: Partial<UpdateLineItemDTO>,
    sharedContext?: Context
  ): Promise<CartLineItemDTO[]>
  updateLineItems(
    lineId: string,
    data: Partial<UpdateLineItemDTO>,
    sharedContext?: Context
  ): Promise<CartLineItemDTO>

  removeLineItems(itemIds: string[], sharedContext?: Context): Promise<void>
  removeLineItems(itemIds: string, sharedContext?: Context): Promise<void>
  removeLineItems(
    selector: Partial<CartLineItemDTO>,
    sharedContext?: Context
  ): Promise<void>

  listShippingMethods(
    filters: FilterableShippingMethodProps,
    config: FindConfig<CartShippingMethodDTO>,
    sharedContext?: Context
  ): Promise<CartShippingMethodDTO[]>

  addShippingMethods(
    data: CreateShippingMethodDTO
  ): Promise<CartShippingMethodDTO>
  addShippingMethods(
    data: CreateShippingMethodDTO[]
  ): Promise<CartShippingMethodDTO[]>
  addShippingMethods(
    cartId: string,
    methods: CreateShippingMethodDTO[],
    sharedContext?: Context
  ): Promise<CartShippingMethodDTO[]>

  removeShippingMethods(
    methodIds: string[],
    sharedContext?: Context
  ): Promise<void>
  removeShippingMethods(
    methodIds: string,
    sharedContext?: Context
  ): Promise<void>
  removeShippingMethods(
    selector: Partial<CartShippingMethodDTO>,
    sharedContext?: Context
  ): Promise<void>

  listLineItemAdjustments(
    filters: FilterableLineItemAdjustmentProps,
    config?: FindConfig<LineItemAdjustmentDTO>,
    sharedContext?: Context
  ): Promise<LineItemAdjustmentDTO[]>

  addLineItemAdjustments(
    data: CreateAdjustmentDTO[]
  ): Promise<LineItemAdjustmentDTO[]>
  addLineItemAdjustments(
    data: CreateAdjustmentDTO
  ): Promise<LineItemAdjustmentDTO[]>
  addLineItemAdjustments(
    cartId: string,
    data: CreateAdjustmentDTO[]
  ): Promise<LineItemAdjustmentDTO[]>

  setLineItemAdjustments(
    cartId: string,
    data: UpsertLineItemAdjustmentDTO[],
    sharedContext?: Context
  ): Promise<LineItemAdjustmentDTO[]>

  removeLineItemAdjustments(
    adjustmentIds: string[],
    sharedContext?: Context
  ): Promise<void>
  removeLineItemAdjustments(
    adjustmentIds: string,
    sharedContext?: Context
  ): Promise<void>
  removeLineItemAdjustments(
    selector: Partial<LineItemAdjustmentDTO>,
    sharedContext?: Context
  ): Promise<void>

  listShippingMethodAdjustments(
    filters: FilterableShippingMethodProps,
    config?: FindConfig<ShippingMethodAdjustmentDTO>,
    sharedContext?: Context
  ): Promise<ShippingMethodAdjustmentDTO[]>

  addShippingMethodAdjustments(
    data: CreateShippingMethodAdjustmentDTO[]
  ): Promise<ShippingMethodAdjustmentDTO[]>
  addShippingMethodAdjustments(
    data: CreateShippingMethodAdjustmentDTO
  ): Promise<ShippingMethodAdjustmentDTO[]>
  addShippingMethodAdjustments(
    cartId: string,
    data: CreateShippingMethodAdjustmentDTO[],
    sharedContext?: Context
  ): Promise<ShippingMethodAdjustmentDTO[]>

  setShippingMethodAdjustments(
    cartId: string,
    data: (
      | CreateShippingMethodAdjustmentDTO
      | UpdateShippingMethodAdjustmentDTO
    )[],
    sharedContext?: Context
  ): Promise<ShippingMethodAdjustmentDTO[]>

  removeShippingMethodAdjustments(
    adjustmentIds: string[],
    sharedContext?: Context
  ): Promise<void>
  removeShippingMethodAdjustments(
    adjustmentIds: string,
    sharedContext?: Context
  ): Promise<void>
  removeShippingMethodAdjustments(
    selector: Partial<ShippingMethodAdjustmentDTO>,
    sharedContext?: Context
  ): Promise<void>
}
