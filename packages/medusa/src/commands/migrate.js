import { asValue, createContainer } from "awilix"
import getMigrations, {
  getModuleSharedResources,
  revertIsolatedModulesMigration,
  runIsolatedModulesMigration,
} from "./utils/get-migrations"

import IsolatePricingDomainFeatureFlag from "../loaders/feature-flags/isolate-pricing-domain"
import IsolateProductDomainFeatureFlag from "../loaders/feature-flags/isolate-product-domain"
import Logger from "../loaders/logger"
import configModuleLoader from "../loaders/config"
import databaseLoader from "../loaders/database"
import featureFlagLoader from "../loaders/feature-flags"
import { loadMedusaApp } from "../loaders/medusa-app"

const getDataSource = async (directory) => {
  const configModule = configModuleLoader(directory)
  const featureFlagRouter = featureFlagLoader(configModule)
  const { coreMigrations } = getMigrations(directory, featureFlagRouter)
  const { migrations: moduleMigrations } = getModuleSharedResources(
    configModule,
    featureFlagRouter
  )

  const container = createContainer()
  container.register("db_entities", asValue([]))

  return await databaseLoader({
    container,
    configModule,
    customOptions: {
      migrations: coreMigrations.concat(moduleMigrations),
      logging: "all",
    },
  })
}

const runLinkMigrations = async (directory) => {
  const configModule = configModuleLoader(directory)

  const { runMigrations } = await loadMedusaApp(
    { configModule },
    { register: false }
  )

  const options = {
    database: {
      clientUrl: configModule.projectConfig.database_url,
    },
  }
  await runMigrations(options)
}

const main = async function ({ directory }) {
  const args = process.argv

  args.shift()
  args.shift()
  args.shift()

  const configModule = configModuleLoader(directory)
  const dataSource = await getDataSource(directory)
  const featureFlagRouter = featureFlagLoader(configModule)

  if (args[0] === "run") {
    await dataSource.runMigrations()
    await dataSource.destroy()
    // await runIsolatedModulesMigration(configModule)
    Logger.info("Migrations completed.")
  } else if (args[0] === "revert") {
    await dataSource.undoLastMigration({ transaction: "all" })
    await dataSource.destroy()
    await revertIsolatedModulesMigration(configModule)
    Logger.info("Migrations reverted.")
  } else if (args[0] === "show") {
    const unapplied = await dataSource.showMigrations()
    Logger.info(unapplied)
    await dataSource.destroy()
    process.exit(unapplied ? 1 : 0)
  }

  if (
    featureFlagRouter.isFeatureEnabled(IsolateProductDomainFeatureFlag.key) ||
    featureFlagRouter.isFeatureEnabled(IsolatePricingDomainFeatureFlag.key)
  ) {
    await runLinkMigrations(directory)
  }
  process.exit()
}

export default main
