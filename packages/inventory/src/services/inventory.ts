import { InternalModuleDeclaration } from "@medusajs/modules-sdk"
import {
  BulkUpdateInventoryLevelInput,
  Context,
  CreateInventoryItemInput,
  CreateInventoryLevelInput,
  CreateReservationItemInput,
  FilterableInventoryItemProps,
  FilterableInventoryLevelProps,
  FilterableReservationItemProps,
  FindConfig,
  IEventBusService,
  IInventoryService,
  InventoryItemDTO,
  InventoryLevelDTO,
  MODULE_RESOURCE_TYPE,
  ModuleJoinerConfig,
  ReservationItemDTO,
  UpdateInventoryLevelInput,
  UpdateReservationItemInput,
} from "@medusajs/types"
import {
  InjectEntityManager,
  InjectIntoContext,
  MedusaContext,
  MedusaError,
  MessageAggregator,
  promiseAll,
} from "@medusajs/utils"
import { EntityManager } from "typeorm"
import { joinerConfig } from "../joiner-config"
import { InternalContext } from "../types"
import InventoryItemService from "./inventory-item"
import InventoryLevelService from "./inventory-level"
import ReservationItemService from "./reservation-item"

type InjectedDependencies = {
  manager: EntityManager
  inventoryItemService: InventoryItemService
  inventoryLevelService: InventoryLevelService
  reservationItemService: ReservationItemService
  eventBusService: IEventBusService
}

export default class InventoryService implements IInventoryService {
  protected readonly manager_: EntityManager

  protected readonly inventoryItemService_: InventoryItemService
  protected readonly reservationItemService_: ReservationItemService
  protected readonly inventoryLevelService_: InventoryLevelService
  protected readonly eventBusService_: IEventBusService

  constructor(
    {
      manager,
      inventoryItemService,
      inventoryLevelService,
      reservationItemService,
      eventBusService,
    }: InjectedDependencies,
    options?: unknown,
    protected readonly moduleDeclaration?: InternalModuleDeclaration
  ) {
    this.manager_ = manager
    this.inventoryItemService_ = inventoryItemService
    this.inventoryLevelService_ = inventoryLevelService
    this.reservationItemService_ = reservationItemService
    this.eventBusService_ = eventBusService
  }

  __joinerConfig(): ModuleJoinerConfig {
    return joinerConfig
  }

  /**
   * Lists inventory items that match the given selector
   * @param selector - the selector to filter inventory items by
   * @param config - the find configuration to use
   * @param context
   * @return A tuple of inventory items and their total count
   */
  async listInventoryItems(
    selector: FilterableInventoryItemProps,
    config: FindConfig<InventoryItemDTO> = { relations: [], skip: 0, take: 10 },
    context: Context<EntityManager> = {}
  ): Promise<[InventoryItemDTO[], number]> {
    return await this.inventoryItemService_.listAndCount(
      selector,
      config,
      context
    )
  }
  async list(
    selector: FilterableInventoryItemProps,
    config: FindConfig<InventoryItemDTO> = { relations: [], skip: 0, take: 10 },
    context: Context<EntityManager> = {}
  ): Promise<InventoryItemDTO[]> {
    return await this.inventoryItemService_.list(selector, config, context)
  }

  /**
   * Lists inventory levels that match the given selector
   * @param selector - the selector to filter inventory levels by
   * @param config - the find configuration to use
   * @param context
   * @return A tuple of inventory levels and their total count
   */
  async listInventoryLevels(
    selector: FilterableInventoryLevelProps,
    config: FindConfig<InventoryLevelDTO> = {
      relations: [],
      skip: 0,
      take: 10,
    },
    context: Context<EntityManager> = {}
  ): Promise<[InventoryLevelDTO[], number]> {
    return await this.inventoryLevelService_.listAndCount(
      selector,
      config,
      context
    )
  }

  /**
   * Lists reservation items that match the given selector
   * @param selector - the selector to filter reservation items by
   * @param config - the find configuration to use
   * @param context
   * @return A tuple of reservation items and their total count
   */
  async listReservationItems(
    selector: FilterableReservationItemProps,
    config: FindConfig<ReservationItemDTO> = {
      relations: [],
      skip: 0,
      take: 10,
    },
    context: Context<EntityManager> = {}
  ): Promise<[ReservationItemDTO[], number]> {
    return await this.reservationItemService_.listAndCount(
      selector,
      config,
      context
    )
  }

  /**
   * Retrieves an inventory item with the given id
   * @param inventoryItemId - the id of the inventory item to retrieve
   * @param config - the find configuration to use
   * @param context
   * @return The retrieved inventory item
   */
  async retrieveInventoryItem(
    inventoryItemId: string,
    config?: FindConfig<InventoryItemDTO>,
    context: Context<EntityManager> = {}
  ): Promise<InventoryItemDTO> {
    const inventoryItem = await this.inventoryItemService_.retrieve(
      inventoryItemId,
      config,
      context
    )
    return { ...inventoryItem }
  }

  /**
   * Retrieves an inventory level for a given inventory item and location
   * @param inventoryItemId - the id of the inventory item
   * @param locationId - the id of the location
   * @param context
   * @return the retrieved inventory level
   */
  async retrieveInventoryLevel(
    inventoryItemId: string,
    locationId: string,
    context: Context<EntityManager> = {}
  ): Promise<InventoryLevelDTO> {
    const [inventoryLevel] = await this.inventoryLevelService_.list(
      { inventory_item_id: inventoryItemId, location_id: locationId },
      { take: 1 },
      context
    )
    if (!inventoryLevel) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Inventory level for item ${inventoryItemId} and location ${locationId} not found`
      )
    }
    return inventoryLevel
  }

  /**
   * Retrieves a reservation item
   * @param reservationId
   * @param context
   * @param reservationId
   * @param context
   */
  async retrieveReservationItem(
    reservationId: string,
    context: Context<EntityManager> = {}
  ): Promise<ReservationItemDTO> {
    return await this.reservationItemService_.retrieve(
      reservationId,
      undefined,
      context
    )
  }

  private async ensureInventoryLevels(
    data: { location_id: string; inventory_item_id: string }[],
    context: Context<EntityManager> = {}
  ): Promise<InventoryLevelDTO[]> {
    const inventoryLevels = await this.inventoryLevelService_.list(
      {
        inventory_item_id: data.map((e) => e.inventory_item_id),
        location_id: data.map((e) => e.location_id),
      },
      {},
      context
    )

    const inventoryLevelMap: Map<
      string,
      Map<string, InventoryLevelDTO>
    > = inventoryLevels.reduce((acc, curr) => {
      const inventoryLevelMap = acc.get(curr.inventory_item_id) ?? new Map()
      inventoryLevelMap.set(curr.location_id, curr)
      acc.set(curr.inventory_item_id, inventoryLevelMap)
      return acc
    }, new Map())

    const missing = data.filter(
      (i) => !inventoryLevelMap.get(i.inventory_item_id)?.get(i.location_id)
    )

    if (missing.length) {
      const error = missing
        .map((missing) => {
          return `Item ${missing.inventory_item_id} is not stocked at location ${missing.location_id}`
        })
        .join(", ")
      throw new MedusaError(MedusaError.Types.NOT_FOUND, error)
    }

    return inventoryLevels.map(
      (i) => inventoryLevelMap.get(i.inventory_item_id)!.get(i.location_id)!
    )
  }

  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  @InjectIntoContext({
    messageAggregator: new MessageAggregator(),
  })
  async createReservationItems(
    input: CreateReservationItemInput[],
    @MedusaContext() context: InternalContext = {}
  ): Promise<ReservationItemDTO[]> {
    await this.ensureInventoryLevels(input, context)

    const result = await this.reservationItemService_.create(input, context)

    await this.emitEvents_(context?.messageAggregator?.getMessages())

    return result
  }

  /**
   * Creates a reservation item
   * @param input - the input object
   * @return The created reservation item
   */
  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  async createReservationItem(
    input: CreateReservationItemInput,
    @MedusaContext() context: Context<EntityManager> = {}
  ): Promise<ReservationItemDTO> {
    const [result] = await this.createReservationItems([input], context)

    return result
  }

  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  @InjectIntoContext({
    messageAggregator: new MessageAggregator(),
  })
  async createInventoryItems(
    input: CreateInventoryItemInput[],
    @MedusaContext() context: InternalContext = {}
  ): Promise<InventoryItemDTO[]> {
    const result = await this.inventoryItemService_.create(input, context)

    await this.emitEvents_(context?.messageAggregator?.getMessages())

    return result
  }

  /**
   * Creates an inventory item
   * @param input - the input object
   * @param context
   * @return The created inventory item
   */
  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  @InjectIntoContext({
    messageAggregator: new MessageAggregator(),
  })
  async createInventoryItem(
    input: CreateInventoryItemInput,
    @MedusaContext() context: InternalContext = {}
  ): Promise<InventoryItemDTO> {
    const [result] = await this.createInventoryItems([input], context)

    await this.emitEvents_(context?.messageAggregator?.getMessages())

    return result
  }

  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  @InjectIntoContext({
    messageAggregator: new MessageAggregator(),
  })
  async createInventoryLevels(
    input: CreateInventoryLevelInput[],
    @MedusaContext() context: InternalContext = {}
  ): Promise<InventoryLevelDTO[]> {
    const result = await this.inventoryLevelService_.create(input, context)

    await this.emitEvents_(context?.messageAggregator?.getMessages())

    return result
  }

  /**
   * Creates an inventory item
   * @param input - the input object
   * @param context
   * @return The created inventory level
   */
  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  async createInventoryLevel(
    input: CreateInventoryLevelInput,
    @MedusaContext() context: Context<EntityManager> = {}
  ): Promise<InventoryLevelDTO> {
    const [result] = await this.createInventoryLevels([input], context)

    return result
  }

  /**
   * Updates an inventory item
   * @param inventoryItemId - the id of the inventory item to update
   * @param input - the input object
   * @param context
   * @return The updated inventory item
   */
  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  @InjectIntoContext({
    messageAggregator: new MessageAggregator(),
  })
  async updateInventoryItem(
    inventoryItemId: string,
    input: Partial<CreateInventoryItemInput>,
    @MedusaContext() context: InternalContext = {}
  ): Promise<InventoryItemDTO> {
    const inventoryItem = await this.inventoryItemService_.update(
      inventoryItemId,
      input,
      context
    )

    await this.emitEvents_(context?.messageAggregator?.getMessages())

    return { ...inventoryItem }
  }

  /**
   * Deletes an inventory item
   * @param inventoryItemId - the id of the inventory item to delete
   * @param context
   */
  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  @InjectIntoContext({
    messageAggregator: new MessageAggregator(),
  })
  async deleteInventoryItem(
    inventoryItemId: string | string[],
    @MedusaContext() context: InternalContext = {}
  ): Promise<void> {
    await this.inventoryLevelService_.deleteByInventoryItemId(
      inventoryItemId,
      context
    )

    await this.inventoryItemService_.delete(inventoryItemId, context)

    await this.emitEvents_(context?.messageAggregator?.getMessages())
  }

  /**
   * Restore an inventory item and levels
   * @param inventoryItemId - the id of the inventory item to delete
   * @param context
   */
  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  @InjectIntoContext({
    messageAggregator: new MessageAggregator(),
  })
  async restoreInventoryItem(
    inventoryItemId: string | string[],
    @MedusaContext() context: InternalContext = {}
  ): Promise<void> {
    await this.inventoryLevelService_.restoreByInventoryItemId(
      inventoryItemId,
      context
    )

    await this.inventoryItemService_.restore(inventoryItemId, context)

    await this.emitEvents_(context?.messageAggregator?.getMessages())
  }

  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  @InjectIntoContext({
    messageAggregator: new MessageAggregator(),
  })
  async deleteInventoryItemLevelByLocationId(
    locationId: string | string[],
    @MedusaContext() context: InternalContext = {}
  ): Promise<void> {
    await this.inventoryLevelService_.deleteByLocationId(locationId, context)

    await this.emitEvents_(context?.messageAggregator?.getMessages())
  }

  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  @InjectIntoContext({
    messageAggregator: new MessageAggregator(),
  })
  async deleteReservationItemByLocationId(
    locationId: string | string[],
    @MedusaContext() context: InternalContext = {}
  ): Promise<void> {
    await this.reservationItemService_.deleteByLocationId(locationId, context)

    await this.emitEvents_(context?.messageAggregator?.getMessages())
  }

  /**
   * Deletes an inventory level
   * @param inventoryItemId - the id of the inventory item associated with the level
   * @param locationId - the id of the location associated with the level
   * @param context
   */
  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  @InjectIntoContext({
    messageAggregator: new MessageAggregator(),
  })
  async deleteInventoryLevel(
    inventoryItemId: string,
    locationId: string,
    @MedusaContext() context: InternalContext = {}
  ): Promise<void> {
    const [inventoryLevel] = await this.inventoryLevelService_.list(
      { inventory_item_id: inventoryItemId, location_id: locationId },
      { take: 1 },
      context
    )

    if (!inventoryLevel) {
      return
    }

    await this.inventoryLevelService_.delete(inventoryLevel.id, context)

    await this.emitEvents_(context?.messageAggregator?.getMessages())
  }

  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  @InjectIntoContext({
    messageAggregator: new MessageAggregator(),
  })
  async updateInventoryLevels(
    updates: ({
      inventory_item_id: string
      location_id: string
    } & UpdateInventoryLevelInput)[],
    @MedusaContext() context: InternalContext = {}
  ): Promise<InventoryLevelDTO[]> {
    const inventoryLevels = await this.ensureInventoryLevels(updates)

    const levelMap = inventoryLevels.reduce((acc, curr) => {
      const inventoryLevelMap = acc.get(curr.inventory_item_id) ?? new Map()
      inventoryLevelMap.set(curr.location_id, curr.id)
      acc.set(curr.inventory_item_id, inventoryLevelMap)
      return acc
    }, new Map())

    const result = await promiseAll(
      updates.map(async (update) => {
        const levelId = levelMap
          .get(update.inventory_item_id)
          .get(update.location_id)

        // TODO make this bulk
        return this.inventoryLevelService_.update(levelId, update, context)
      })
    )

    await this.emitEvents_(context?.messageAggregator?.getMessages())

    return result
  }

  /**
   * Updates an inventory level
   * @param inventoryItemId - the id of the inventory item associated with the level
   * @param locationId - the id of the location associated with the level
   * @param input - the input object
   * @param context
   * @return The updated inventory level
   */
  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  async updateInventoryLevel(
    inventoryItemId: string,
    locationIdOrContext?: string,
    input?: UpdateInventoryLevelInput,
    @MedusaContext() context: Context<EntityManager> = {}
  ): Promise<InventoryLevelDTO> {
    const updates: BulkUpdateInventoryLevelInput[] = [
      {
        inventory_item_id: inventoryItemId,
        location_id: locationIdOrContext as string,
        ...input,
      },
    ]

    const [result] = await this.updateInventoryLevels(updates, context)

    return result
  }

  /**
   * Updates a reservation item
   * @param reservationItemId
   * @param input - the input object
   * @param context
   * @param context
   * @return The updated inventory level
   */
  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  @InjectIntoContext({
    messageAggregator: new MessageAggregator(),
  })
  async updateReservationItem(
    reservationItemId: string,
    input: UpdateReservationItemInput,
    @MedusaContext() context: InternalContext = {}
  ): Promise<ReservationItemDTO> {
    const result = await this.reservationItemService_.update(
      reservationItemId,
      input,
      context
    )

    await this.emitEvents_(context?.messageAggregator?.getMessages())

    return result
  }

  /**
   * Deletes reservation items by line item
   * @param lineItemId - the id of the line item associated with the reservation item
   * @param context
   */
  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  @InjectIntoContext({
    messageAggregator: new MessageAggregator(),
  })
  async deleteReservationItemsByLineItem(
    lineItemId: string | string[],
    @MedusaContext() context: InternalContext = {}
  ): Promise<void> {
    await this.reservationItemService_.deleteByLineItem(lineItemId, context)

    await this.emitEvents_(context?.messageAggregator?.getMessages())
  }

  /**
   * Deletes a reservation item
   * @param reservationItemId - the id of the reservation item to delete
   * @param context
   */
  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  @InjectIntoContext({
    messageAggregator: new MessageAggregator(),
  })
  async deleteReservationItem(
    reservationItemId: string | string[],
    @MedusaContext() context: InternalContext = {}
  ): Promise<void> {
    await this.reservationItemService_.delete(reservationItemId, context)

    await this.emitEvents_(context?.messageAggregator?.getMessages())
  }

  /**
   * Adjusts the inventory level for a given inventory item and location.
   * @param inventoryItemId - the id of the inventory item
   * @param locationId - the id of the location
   * @param adjustment - the number to adjust the inventory by (can be positive or negative)
   * @param context
   * @return The updated inventory level
   * @throws when the inventory level is not found
   */
  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  async adjustInventory(
    inventoryItemId: string,
    locationId: string,
    adjustment: number,
    @MedusaContext() context: Context<EntityManager> = {}
  ): Promise<InventoryLevelDTO> {
    const [inventoryLevel] = await this.inventoryLevelService_.list(
      { inventory_item_id: inventoryItemId, location_id: locationId },
      { take: 1 },
      context
    )
    if (!inventoryLevel) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Inventory level for inventory item ${inventoryItemId} and location ${locationId} not found`
      )
    }

    const updatedInventoryLevel = await this.inventoryLevelService_.update(
      inventoryLevel.id,
      {
        stocked_quantity: inventoryLevel.stocked_quantity + adjustment,
      },
      context
    )

    return { ...updatedInventoryLevel }
  }

  /**
   * Retrieves the available quantity of a given inventory item in a given location.
   * @param inventoryItemId - the id of the inventory item
   * @param locationIds - the ids of the locations to check
   * @param context
   * @return The available quantity
   * @throws when the inventory item is not found
   */
  async retrieveAvailableQuantity(
    inventoryItemId: string,
    locationIds: string[],
    context: Context<EntityManager> = {}
  ): Promise<number> {
    // Throws if item does not exist
    await this.inventoryItemService_.retrieve(
      inventoryItemId,
      {
        select: ["id"],
      },
      context
    )

    if (locationIds.length === 0) {
      return 0
    }

    const availableQuantity =
      await this.inventoryLevelService_.getAvailableQuantity(
        inventoryItemId,
        locationIds,
        context
      )

    return availableQuantity
  }

  /**
   * Retrieves the stocked quantity of a given inventory item in a given location.
   * @param inventoryItemId - the id of the inventory item
   * @param locationIds - the ids of the locations to check
   * @param context
   * @return The stocked quantity
   * @throws when the inventory item is not found
   */
  async retrieveStockedQuantity(
    inventoryItemId: string,
    locationIds: string[],
    context: Context<EntityManager> = {}
  ): Promise<number> {
    // Throws if item does not exist
    await this.inventoryItemService_.retrieve(
      inventoryItemId,
      {
        select: ["id"],
      },
      context
    )

    if (locationIds.length === 0) {
      return 0
    }

    const stockedQuantity =
      await this.inventoryLevelService_.getStockedQuantity(
        inventoryItemId,
        locationIds,
        context
      )

    return stockedQuantity
  }

  /**
   * Retrieves the reserved quantity of a given inventory item in a given location.
   * @param inventoryItemId - the id of the inventory item
   * @param locationIds - the ids of the locations to check
   * @param context
   * @return The reserved quantity
   * @throws when the inventory item is not found
   */
  async retrieveReservedQuantity(
    inventoryItemId: string,
    locationIds: string[],
    context: Context<EntityManager> = {}
  ): Promise<number> {
    // Throws if item does not exist
    await this.inventoryItemService_.retrieve(
      inventoryItemId,
      {
        select: ["id"],
      },
      context
    )

    if (locationIds.length === 0) {
      return 0
    }

    const reservedQuantity =
      await this.inventoryLevelService_.getReservedQuantity(
        inventoryItemId,
        locationIds,
        context
      )

    return reservedQuantity
  }

  /**
   * Confirms whether there is sufficient inventory for a given quantity of a given inventory item in a given location.
   * @param inventoryItemId - the id of the inventory item
   * @param locationIds - the ids of the locations to check
   * @param quantity - the quantity to check
   * @param context
   * @return Whether there is sufficient inventory
   */
  @InjectEntityManager(
    (target) =>
      target.moduleDeclaration?.resources === MODULE_RESOURCE_TYPE.ISOLATED
  )
  async confirmInventory(
    inventoryItemId: string,
    locationIds: string[],
    quantity: number,
    @MedusaContext() context: Context<EntityManager> = {}
  ): Promise<boolean> {
    const availableQuantity = await this.retrieveAvailableQuantity(
      inventoryItemId,
      locationIds,
      context
    )
    return availableQuantity >= quantity
  }

  private async emitEvents_(groupedEvents) {
    if (!this.eventBusService_) {
      return
    }

    const promises: Promise<unknown>[] = []
    for (const group of Object.keys(groupedEvents)) {
      promises.push(this.eventBusService_?.emit(groupedEvents[group]))
    }

    await Promise.all(promises)
  }
}
