import { Button, Container, Heading } from "@medusajs/ui"
import { adminPublishableApiKeysKeys, useAdminCustomQuery } from "medusa-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { DataTable } from "../../../../../components/table/data-table"
import { useDataTable } from "../../../../../hooks/use-data-table"
import { useApiKeyManagementTableColumns } from "./use-api-key-management-table-columns"
import { useApiKeyManagementTableFilters } from "./use-api-key-management-table-filters"
import { useApiKeyManagementTableQuery } from "./use-api-key-management-table-query"
import { upperCaseFirst } from "../../../../../lib/uppercase-first"

const PAGE_SIZE = 20

export const ApiKeyManagementListTable = ({
  keyType,
}: {
  keyType: "secret" | "publishable"
}) => {
  const { t } = useTranslation()

  const { searchParams, raw } = useApiKeyManagementTableQuery({
    pageSize: PAGE_SIZE,
  })

  const query = {
    ...searchParams,
    type: keyType,
    fields:
      "id,title,redacted,token,type,created_at,updated_at,revoked_at,last_used_at,created_by,revoked_by",
  }

  // @ts-ignore
  const { data, count, isLoading, isError, error } = useAdminCustomQuery(
    "/api-keys",
    [adminPublishableApiKeysKeys.list(query)],
    query
  )

  const filters = useApiKeyManagementTableFilters()
  const columns = useApiKeyManagementTableColumns()

  const { table } = useDataTable({
    data: data?.api_keys || [],
    columns,
    count,
    enablePagination: true,
    getRowId: (row) => row.id,
    pageSize: PAGE_SIZE,
  })

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (isError) {
    throw error
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">
          {t(`apiKeyManagementV2.domain`, { keyType: upperCaseFirst(keyType) })}
        </Heading>
        <Link to="create">
          <Button variant="secondary" size="small">
            {t("actions.create")}
          </Button>
        </Link>
      </div>
      <DataTable
        table={table}
        filters={filters}
        columns={columns}
        count={1}
        pageSize={PAGE_SIZE}
        orderBy={["title", "created_at", "updated_at", "revoked_at"]}
        navigateTo={(row) => `/settings/api-key-management/${row.id}`}
        pagination
        search
        queryObject={raw}
        isLoading={isLoading}
      />
    </Container>
  )
}
