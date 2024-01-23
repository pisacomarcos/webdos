/**
 * Utility factory and interfaces for module service public facing API
 */
import {
  Constructor,
  Context,
  FindConfig,
  Pluralize,
  RepositoryService,
  RestoreReturn,
  SoftDeleteReturn,
} from "@medusajs/types"
import { lowerCaseFirst, mapObjectTo, MapToConfig, pluralize } from "../common"
import { InjectManager, InjectTransactionManager } from "./decorators"
import { MedusaContext } from "../decorators"

type BaseMethods =
  | "retrieve"
  | "list"
  | "listAndCount"
  | "delete"
  | "softDelete"
  | "restore"

const methods: BaseMethods[] = [
  "retrieve",
  "list",
  "listAndCount",
  "delete",
  "softDelete",
  "restore",
]

type OtherModelsConfigTemplate = {
  [ModelName: string]: { singular?: string; plural?: string; dto: object }
}

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
    primaryKeyValues: string[] | object[],
    sharedContext?: Context
  ): Promise<void>

  softDelete<TReturnableLinkableKeys extends string>(
    primaryKeyValues: string[] | object[],
    config?: SoftDeleteReturn<TReturnableLinkableKeys>,
    sharedContext?: Context
  ): Promise<Record<string, string[]> | void>

  restore<TReturnableLinkableKeys extends string>(
    primaryKeyValues: string[] | object[],
    config?: RestoreReturn<TReturnableLinkableKeys>,
    sharedContext?: Context
  ): Promise<Record<string, string[]> | void>
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

export type AbstractModuleService<
  TContainer,
  TMainModelDTO,
  TOtherModelNamesAndAssociatedDTO extends OtherModelsConfigTemplate
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
    string}`]: {
    (filters?: any, config?: FindConfig<any>, sharedContext?: Context): Promise<
      TOtherModelNamesAndAssociatedDTO[K & string]["dto"][]
    >
  }
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
      primaryKeyValues: string[] | object[],
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
      primaryKeyValues: string[] | object[],
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
      productIds: string[] | object[],
      config?: RestoreReturn<TReturnableLinkableKeys>,
      sharedContext?: Context
    ): Promise<Record<string, string[]> | void>
  }
}

type OtherModelConfig =
  | Constructor<any>
  | { singular?: string; plural?: string; model: Constructor<any> }

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
  TOtherModelNamesAndAssociatedDTO extends OtherModelsConfigTemplate
>(
  mainModel: Constructor<any>,
  otherModels: OtherModelConfig[],
  entityNameToLinkableKeysMap: MapToConfig = {}
): {
  new (container: TContainer): AbstractModuleService<
    TContainer,
    TMainModelDTO,
    TOtherModelNamesAndAssociatedDTO
  >
} {
  const buildMethodNamesFromModel = (
    model:
      | Constructor<any>
      | { singular?: string; plural?: string; model: Constructor<any> },
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

      const methodName = suffixed ? `${method}${modelName}` : method

      return { ...acc, [method]: methodName }
    }, {})
  }

  const buildAndAssignMethodImpl = function (
    klassPrototype: any,
    method: string,
    methodName: string,
    model: Constructor<any>
  ) {
    const serviceRegistrationName = `${lowerCaseFirst(model.name)}Service`

    switch (method) {
      case "retrieve":
        klassPrototype[methodName] = async function <T extends object>(
          this: AbstractModuleService_,
          id: string,
          config?: FindConfig<any>,
          sharedContext: Context = {}
        ): Promise<T> {
          const entities = await this.__container__[
            serviceRegistrationName
          ].retrieve(id, config, sharedContext)

          return this.baseRepository_.serialize<T>(entities, {
            populate: true,
          })
        }.bind(klassPrototype)

        // Apply MedusaContext decorator
        MedusaContext()(klassPrototype, methodName, 2)

        return InjectManager("baseRepository_")(
          klassPrototype,
          method,
          Object.getOwnPropertyDescriptor(klassPrototype, methodName)!
        )
        break
      case "list":
        klassPrototype[methodName] = async function <T extends object>(
          this: AbstractModuleService_,
          filters = {},
          config: FindConfig<any> = {},
          sharedContext: Context = {}
        ): Promise<T[]> {
          const entities = await this.__container__[
            serviceRegistrationName
          ].list(filters, config, sharedContext)

          return await this.baseRepository_.serialize<T[]>(entities, {
            populate: true,
          })
        }.bind(klassPrototype)

        // Apply MedusaContext decorator
        MedusaContext()(klassPrototype, methodName, 2)

        return InjectManager("baseRepository_")(
          klassPrototype,
          method,
          Object.getOwnPropertyDescriptor(klassPrototype, methodName)!
        )
        break
      case "listAndCount":
        klassPrototype[methodName] = async function <T extends object>(
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
              populate: true,
            }),
            count,
          ]
        }.bind(klassPrototype)

        // Apply MedusaContext decorator
        MedusaContext()(klassPrototype, methodName, 2)

        return InjectManager("baseRepository_")(
          klassPrototype,
          method,
          Object.getOwnPropertyDescriptor(klassPrototype, methodName)!
        )
        break
      case "delete":
        klassPrototype[methodName] = async function (
          this: AbstractModuleService_,
          primaryKeyValues: string[] | object[],
          sharedContext: Context = {}
        ): Promise<void> {
          await this.__container__[serviceRegistrationName].delete(
            primaryKeyValues,
            sharedContext
          )
        }.bind(klassPrototype)

        // Apply MedusaContext decorator
        MedusaContext()(klassPrototype, methodName, 1)

        return InjectTransactionManager("baseRepository_")(
          klassPrototype,
          method,
          Object.getOwnPropertyDescriptor(klassPrototype, methodName)!
        )
        break
      case "softDelete":
        klassPrototype[methodName] = async function <T extends { id: string }>(
          this: AbstractModuleService_,
          primaryKeyValues: string[] | object[],
          config: SoftDeleteReturn<string> = {},
          sharedContext: Context = {}
        ): Promise<Record<string, string[]> | void> {
          const [entities, cascadedEntitiesMap] = await this.__container__[
            serviceRegistrationName
          ].softDelete(primaryKeyValues, sharedContext)

          const softDeletedEntities = await this.baseRepository_.serialize<T[]>(
            entities,
            {
              populate: true,
            }
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
        }.bind(klassPrototype)

        // Apply MedusaContext decorator
        MedusaContext()(klassPrototype, methodName, 2)

        return InjectTransactionManager("baseRepository_")(
          klassPrototype,
          method,
          Object.getOwnPropertyDescriptor(klassPrototype, methodName)!
        )
        break
      case "restore":
        klassPrototype[methodName] = async function <T extends object>(
          this: AbstractModuleService_,
          primaryKeyValues: string[] | object[],
          config: RestoreReturn<string> = {},
          sharedContext: Context = {}
        ): Promise<Record<string, string[]> | void> {
          const [_, cascadedEntitiesMap] = await this.__container__[
            serviceRegistrationName
          ].restore(primaryKeyValues, sharedContext)

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
        }.bind(klassPrototype)

        // Apply MedusaContext decorator
        MedusaContext()(klassPrototype, methodName, 2)

        return InjectTransactionManager("baseRepository_")(
          klassPrototype,
          method,
          Object.getOwnPropertyDescriptor(klassPrototype, methodName)!
        )
        break
      default:
        return function () {
          return void 0
        }
    }
  }

  class AbstractModuleService_ {
    readonly __container__: Record<string, any>
    readonly baseRepository_: RepositoryService;

    [key: string]: any

    constructor(container: Record<string, any>) {
      this.__container__ = container
      this.baseRepository_ = container.baseRepository

      const mainModelMethods = buildMethodNamesFromModel(mainModel, false)

      /**
       * Build the main retrieve/list/listAndCount/delete/softDelete/restore methods for the main model
       */

      for (let [method, methodName] of Object.entries(mainModelMethods)) {
        buildAndAssignMethodImpl(this, method, methodName, mainModel)
      }

      /**
       * Build the retrieve/list/listAndCount/delete/softDelete/restore methods for all the other models
       */

      const otherModelsMethods: [OtherModelConfig, Record<string, string>][] =
        otherModels.map((model) => [model, buildMethodNamesFromModel(model)])

      for (let [model, modelsMethods] of otherModelsMethods) {
        Object.entries(modelsMethods).forEach(([method, methodName]) => {
          model = "model" in model ? model.model : model
          buildAndAssignMethodImpl(this, method, methodName, model)
        })
      }
    }
  }

  return AbstractModuleService_ as unknown as new (
    container: TContainer
  ) => AbstractModuleService<
    TContainer,
    TMainModelDTO,
    TOtherModelNamesAndAssociatedDTO
  >
}
