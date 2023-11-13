import {
  MedusaApp,
  MedusaAppOutput,
  ModulesDefinition,
} from "@medusajs/modules-sdk"
import {
  CommonTypes,
  InternalModuleDeclaration,
  MedusaContainer,
  ModuleDefinition,
} from "@medusajs/types"

import { ContainerRegistrationKeys, isObject } from "@medusajs/utils"
import { asValue } from "awilix"
import { remoteQueryFetchData } from ".."
import { joinerConfig } from "../joiner-config"

export function mergeDefaultModules(
  modulesConfig: CommonTypes.ConfigModule["modules"]
) {
  const defaultModules = Object.values(ModulesDefinition).filter(
    (definition: ModuleDefinition) => {
      return !!definition.defaultPackage
    }
  )

  const configModules = { ...modulesConfig } ?? {}

  for (const defaultModule of defaultModules as ModuleDefinition[]) {
    configModules[defaultModule.key] ??= defaultModule.defaultModuleDeclaration
  }

  return configModules
}

export const loadMedusaApp = async (
  {
    configModule,
    container,
  }: {
    configModule: {
      modules?: CommonTypes.ConfigModule["modules"]
      projectConfig: CommonTypes.ConfigModule["projectConfig"]
    }
    container: MedusaContainer
  },
  config = { registerInContainer: true }
): Promise<MedusaAppOutput> => {
  const injectedDependencies = {
    [ContainerRegistrationKeys.PG_CONNECTION]: container.resolve(
      ContainerRegistrationKeys.PG_CONNECTION
    ),
  }

  const sharedResourcesConfig = {
    database: {
      clientUrl: configModule.projectConfig.database_url,
      driverOptions: configModule.projectConfig.database_extra,
    },
  }

  container.register(ContainerRegistrationKeys.REMOTE_QUERY, asValue(undefined))
  container.register(ContainerRegistrationKeys.REMOTE_LINK, asValue(undefined))

  const configModules = mergeDefaultModules(configModule.modules)

  // Apply default options to legacy modules
  for (const moduleKey of Object.keys(configModules)) {
    if (!ModulesDefinition[moduleKey].isLegacy) {
      continue
    }

    if (isObject(configModules[moduleKey])) {
      ;(
        configModules[moduleKey] as Partial<InternalModuleDeclaration>
      ).options ??= {
        database: {
          type: "postgres",
          url: configModule.projectConfig.database_url,
          extra: configModule.projectConfig.database_extra,
          schema: configModule.projectConfig.database_schema,
          logging: configModule.projectConfig.database_logging,
        },
      }
    }
  }

  const medusaApp = await MedusaApp({
    modulesConfig: configModules,
    servicesConfig: joinerConfig,
    remoteFetchData: remoteQueryFetchData(container),
    sharedContainer: container,
    sharedResourcesConfig,
    injectedDependencies,
  })

  if (!config.registerInContainer) {
    return medusaApp
  }

  container.register(
    ContainerRegistrationKeys.REMOTE_LINK,
    asValue(medusaApp.link)
  )
  container.register(
    ContainerRegistrationKeys.REMOTE_QUERY,
    asValue(medusaApp.query)
  )

  for (const [serviceKey, moduleService] of Object.entries(medusaApp.modules)) {
    container.register(
      ModulesDefinition[serviceKey].registrationName,
      asValue(moduleService)
    )
  }

  // Register all unresolved modules as undefined to be present in the container with undefined value by defaul
  // but still resolvable
  for (const moduleDefinition of Object.values(ModulesDefinition)) {
    if (!container.hasRegistration(moduleDefinition.registrationName)) {
      container.register(moduleDefinition.registrationName, asValue(undefined))
    }
  }

  return medusaApp
}

export default loadMedusaApp
