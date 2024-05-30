import { mergeTypeDefs } from "@graphql-tools/merge"
import { makeExecutableSchema } from "@graphql-tools/schema"
import { RemoteFetchDataCallback } from "@medusajs/orchestration"
import {
  InternalModuleDeclaration,
  LoadedModule,
  MedusaAppOptions,
  MedusaAppOutput,
  MedusaModuleConfig,
  ModuleDefinition,
  ModuleExports,
  ModuleJoinerConfig,
  ModuleServiceInitializeOptions,
  RemoteJoinerOptions,
  RemoteJoinerQuery,
  RunMigrationFn
} from "@medusajs/types"
import {
  ContainerRegistrationKeys,
  ModulesSdkUtils,
  createMedusaContainer,
  isDefined,
  isObject,
  isString,
  promiseAll,
} from "@medusajs/utils"
import { asValue } from "awilix"
import {
  MODULE_PACKAGE_NAMES,
  ModuleRegistrationName,
  Modules,
} from "./definitions"
import { MedusaModule } from "./medusa-module"
import { RemoteLink } from "./remote-link"
import { RemoteQuery } from "./remote-query"
import { MODULE_RESOURCE_TYPE, MODULE_SCOPE } from "./types"
import { cleanGraphQLSchema } from "./utils"
import * as Servers from "./utils/servers"

const LinkModulePackage = MODULE_PACKAGE_NAMES[Modules.LINK]

export async function loadModules(
  modulesConfig,
  sharedContainer,
  migrationOnly = false,
  loaderOnly = false,
  workerMode: "shared" | "worker" | "server" = "server"
) {
  const allModules = {}

  await Promise.all(
    Object.keys(modulesConfig).map(async (moduleName) => {
      const mod = modulesConfig[moduleName]
      let path: string
      let moduleExports: ModuleExports | undefined = undefined
      let declaration: any = {}
      let definition: Partial<ModuleDefinition> | undefined = undefined

      if (isObject(mod)) {
        const mod_ = mod as unknown as InternalModuleDeclaration
        path = mod_.resolve ?? MODULE_PACKAGE_NAMES[moduleName]
        definition = mod_.definition
        moduleExports = !isString(mod_.resolve)
          ? (mod_.resolve as ModuleExports)
          : undefined
        declaration = { ...mod }
        delete declaration.definition
      } else {
        path = MODULE_PACKAGE_NAMES[moduleName]
      }

      declaration.scope ??= MODULE_SCOPE.INTERNAL
      if (
        declaration.scope === MODULE_SCOPE.INTERNAL &&
        !declaration.resources
      ) {
        declaration.resources = MODULE_RESOURCE_TYPE.SHARED
      }

      const loaded = (await MedusaModule.bootstrap({
        moduleKey: moduleName,
        defaultPath: path,
        declaration,
        sharedContainer,
        moduleDefinition: definition as ModuleDefinition,
        moduleExports,
        migrationOnly,
        loaderOnly,
        workerMode,
      })) as LoadedModule

      if (loaderOnly) {
        return
      }

      const service = loaded[moduleName]
      sharedContainer.register({
        [service.__definition.registrationName]: asValue(service),
      })

      if (allModules[moduleName] && !Array.isArray(allModules[moduleName])) {
        allModules[moduleName] = []
      }

      if (allModules[moduleName]) {
        ;(allModules[moduleName] as LoadedModule[]).push(loaded[moduleName])
      } else {
        allModules[moduleName] = loaded[moduleName]
      }
    })
  )
  return allModules
}

async function initializeLinks({
  config,
  linkModules,
  injectedDependencies,
  moduleExports,
}) {
  try {
    const { initialize, runMigrations, revertMigrations } =
      moduleExports ?? (await import(LinkModulePackage))

    const linkResolution = await initialize(
      config,
      linkModules,
      injectedDependencies
    )

    return {
      remoteLink: new RemoteLink(),
      linkResolution,
      runMigrations,
      revertMigrations,
    }
  } catch (err) {
    console.warn("Error initializing link modules.", err)

    return {
      remoteLink: undefined,
      linkResolution: undefined,
      runMigrations: undefined,
    }
  }
}

function isMedusaModule(mod) {
  return typeof mod?.initialize === "function"
}

function cleanAndMergeSchema(loadedSchema) {
  const defaultMedusaSchema = `
    scalar DateTime
    scalar JSON
  `
  const { schema: cleanedSchema, notFound } = cleanGraphQLSchema(
    defaultMedusaSchema + loadedSchema
  )
  const mergedSchema = mergeTypeDefs(cleanedSchema)
  return { schema: makeExecutableSchema({ typeDefs: mergedSchema }), notFound }
}

function getLoadedSchema(): string {
  return MedusaModule.getAllJoinerConfigs()
    .map((joinerConfig) => joinerConfig?.schema ?? "")
    .join("\n")
}

function registerCustomJoinerConfigs(servicesConfig: ModuleJoinerConfig[]) {
  for (const config of servicesConfig) {
    if (!config.serviceName || config.isReadOnlyLink) {
      continue
    }

    MedusaModule.setJoinerConfig(config.serviceName, config)
  }
}

async function MedusaApp_({
  sharedContainer,
  sharedResourcesConfig,
  servicesConfig,
  modulesConfigPath,
  modulesConfigFileName,
  modulesConfig,
  linkModules,
  remoteFetchData,
  injectedDependencies = {},
  migrationOnly = false,
  loaderOnly = false,
  workerMode = "server",
}: MedusaAppOptions<RemoteFetchDataCallback> & {
  migrationOnly?: boolean
} = {}): Promise<MedusaAppOutput> {
  const sharedContainer_ = createMedusaContainer({}, sharedContainer)

  const onApplicationShutdown = async () => {
    await promiseAll([
      MedusaModule.onApplicationShutdown(),
      sharedContainer_.dispose(),
    ])
  }

  const onApplicationPrepareShutdown = async () => {
    await promiseAll([MedusaModule.onApplicationPrepareShutdown()])
  }

  const modules: MedusaModuleConfig =
    modulesConfig ??
    (
      await import(
        modulesConfigPath ??
          process.cwd() + (modulesConfigFileName ?? "/modules-config")
      )
    ).default

  const dbData = ModulesSdkUtils.loadDatabaseConfig(
    "medusa",
    sharedResourcesConfig as ModuleServiceInitializeOptions,
    true
  )!

  registerCustomJoinerConfigs(servicesConfig ?? [])

  if (
    sharedResourcesConfig?.database?.connection &&
    !injectedDependencies[ContainerRegistrationKeys.PG_CONNECTION]
  ) {
    injectedDependencies[ContainerRegistrationKeys.PG_CONNECTION] =
      sharedResourcesConfig.database.connection
  } else if (
    dbData.clientUrl &&
    !injectedDependencies[ContainerRegistrationKeys.PG_CONNECTION]
  ) {
    injectedDependencies[ContainerRegistrationKeys.PG_CONNECTION] =
      ModulesSdkUtils.createPgConnection({
        ...(sharedResourcesConfig?.database ?? {}),
        ...dbData,
      })
  }

  // remove the link module from the modules
  const linkModule = modules[LinkModulePackage] ?? modules[Modules.LINK]
  delete modules[LinkModulePackage]
  delete modules[Modules.LINK]

  let linkModuleOptions = {}

  if (isObject(linkModule)) {
    linkModuleOptions = linkModule
  }

  for (const injectedDependency of Object.keys(injectedDependencies)) {
    sharedContainer_.register({
      [injectedDependency]: asValue(injectedDependencies[injectedDependency]),
    })
  }

  const allModules = await loadModules(
    modules,
    sharedContainer_,
    migrationOnly,
    loaderOnly,
    workerMode
  )

  if (loaderOnly) {
    return {
      onApplicationShutdown,
      onApplicationPrepareShutdown,
      modules: allModules,
      link: undefined,
      query: async () => {
        throw new Error("Querying not allowed in loaderOnly mode")
      },
      runMigrations: async () => {
        throw new Error("Migrations not allowed in loaderOnly mode")
      },
      revertMigrations: async () => {
        throw new Error("Revert migrations not allowed in loaderOnly mode")
      },
    }
  }

  // Share Event bus with link modules
  injectedDependencies[ModuleRegistrationName.EVENT_BUS] =
    sharedContainer_.resolve(ModuleRegistrationName.EVENT_BUS, {
      allowUnregistered: true,
    })

  const {
    remoteLink,
    runMigrations: linkModuleMigration,
    revertMigrations: revertLinkModuleMigration,
  } = await initializeLinks({
    config: linkModuleOptions,
    linkModules,
    injectedDependencies,
    moduleExports: isMedusaModule(linkModule) ? linkModule : undefined,
  })

  const loadedSchema = getLoadedSchema()
  const { schema, notFound } = cleanAndMergeSchema(loadedSchema)

  const remoteQuery = new RemoteQuery({
    servicesConfig,
    customRemoteFetchData: remoteFetchData,
  })

  const query = async (
    query: string | RemoteJoinerQuery | object,
    variables?: Record<string, unknown>,
    options?: RemoteJoinerOptions
  ) => {
    return await remoteQuery.query(query, variables, options)
  }

  const applyMigration = async (linkModuleOptions, revert = false) => {
    for (const moduleName of Object.keys(allModules)) {
      const moduleResolution = MedusaModule.getModuleResolutions(moduleName)

      if (!moduleResolution.options?.database) {
        moduleResolution.options ??= {}
        moduleResolution.options.database = {
          ...(sharedResourcesConfig?.database ?? {}),
        }
      }

      if (revert) {
        await MedusaModule.migrateDown(
          moduleResolution.definition.key,
          moduleResolution.resolutionPath as string,
          moduleResolution.options,
          moduleResolution.moduleExports
        )
      } else {
        await MedusaModule.migrateUp(
          moduleResolution.definition.key,
          moduleResolution.resolutionPath as string,
          moduleResolution.options,
          moduleResolution.moduleExports
        )
      }
    }

    const linkModuleOpt = { ...(linkModuleOptions ?? {}) }
    linkModuleOpt.database ??= {
      ...(sharedResourcesConfig?.database ?? {}),
    }

    if (revert) {
      revertLinkModuleMigration &&
        (await revertLinkModuleMigration({
          options: linkModuleOpt,
          injectedDependencies,
        }))
    } else {
      linkModuleMigration &&
        (await linkModuleMigration({
          options: linkModuleOpt,
          injectedDependencies,
        }))
    }
  }

  const runMigrations: RunMigrationFn = async (
    linkModuleOptions
  ): Promise<void> => {
    await applyMigration(linkModuleOptions)
  }

  const revertMigrations: RunMigrationFn = async (
    linkModuleOptions
  ): Promise<void> => {
    await applyMigration(linkModuleOptions, true)
  }

  return {
    onApplicationShutdown,
    onApplicationPrepareShutdown,
    modules: allModules,
    link: remoteLink,
    query,
    entitiesMap: schema.getTypeMap(),
    notFound,
    runMigrations,
    revertMigrations,
    listen: async (protocol, port, options?: Record<string, any>) => {
      if (!protocol || !isDefined(Servers[protocol])) {
        throw new Error(`"${protocol}" protocol is not supported`)
      }

      const serverConstructor = Servers[protocol].default
      await serverConstructor(sharedContainer_, allModules)(port, options)
    },
  }
}

export async function MedusaApp(
  options: MedusaAppOptions<RemoteFetchDataCallback> = {}
): Promise<MedusaAppOutput> {
  try {
    return await MedusaApp_(options)
  } finally {
    MedusaModule.onApplicationStart(options.onApplicationStartCb)
  }
}

export async function MedusaAppMigrateUp(
  options: MedusaAppOptions<RemoteFetchDataCallback> = {}
): Promise<void> {
  const migrationOnly = true

  const { runMigrations } = await MedusaApp_({
    ...options,
    migrationOnly,
  })

  await runMigrations().finally(MedusaModule.clearInstances)
}

export async function MedusaAppMigrateDown(
  options: MedusaAppOptions<RemoteFetchDataCallback> = {}
): Promise<void> {
  const migrationOnly = true

  const { revertMigrations } = await MedusaApp_({
    ...options,
    migrationOnly,
  })

  await revertMigrations().finally(MedusaModule.clearInstances)
}
