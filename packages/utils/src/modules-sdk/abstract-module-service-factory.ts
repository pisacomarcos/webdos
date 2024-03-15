/**
 * Utility factory and interfaces for module service public facing API
 */
import {
  Constructor,
  Context,
  FindConfig,
  IEventBusModuleService,
  Pluralize,
  RepositoryService,
  RestoreReturn,
  SoftDeleteReturn,
} from "@medusajs/types"
import {
  MapToConfig,
  isString,
  kebabCase,
  lowerCaseFirst,
  mapObjectTo,
  pluralize,
  upperCaseFirst,
} from "../common"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
} from "./decorators"

type BaseMethods =
  | "retrieve"
  | "list"
  | "listAndCount"
  | "delete"
  | "softDelete"
  | "restore"

const readMethods = ["retrieve", "list", "listAndCount"] as BaseMethods[]
const writeMethods = ["delete", "softDelete", "restore"] as BaseMethods[]

const methods: BaseMethods[] = [...readMethods, ...writeMethods]

type ModelsConfigTemplate = {
  [ModelName: string]: { singular?: string; plural?: string; dto: object }
}

type ExtractSingularName<
  T extends Record<any, any>,
  K = keyof T
> = T[K] extends { singular?: string } ? T[K]["singular"] : K

type ExtractPluralName<T extends Record<any, any>, K = keyof T> = T[K] extends {
  plural?: string
}
  ? T[K]["plural"]
  : Pluralize<K & string>

type ModelConfiguration =
  | Constructor<any>
  | { singular?: string; plural?: string; model: Constructor<any> }

export interface AbstractModuleServiceBase<TContainer, TMainModelDTO> {
  get __container__(): TContainer

  retrieve(
    id: string,
    config?: FindConfig<any>,
    sharedContext?: Context
  ): Promise<TMainModelDTO>

  list(
    filters?: any,
    config?: FindConfig<any>,
    sharedContext?: Context
  ): Promise<TMainModelDTO[]>

  listAndCount(
    filters?: any,
    config?: FindConfig<any>,
    sharedContext?: Context
  ): Promise<[TMainModelDTO[], number]>

  delete(
    primaryKeyValues: string | object | string[] | object[],
    sharedContext?: Context
  ): Promise<void>

  softDelete<TReturnableLinkableKeys extends string>(
    primaryKeyValues: string | object | string[] | object[],
    config?: SoftDeleteReturn<TReturnableLinkableKeys>,
    sharedContext?: Context
  ): Promise<Record<string, string[]> | void>

  restore<TReturnableLinkableKeys extends string>(
    primaryKeyValues: string | object | string[] | object[],
    config?: RestoreReturn<TReturnableLinkableKeys>,
    sharedContext?: Context
  ): Promise<Record<string, string[]> | void>
}

export type AbstractModuleService<
  TContainer,
  TMainModelDTO,
  TOtherModelNamesAndAssociatedDTO extends ModelsConfigTemplate
> = AbstractModuleServiceBase<TContainer, TMainModelDTO> & {
  [K in keyof TOtherModelNamesAndAssociatedDTO as `retrieve${ExtractSingularName<
    TOtherModelNamesAndAssociatedDTO,
    K
  > &
    string}`]: (
    id: string,
    config?: FindConfig<any>,
    sharedContext?: Context
  ) => Promise<TOtherModelNamesAndAssociatedDTO[K & string]["dto"]>
} & {
  [K in keyof TOtherModelNamesAndAssociatedDTO as `list${ExtractPluralName<
    TOtherModelNamesAndAssociatedDTO,
    K
  > &
    string}`]: (
    filters?: any,
    config?: FindConfig<any>,
    sharedContext?: Context
  ) => Promise<TOtherModelNamesAndAssociatedDTO[K & string]["dto"][]>
} & {
  [K in keyof TOtherModelNamesAndAssociatedDTO as `listAndCount${ExtractPluralName<
    TOtherModelNamesAndAssociatedDTO,
    K
  > &
    string}`]: {
    (filters?: any, config?: FindConfig<any>, sharedContext?: Context): Promise<
      [TOtherModelNamesAndAssociatedDTO[K & string]["dto"][], number]
    >
  }
} & {
  [K in keyof TOtherModelNamesAndAssociatedDTO as `delete${ExtractPluralName<
    TOtherModelNamesAndAssociatedDTO,
    K
  > &
    string}`]: {
    (
      primaryKeyValues: string | object | string[] | object[],
      sharedContext?: Context
    ): Promise<void>
  }
} & {
  [K in keyof TOtherModelNamesAndAssociatedDTO as `softDelete${ExtractPluralName<
    TOtherModelNamesAndAssociatedDTO,
    K
  > &
    string}`]: {
    <TReturnableLinkableKeys extends string>(
      primaryKeyValues: string | object | string[] | object[],
      config?: SoftDeleteReturn<TReturnableLinkableKeys>,
      sharedContext?: Context
    ): Promise<Record<string, string[]> | void>
  }
} & {
  [K in keyof TOtherModelNamesAndAssociatedDTO as `restore${ExtractPluralName<
    TOtherModelNamesAndAssociatedDTO,
    K
  > &
    string}`]: {
    <TReturnableLinkableKeys extends string>(
      primaryKeyValues: string | object | string[] | object[],
      config?: RestoreReturn<TReturnableLinkableKeys>,
      sharedContext?: Context
    ): Promise<Record<string, string[]> | void>
  }
}

/**
 * Factory function for creating an abstract module service
 *
 * @example
 *
 * const otherModels = new Set([
 *   Currency,
 *   MoneyAmount,
 *   PriceList,
 *   PriceListRule,
 *   PriceListRuleValue,
 *   PriceRule,
 *   PriceSetMoneyAmount,
 *   PriceSetMoneyAmountRules,
 *   PriceSetRuleType,
 *   RuleType,
 * ])
 *
 * const AbstractModuleService = ModulesSdkUtils.abstractModuleServiceFactory<
 *   InjectedDependencies,
 *   PricingTypes.PriceSetDTO,
 *   // The configuration of each entity also accept singular/plural properties, if not provided then it is using english pluralization
 *   {
 *     Currency: { dto: PricingTypes.CurrencyDTO }
 *     MoneyAmount: { dto: PricingTypes.MoneyAmountDTO }
 *     PriceSetMoneyAmount: { dto: PricingTypes.PriceSetMoneyAmountDTO }
 *     PriceSetMoneyAmountRules: {
 *       dto: PricingTypes.PriceSetMoneyAmountRulesDTO
 *     }
 *     PriceRule: { dto: PricingTypes.PriceRuleDTO }
 *     RuleType: { dto: PricingTypes.RuleTypeDTO }
 *     PriceList: { dto: PricingTypes.PriceListDTO }
 *     PriceListRule: { dto: PricingTypes.PriceListRuleDTO }
 *   }
 * >(PriceSet, [...otherModels], entityNameToLinkableKeysMap)
 *
 * @param mainModel
 * @param otherModels
 * @param entityNameToLinkableKeysMap
 */
export function abstractModuleServiceFactory<
  TContainer,
  TMainModelDTO,
  TOtherModelNamesAndAssociatedDTO extends ModelsConfigTemplate
>(
  mainModel: Constructor<any>,
  otherModels: ModelConfiguration[],
  entityNameToLinkableKeysMap: MapToConfig = {}
): {
  new (container: TContainer): AbstractModuleService<
    TContainer,
    TMainModelDTO,
    TOtherModelNamesAndAssociatedDTO
  >
} {
  const buildMethodNamesFromModel = (
    model: ModelConfiguration,
    suffixed: boolean = true
  ): Record<string, string> => {
    return methods.reduce((acc, method) => {
      let modelName: string = ""

      if (method === "retrieve") {
        modelName =
          "singular" in model && model.singular
            ? model.singular
            : (model as Constructor<any>).name
      } else {
        modelName =
          "plural" in model && model.plural
            ? model.plural
            : pluralize((model as Constructor<any>).name)
      }

      const methodName = suffixed
        ? `${method}${upperCaseFirst(modelName)}`
        : method

      return { ...acc, [method]: methodName }
    }, {})
  }

  const buildAndAssignMethodImpl = function (
    klassPrototype: any,
    method: string,
    methodName: string,
    model: Constructor<any>
  ): void {
    const serviceRegistrationName = `${lowerCaseFirst(model.name)}Service`

    const applyMethod = function (impl: Function, contextIndex) {
      klassPrototype[methodName] = impl

      const descriptorMockRef = {
        value: klassPrototype[methodName],
      }

      MedusaContext()(klassPrototype, methodName, contextIndex)

      const ManagerDecorator = readMethods.includes(method as BaseMethods)
        ? InjectManager
        : InjectTransactionManager

      ManagerDecorator("baseRepository_")(
        klassPrototype,
        methodName,
        descriptorMockRef
      )

      klassPrototype[methodName] = descriptorMockRef.value
    }

    let methodImplementation: any = function () {
      void 0
    }

    switch (method) {
      case "retrieve":
        methodImplementation = async function <T extends object>(
          this: AbstractModuleService_,
          id: string,
          config?: FindConfig<any>,
          sharedContext: Context = {}
        ): Promise<T> {
          const entities = await this.__container__[
            serviceRegistrationName
          ].retrieve(id, config, sharedContext)

          return await this.baseRepository_.serialize<T>(entities, {
            populate: "*",
          })
        }

        applyMethod(methodImplementation, 2)

        break
      case "list":
        methodImplementation = async function <T extends object>(
          this: AbstractModuleService_,
          filters = {},
          config: FindConfig<any> = {},
          sharedContext: Context = {}
        ): Promise<T[]> {
          const service = this.__container__[serviceRegistrationName]
          const entities = await service.list(filters, config, sharedContext)

          return await this.baseRepository_.serialize<T[]>(entities, {
            populate: "*",
          })
        }

        applyMethod(methodImplementation, 2)

        break
      case "listAndCount":
        methodImplementation = async function <T extends object>(
          this: AbstractModuleService_,
          filters = {},
          config: FindConfig<any> = {},
          sharedContext: Context = {}
        ): Promise<T[]> {
          const [entities, count] = await this.__container__[
            serviceRegistrationName
          ].listAndCount(filters, config, sharedContext)

          return [
            await this.baseRepository_.serialize<T[]>(entities, {
              populate: "*",
            }),
            count,
          ]
        }

        applyMethod(methodImplementation, 2)

        break
      case "delete":
        methodImplementation = async function (
          this: AbstractModuleService_,
          primaryKeyValues: string | object | string[] | object[],
          sharedContext: Context = {}
        ): Promise<void> {
          const primaryKeyValues_ = Array.isArray(primaryKeyValues)
            ? primaryKeyValues
            : [primaryKeyValues]
          await this.__container__[serviceRegistrationName].delete(
            primaryKeyValues_,
            sharedContext
          )

          await this.eventBusModuleService_?.emit(
            primaryKeyValues_.map((primaryKeyValue) => ({
              eventName: `${kebabCase(model.name)}.deleted`,
              data: isString(primaryKeyValue)
                ? { id: primaryKeyValue }
                : primaryKeyValue,
            }))
          )
        }

        applyMethod(methodImplementation, 1)

        break
      case "softDelete":
        methodImplementation = async function <T extends { id: string }>(
          this: AbstractModuleService_,
          primaryKeyValues: string | object | string[] | object[],
          config: SoftDeleteReturn<string> = {},
          sharedContext: Context = {}
        ): Promise<Record<string, string[]> | void> {
          const primaryKeyValues_ = Array.isArray(primaryKeyValues)
            ? primaryKeyValues
            : [primaryKeyValues]

          const [entities, cascadedEntitiesMap] = await this.__container__[
            serviceRegistrationName
          ].softDelete(primaryKeyValues_, sharedContext)

          const softDeletedEntities = await this.baseRepository_.serialize<T[]>(
            entities,
            {
              populate: "*",
            }
          )

          await this.eventBusModuleService_?.emit(
            softDeletedEntities.map(({ id }) => ({
              eventName: `${kebabCase(model.name)}.deleted`,
              data: { id },
            }))
          )

          let mappedCascadedEntitiesMap
          if (config.returnLinkableKeys) {
            // Map internal table/column names to their respective external linkable keys
            // eg: product.id = product_id, variant.id = variant_id
            mappedCascadedEntitiesMap = mapObjectTo(
              cascadedEntitiesMap,
              entityNameToLinkableKeysMap,
              {
                pick: config.returnLinkableKeys,
              }
            )
          }

          return mappedCascadedEntitiesMap ? mappedCascadedEntitiesMap : void 0
        }

        applyMethod(methodImplementation, 2)

        break
      case "restore":
        methodImplementation = async function <T extends object>(
          this: AbstractModuleService_,
          primaryKeyValues: string | object | string[] | object[],
          config: RestoreReturn<string> = {},
          sharedContext: Context = {}
        ): Promise<Record<string, string[]> | void> {
          const primaryKeyValues_ = Array.isArray(primaryKeyValues)
            ? primaryKeyValues
            : [primaryKeyValues]

          const [_, cascadedEntitiesMap] = await this.__container__[
            serviceRegistrationName
          ].restore(primaryKeyValues_, sharedContext)

          let mappedCascadedEntitiesMap
          if (config.returnLinkableKeys) {
            // Map internal table/column names to their respective external linkable keys
            // eg: product.id = product_id, variant.id = variant_id
            mappedCascadedEntitiesMap = mapObjectTo(
              cascadedEntitiesMap,
              entityNameToLinkableKeysMap,
              {
                pick: config.returnLinkableKeys,
              }
            )
          }

          return mappedCascadedEntitiesMap ? mappedCascadedEntitiesMap : void 0
        }

        applyMethod(methodImplementation, 2)

        break
    }
  }

  class AbstractModuleService_ {
    readonly __container__: Record<string, any>
    readonly baseRepository_: RepositoryService
    readonly eventBusModuleService_: IEventBusModuleService;

    [key: string]: any

    constructor(container: Record<string, any>) {
      this.__container__ = container
      this.baseRepository_ = container.baseRepository

      try {
        this.eventBusModuleService_ = container.eventBusModuleService
      } catch {
        /* ignore */
      }
    }

    protected async emitEvents_(groupedEvents) {
      if (!this.eventBusModuleService_ || !groupedEvents) {
        return
      }

      const promises: Promise<void>[] = []
      for (const group of Object.keys(groupedEvents)) {
        promises.push(this.eventBusModuleService_?.emit(groupedEvents[group]))
      }

      await Promise.all(promises)
    }
  }

  const mainModelMethods = buildMethodNamesFromModel(mainModel, false)

  /**
   * Build the main retrieve/list/listAndCount/delete/softDelete/restore methods for the main model
   */

  for (let [method, methodName] of Object.entries(mainModelMethods)) {
    buildAndAssignMethodImpl(
      AbstractModuleService_.prototype,
      method,
      methodName,
      mainModel
    )
  }

  /**
   * Build the retrieve/list/listAndCount/delete/softDelete/restore methods for all the other models
   */

  const otherModelsMethods: [ModelConfiguration, Record<string, string>][] =
    otherModels.map((model) => [model, buildMethodNamesFromModel(model)])

  for (let [model, modelsMethods] of otherModelsMethods) {
    Object.entries(modelsMethods).forEach(([method, methodName]) => {
      model = "model" in model ? model.model : model
      buildAndAssignMethodImpl(
        AbstractModuleService_.prototype,
        method,
        methodName,
        model
      )
    })
  }

  return AbstractModuleService_ as unknown as new (
    container: TContainer
  ) => AbstractModuleService<
    TContainer,
    TMainModelDTO,
    TOtherModelNamesAndAssociatedDTO
  >
}
