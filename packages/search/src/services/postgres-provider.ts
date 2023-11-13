import {
  Context,
  Message,
  RemoteQueryFunction,
  Subscriber,
} from "@medusajs/types"
import {
  InjectManager,
  InjectTransactionManager,
  isDefined,
  MedusaContext,
  MikroOrmBaseRepository as BaseRepository,
  remoteQueryObjectFromString,
} from "@medusajs/utils"
import { EntityManager, SqlEntityManager } from "@mikro-orm/postgresql"
import { Catalog, CatalogRelation } from "@models"
import {
  EntityNameModuleConfigMap,
  QueryFormat,
  QueryOptions,
  SchemaObjectEntityRepresentation,
  SchemaObjectRepresentation,
  SearchModuleOptions,
} from "../types"
import { createPartitions, QueryBuilder } from "../utils"

type InjectedDependencies = {
  manager: EntityManager
  remoteQuery: RemoteQueryFunction
  baseRepository: BaseRepository
}

export class PostgresProvider {
  #isReady_: Promise<boolean>

  protected readonly eventActionToMethodMap_ = {
    created: "onCreate",
    updated: "onUpdate",
    deleted: "onDelete",
    attached: "onAttach",
    detached: "onDetach",
  }

  protected container_: InjectedDependencies
  protected readonly schemaObjectRepresentation_: SchemaObjectRepresentation
  protected readonly schemaEntitiesMap_: Record<string, any>
  protected readonly moduleOptions_: SearchModuleOptions
  protected readonly manager_: SqlEntityManager
  protected readonly remoteQuery_: RemoteQueryFunction
  protected baseRepository_: BaseRepository

  constructor(
    { manager, remoteQuery, baseRepository }: InjectedDependencies,
    options: {
      schemaObjectRepresentation: SchemaObjectRepresentation
      entityMap: Record<string, any>
    },
    moduleOptions: SearchModuleOptions
  ) {
    this.manager_ = manager
    this.remoteQuery_ = remoteQuery
    this.moduleOptions_ = moduleOptions
    this.baseRepository_ = baseRepository

    this.schemaObjectRepresentation_ = options.schemaObjectRepresentation
    this.schemaEntitiesMap_ = options.entityMap

    // Add a new column for each key that can be found in the jsonb data column to perform indexes and query on it.
    // So far, the execution time is about the same
    /*;(async () => {
      const query = [
        ...new Set(
          Object.keys(this.schemaObjectRepresentation_)
            .filter(
              (key) =>
                ![
                  "_serviceNameModuleConfigMap",
                  "_schemaPropertiesMap",
                ].includes(key)
            )
            .map((key) => {
              return this.schemaObjectRepresentation_[key].fields.filter(
                (field) => !field.includes(".")
              )
            })
            .flat()
        ),
      ].map(
        (field) =>
          "ALTER TABLE catalog ADD IF NOT EXISTS " +
          field +
          " text GENERATED ALWAYS AS (NEW.data->>'" +
          field +
          "') STORED"
      )
      await this.manager_.execute(query.join(";"))
    })()*/
  }

  async onApplicationStart() {
    let initalizedOk: (value: any) => void = () => {}
    let initalizedNok: (value: any) => void = () => {}
    this.#isReady_ = new Promise((resolve, reject) => {
      initalizedOk = resolve
      initalizedNok = reject
    })

    await createPartitions(
      this.schemaObjectRepresentation_,
      this.manager_.fork()
    )
      .then(initalizedOk)
      .catch(initalizedNok)
  }

  protected static parseData<
    TData extends { id: string; [key: string]: unknown }
  >(
    data: TData | TData[],
    schemaEntityObjectRepresentation: SchemaObjectEntityRepresentation
  ) {
    const data_ = Array.isArray(data) ? data : [data]

    // Always keep the id in the entity properties
    const entityProperties: string[] = ["id"]
    const parentsProperties: { [entity: string]: string[] } = {}

    /**
     * Split fields into entity properties and parents properties
     */

    schemaEntityObjectRepresentation.fields.forEach((field) => {
      if (field.includes(".")) {
        const parentAlias = field.split(".")[0]
        const parentSchemaObjectRepresentation =
          schemaEntityObjectRepresentation.parents.find(
            (parent) => parent.ref.alias === parentAlias
          )

        if (!parentSchemaObjectRepresentation) {
          throw new Error(
            `SearchModule error, unable to parse data for ${schemaEntityObjectRepresentation.entity}. The parent schema object representation could not be found for the alias ${parentAlias} for the entity ${schemaEntityObjectRepresentation.entity}.`
          )
        }

        parentsProperties[parentSchemaObjectRepresentation.ref.entity] ??= []
        parentsProperties[parentSchemaObjectRepresentation.ref.entity].push(
          field
        )
      } else {
        entityProperties.push(field)
      }
    })

    return {
      data: data_,
      entityProperties,
      parentsProperties,
    }
  }

  protected static parseMessageData<T>(message?: Message<T>["body"]): {
    action: string
    data: { id: string }[]
    ids: string[]
  } | void {
    const isMessageShape =
      isDefined((message as Message["body"])?.metadata) &&
      isDefined((message as Message["body"])?.data)

    if (!isMessageShape) {
      return
    }

    const result: {
      action: string
      data: { id: string }[]
      ids: string[]
    } = {
      action: "",
      data: [],
      ids: [],
    }

    result.action = (message as Message["body"]).metadata.action
    result.data = (message as Message["body"]).data as { id: string }[]
    result.data = Array.isArray(result.data) ? result.data : [result.data]
    result.ids = result.data.map((d) => d.id)

    return result
  }

  @InjectManager("baseRepository_")
  async query(
    selection: QueryFormat,
    options?: QueryOptions,
    @MedusaContext() sharedContext: Context = {}
  ) {
    await this.#isReady_

    const { manager } = sharedContext as { manager: SqlEntityManager }
    let hasPagination = false
    if (
      typeof options?.take === "number" ||
      typeof options?.skip === "number"
    ) {
      hasPagination = true
    }

    const connection = manager.getConnection()
    const qb = new QueryBuilder({
      schema: this.schemaObjectRepresentation_,
      entityMap: this.schemaEntitiesMap_,
      knex: connection.getKnex(),
      selector: selection,
      options,
    })

    const sql = qb.buildQuery(hasPagination, !!options?.keepFilteredEntities)

    let resultset = await manager.execute(sql)

    if (options?.keepFilteredEntities) {
      const mainEntity = Object.keys(selection.select)[0]

      const ids = resultset.map((r) => r[`${mainEntity}.id`])
      if (ids.length) {
        const selection_ = {
          select: selection.select,
          joinWhere: selection.joinWhere,
          where: {
            [`${mainEntity}.id`]: ids,
          },
        }
        return await this.query(selection_, undefined, sharedContext)
      }
    }

    return qb.buildObjectFromResultset(resultset)
  }

  @InjectManager("baseRepository_")
  async queryAndCount(
    selection: QueryFormat,
    options?: QueryOptions,
    @MedusaContext() sharedContext: Context = {}
  ) {
    await this.#isReady_

    const { manager } = sharedContext as { manager: SqlEntityManager }
    const connection = manager.getConnection()
    const qb = new QueryBuilder({
      schema: this.schemaObjectRepresentation_,
      entityMap: this.schemaEntitiesMap_,
      knex: connection.getKnex(),
      selector: selection,
      options,
    })

    const sql = qb.buildQuery(true, !!options?.keepFilteredEntities)
    let resultset = await connection.execute(sql)

    const count = +(resultset[0]?.count ?? 0)

    if (options?.keepFilteredEntities) {
      const mainEntity = Object.keys(selection.select)[0]

      const ids = resultset.map((r) => r[`${mainEntity}.id`])
      if (ids.length) {
        const selection_ = {
          select: selection.select,
          joinWhere: selection.joinWhere,
          where: {
            [`${mainEntity}.id`]: ids,
          },
        }
        return [await this.query(selection_, undefined, sharedContext), count]
      }
    }

    return [qb.buildObjectFromResultset(resultset), count]
  }

  consumeEvent(
    schemaEntityObjectRepresentation: SchemaObjectEntityRepresentation
  ): Subscriber {
    return async (data: Message<unknown> | unknown, eventName: string) => {
      await this.#isReady_

      const data_: { id: string }[] = Array.isArray(data) ? data : [data]
      let ids: string[] = data_.map((d) => d.id)
      let action = eventName.split(".").pop() || ""

      const parsedMessage = PostgresProvider.parseMessageData(
        data as Message["body"]
      )
      if (parsedMessage) {
        action = parsedMessage.action
        ids = parsedMessage.ids
      }

      const { fields, alias } = schemaEntityObjectRepresentation
      const entityData = await this.remoteQuery_(
        remoteQueryObjectFromString({
          entryPoint: alias,
          variables: {
            filters: {
              id: ids,
            },
          },
          fields: [...new Set(["id", ...fields])],
        })
      )

      const argument = {
        entity: schemaEntityObjectRepresentation.entity,
        data: entityData,
        schemaEntityObjectRepresentation,
      }

      const targetMethod = this.eventActionToMethodMap_[action]

      if (!targetMethod) {
        return
      }

      await this[targetMethod](argument)
    }
  }

  /**
   * Create the catalog entry and the catalog relation entry when this event is emitted.
   * @param entity
   * @param data
   * @param schemaEntityObjectRepresentation
   * @param sharedContext
   * @protected
   */
  @InjectTransactionManager("baseRepository_")
  protected async onCreate<
    TData extends { id: string; [key: string]: unknown }
  >(
    {
      entity,
      data,
      schemaEntityObjectRepresentation,
    }: {
      entity: string
      data: TData | TData[]
      schemaEntityObjectRepresentation: SchemaObjectEntityRepresentation
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const { transactionManager: em } = sharedContext as {
      transactionManager: SqlEntityManager
    }
    const catalogRepository = em.getRepository(Catalog)
    const catalogRelationRepository = em.getRepository(CatalogRelation)

    const {
      data: data_,
      entityProperties,
      parentsProperties,
    } = PostgresProvider.parseData(data, schemaEntityObjectRepresentation)

    /**
     * Loop through the data and create catalog entries for each entity as well as the
     * catalog relation entries if the entity has parents
     */

    for (const entityData of data_) {
      /**
       * Clean the entity data to only keep the properties that are defined in the schema
       */

      const cleanedEntityData = entityProperties.reduce((acc, property) => {
        acc[property] = entityData[property]
        return acc
      }, {}) as TData

      await catalogRepository.upsert({
        id: cleanedEntityData.id,
        name: entity,
        data: cleanedEntityData,
      })

      /**
       * Retrieve the parents to attach it to the catalog entry.
       */

      for (const [parentEntity, parentProperties] of Object.entries(
        parentsProperties
      )) {
        const parentAlias = parentProperties[0].split(".")[0]
        const parentData = entityData[parentAlias] as TData[]

        if (!parentData) {
          continue
        }

        const parentDataCollection = Array.isArray(parentData)
          ? parentData
          : [parentData]

        for (const parentData_ of parentDataCollection) {
          await catalogRepository.upsert({
            id: (parentData_ as any).id,
            name: parentEntity,
            data: parentData_,
          })

          const parentCatalogRelationEntry = catalogRelationRepository.create({
            parent_id: (parentData_ as any).id,
            parent_name: parentEntity,
            child_id: cleanedEntityData.id,
            child_name: entity,
            pivot: `${parentEntity}-${entity}`,
          })
          catalogRelationRepository.persist(parentCatalogRelationEntry)
        }
      }
    }
  }

  /**
   * Update the catalog entry when this event is emitted.
   * @param entity
   * @param data
   * @param schemaEntityObjectRepresentation
   * @param sharedContext
   * @protected
   */
  @InjectTransactionManager("baseRepository_")
  protected async onUpdate<
    TData extends { id: string; [key: string]: unknown }
  >(
    {
      entity,
      data,
      schemaEntityObjectRepresentation,
    }: {
      entity: string
      data: TData | TData[]
      schemaEntityObjectRepresentation: SchemaObjectEntityRepresentation
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const { transactionManager: em } = sharedContext as {
      transactionManager: SqlEntityManager
    }
    const catalogRepository = em.getRepository(Catalog)

    const { data: data_, entityProperties } = PostgresProvider.parseData(
      data,
      schemaEntityObjectRepresentation
    )

    await catalogRepository.upsertMany(
      data_.map((entityData) => {
        return {
          id: entityData.id,
          name: entity,
          data: entityProperties.reduce((acc, property) => {
            acc[property] = entityData[property]
            return acc
          }, {}),
        }
      })
    )
  }

  /**
   * Delete the catalog entry when this event is emitted.
   * @param entity
   * @param data
   * @param schemaEntityObjectRepresentation
   * @param sharedContext
   * @protected
   */
  @InjectTransactionManager("baseRepository_")
  protected async onDelete<
    TData extends { id: string; [key: string]: unknown }
  >(
    {
      entity,
      data,
      schemaEntityObjectRepresentation,
    }: {
      entity: string
      data: TData | TData[]
      schemaEntityObjectRepresentation: SchemaObjectEntityRepresentation
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const { transactionManager: em } = sharedContext as {
      transactionManager: SqlEntityManager
    }
    const catalogRepository = em.getRepository(Catalog)
    const catalogRelationRepository = em.getRepository(CatalogRelation)

    const { data: data_ } = PostgresProvider.parseData(
      data,
      schemaEntityObjectRepresentation
    )

    const ids = data_.map((entityData) => entityData.id)

    await catalogRepository.nativeDelete({
      id: { $in: ids },
      name: entity,
    })

    await catalogRelationRepository.nativeDelete({
      $or: [
        {
          parent_id: { $in: ids },
          parent_name: entity,
        },
        {
          child_id: { $in: ids },
          child_name: entity,
        },
      ],
    })
  }

  /**
   * event emitted from the link modules to attach a link entity to its parent and child entities from the linked modules.
   * @param entity
   * @param data
   * @param schemaEntityObjectRepresentation
   * @protected
   */
  @InjectTransactionManager("baseRepository_")
  protected async onAttach<
    TData extends { id: string; [key: string]: unknown }
  >(
    {
      entity,
      data,
      schemaEntityObjectRepresentation,
    }: {
      entity: string
      data: TData | TData[]
      schemaEntityObjectRepresentation: SchemaObjectEntityRepresentation
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const { transactionManager: em } = sharedContext as {
      transactionManager: SqlEntityManager
    }
    const catalogRepository = em.getRepository(Catalog)
    const catalogRelationRepository = em.getRepository(CatalogRelation)

    const { data: data_, entityProperties } = PostgresProvider.parseData(
      data,
      schemaEntityObjectRepresentation
    )

    /**
     * Retrieve the property that represent the foreign key related to the parent entity of the link entity.
     * Then from the service name of the parent entity, retrieve the entity name using the linkable keys.
     */

    const parentPropertyId =
      schemaEntityObjectRepresentation.moduleConfig.relationships![0].foreignKey
    const parentServiceName =
      schemaEntityObjectRepresentation.moduleConfig.relationships![0]
        .serviceName
    const parentEntityName = (
      this.schemaObjectRepresentation_._serviceNameModuleConfigMap[
        parentServiceName
      ] as EntityNameModuleConfigMap[0]
    ).linkableKeys?.[parentPropertyId]

    if (!parentEntityName) {
      throw new Error(
        `SearchModule error, unable to handle attach event for ${entity}. The parent entity name could not be found using the linkable keys from the module ${parentServiceName}.`
      )
    }

    /**
     * Retrieve the property that represent the foreign key related to the child entity of the link entity.
     * Then from the service name of the child entity, retrieve the entity name using the linkable keys.
     */

    const childPropertyId =
      schemaEntityObjectRepresentation.moduleConfig.relationships![1].foreignKey
    const childServiceName =
      schemaEntityObjectRepresentation.moduleConfig.relationships![1]
        .serviceName
    const childEntityName = (
      this.schemaObjectRepresentation_._serviceNameModuleConfigMap[
        childServiceName
      ] as EntityNameModuleConfigMap[0]
    ).linkableKeys?.[childPropertyId]

    if (!childEntityName) {
      throw new Error(
        `SearchModule error, unable to handle attach event for ${entity}. The child entity name could not be found using the linkable keys from the module ${childServiceName}.`
      )
    }

    for (const entityData of data_) {
      /**
       * Clean the link entity data to only keep the properties that are defined in the schema
       */

      const cleanedEntityData = entityProperties.reduce((acc, property) => {
        acc[property] = entityData[property]
        return acc
      }, {}) as TData

      await catalogRepository.upsert({
        id: cleanedEntityData.id,
        name: entity,
        data: cleanedEntityData,
      })

      /**
       * Create the catalog relation entries for the parent entity and the child entity
       */

      const parentCatalogRelationEntry = catalogRelationRepository.create({
        parent_id: entityData[parentPropertyId] as string,
        parent_name: parentEntityName,
        child_id: cleanedEntityData.id,
        child_name: entity,
        pivot: `${parentEntityName}-${entity}`,
      })

      const childCatalogRelationEntry = catalogRelationRepository.create({
        parent_id: cleanedEntityData.id,
        parent_name: entity,
        child_id: entityData[childPropertyId] as string,
        child_name: childEntityName,
        pivot: `${entity}-${childEntityName}`,
      })

      catalogRelationRepository.persist([
        parentCatalogRelationEntry,
        childCatalogRelationEntry,
      ])
    }
  }

  /**
   * Event emitted from the link modules to detach a link entity from its parent and child entities from the linked modules.
   * @param entity
   * @param data
   * @param schemaEntityObjectRepresentation
   * @param sharedContext
   * @protected
   */
  @InjectTransactionManager("baseRepository_")
  protected async onDetach<
    TData extends { id: string; [key: string]: unknown }
  >(
    {
      entity,
      data,
      schemaEntityObjectRepresentation,
    }: {
      entity: string
      data: TData | TData[]
      schemaEntityObjectRepresentation: SchemaObjectEntityRepresentation
    },
    @MedusaContext() sharedContext: Context = {}
  ) {
    const { transactionManager: em } = sharedContext as {
      transactionManager: SqlEntityManager
    }
    const catalogRepository = em.getRepository(Catalog)
    const catalogRelationRepository = em.getRepository(CatalogRelation)

    const { data: data_ } = PostgresProvider.parseData(
      data,
      schemaEntityObjectRepresentation
    )

    const ids = data_.map((entityData) => entityData.id)

    await catalogRepository.nativeDelete({
      id: { $in: ids },
      name: entity,
    })

    await catalogRelationRepository.nativeDelete({
      $or: [
        {
          parent_id: { $in: ids },
          parent_name: entity,
        },
        {
          child_id: { $in: ids },
          child_name: entity,
        },
      ],
    })
  }
}
