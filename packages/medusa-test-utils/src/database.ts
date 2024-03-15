import { Migrator, TSMigrationGenerator } from "@mikro-orm/migrations"
import { MikroORM, SqlEntityManager } from "@mikro-orm/postgresql"
import { createDatabase, parsePostgresUrl } from "pg-god"

export function getDatabaseURL(dbName?: string): string {
  const DB_HOST = process.env.DB_HOST ?? "localhost"
  const DB_USERNAME = process.env.DB_USERNAME ?? "postgres"
  const DB_PASSWORD = process.env.DB_PASSWORD
  const DB_NAME = dbName ?? process.env.DB_TEMP_NAME

  return `postgres://${DB_USERNAME}${
    DB_PASSWORD ? `:${DB_PASSWORD}` : ""
  }@${DB_HOST}/${DB_NAME}`
}

export function getMikroOrmConfig({
  mikroOrmEntities,
  pathToMigrations,
  clientUrl,
  schema,
}: {
  mikroOrmEntities: any[]
  pathToMigrations?: string
  clientUrl?: string
  schema?: string
}) {
  const DB_URL = clientUrl ?? getDatabaseURL()

  return {
    clientUrl: DB_URL,
    extensions: [Migrator],
    entities: Object.values(mikroOrmEntities),
    schema: schema ?? process.env.MEDUSA_DB_SCHEMA,
    // TODO: Change to true once we don't use both eg. product_id and product definitions on the model.
    discovery: {
      checkDuplicateFieldNames: false,
    },
    debug: false,
    migrations: {
      pathTs: pathToMigrations,
      silent: true,
      generator: TSMigrationGenerator,
    },
  }
}

export interface TestDatabase {
  mikroOrmEntities: any[]
  pathToMigrations?: string
  schema?: string
  clientUrl?: string

  orm: MikroORM | null
  manager: SqlEntityManager | null

  setupDatabase(): Promise<void>
  clearDatabase(): Promise<void>
  getManager(): SqlEntityManager
  forkManager(): SqlEntityManager
  getOrm(): MikroORM
}

export function getMikroOrmWrapper({
  mikroOrmEntities,
  pathToMigrations,
  clientUrl,
  schema,
}: {
  mikroOrmEntities: any[]
  pathToMigrations?: string
  clientUrl?: string
  schema?: string
}): TestDatabase {
  return {
    mikroOrmEntities,
    pathToMigrations,
    clientUrl: clientUrl ?? getDatabaseURL(),
    schema: schema ?? process.env.MEDUSA_DB_SCHEMA,

    orm: null,
    manager: null,

    getManager() {
      if (this.manager === null) {
        throw new Error("manager entity not available")
      }

      return this.manager
    },

    forkManager() {
      if (this.manager === null) {
        throw new Error("manager entity not available")
      }

      return this.manager.fork()
    },

    getOrm() {
      if (this.orm === null) {
        throw new Error("orm entity not available")
      }

      return this.orm
    },

    async setupDatabase() {
      const OrmConfig = getMikroOrmConfig({
        mikroOrmEntities: this.mikroOrmEntities,
        pathToMigrations: this.pathToMigrations,
        clientUrl: this.clientUrl,
        schema: this.schema,
      })

      try {
        const credentialsFromUrl = parsePostgresUrl(OrmConfig.clientUrl)
        await createDatabase(
          { databaseName: credentialsFromUrl.databaseName ?? "medusa-test" },
          {
            user: credentialsFromUrl.userName,
            host: credentialsFromUrl.host,
            password: credentialsFromUrl.password,
          }
        )
      } catch (err) {
        console.log(err)
      }

      // Initializing the ORM
      this.orm = await MikroORM.init(OrmConfig)

      this.manager = this.orm.em
      await this.manager?.execute(
        `CREATE SCHEMA IF NOT EXISTS "${this.schema ?? "public"}";`
      )

      const pendingMigrations = await this.orm
        .getMigrator()
        .getPendingMigrations()

      if (pendingMigrations && pendingMigrations.length > 0) {
        await this.orm
          .getMigrator()
          .up({ migrations: pendingMigrations.map((m) => m.name!) })
      } else {
        await this.orm.schema.refreshDatabase() // ensure db exists and is fresh
      }
    },

    async clearDatabase() {
      if (this.orm === null) {
        throw new Error("ORM not configured")
      }

      await this.manager?.execute(
        `DROP SCHEMA IF EXISTS "${this.schema ?? "public"}" CASCADE;`
      )

      await this.manager?.execute(
        `CREATE SCHEMA IF NOT EXISTS "${this.schema ?? "public"}";`
      )

      try {
        await this.orm.close()
      } catch {}

      this.orm = null
      this.manager = null
    },
  }
}
