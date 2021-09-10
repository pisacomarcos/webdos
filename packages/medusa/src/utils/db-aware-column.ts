import path from "path"
import { Column, ColumnOptions, ColumnType } from "typeorm"
import { getConfigFile } from "medusa-core-utils"

const pgSqliteTypeMapping: { [key: string]: ColumnType } = {
  increment: "rowid",
  timestamptz: "datetime",
  jsonb: "simple-json",
  enum: "text",
}

const pgSqliteGenerationMapping: {
  [key: string]: "increment" | "uuid" | "rowid"
} = {
  increment: "rowid",
}

// Default to Postgres to allow for migrations to run
let dbType: string = "postgres"
export function resolveDbType(pgSqlType: ColumnType): ColumnType {
  if (!dbType) {
    const { configModule } = getConfigFile(path.resolve("."), `medusa-config`)
    dbType = configModule.projectConfig.database_type
  }

  if (dbType === "sqlite" && pgSqlType in pgSqliteTypeMapping) {
    return pgSqliteTypeMapping[pgSqlType.toString()]
  }
  return pgSqlType
}

export function resolveDbGenerationStrategy(
  pgSqlType: "increment" | "uuid" | "rowid"
): "increment" | "uuid" | "rowid" {
  if (!dbType) {
    const { configModule } = getConfigFile(path.resolve("."), `medusa-config`)
    dbType = configModule.projectConfig.database_type
  }

  if (dbType === "sqlite" && pgSqlType in pgSqliteTypeMapping) {
    return pgSqliteGenerationMapping[pgSqlType]
  }
  return pgSqlType
}

export function DbAwareColumn(columnOptions: ColumnOptions) {
  const pre = columnOptions.type
  if (columnOptions.type) {
    columnOptions.type = resolveDbType(columnOptions.type)
  }

  if (pre === "jsonb" && pre !== columnOptions.type) {
    if ("default" in columnOptions) {
      columnOptions.default = JSON.stringify(columnOptions.default)
    }
  }

  return Column(columnOptions)
}
