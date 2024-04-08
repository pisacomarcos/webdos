import { FolderIllustration, TriangleRightMini } from "@medusajs/icons"
import { AdminProductCategoryResponse } from "@medusajs/types"
import { Badge, Container, Heading, Text, Tooltip } from "@medusajs/ui"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { ActionMenu } from "../../../../../components/common/action-menu"
import { InlineLink } from "../../../../../components/common/inline-link"
import { Skeleton } from "../../../../../components/common/skeleton"
import { useCategory } from "../../../../../hooks/api/categories"

type CategoryOrganizationSectionProps = {
  category: AdminProductCategoryResponse["product_category"]
}

export const CategoryOrganizationSection = ({
  category,
}: CategoryOrganizationSectionProps) => {
  const { t } = useTranslation()

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">{t("categories.organization.header")}</Heading>
        <ActionMenu groups={[]} />
      </div>
      <div className="text-ui-fg-subtle grid grid-cols-2 items-start gap-3 px-6 py-4">
        <Text size="small" leading="compact" weight="plus">
          {t("categories.organization.pathLabel")}
        </Text>
        <PathDisplay category={category} />
      </div>
      <div className="text-ui-fg-subtle grid grid-cols-2 items-start gap-3 px-6 py-4">
        <Text size="small" leading="compact" weight="plus">
          {t("categories.organization.childrenLabel")}
        </Text>
        <ChildrenDisplay category={category} />
      </div>
    </Container>
  )
}

type ChipProps = {
  id: string
  name: string
}

function getPath(
  category?: AdminProductCategoryResponse["product_category"]
): ChipProps[] {
  if (!category) {
    return []
  }

  const path = category.parent_category ? getPath(category.parent_category) : []
  path.push({ id: category.id, name: category.name })

  return path
}

const PathDisplay = ({
  category,
}: {
  category: AdminProductCategoryResponse["product_category"]
}) => {
  const [expanded, setExpanded] = useState(false)

  const { t } = useTranslation()

  const {
    product_category: withParents,
    isLoading,
    isError,
    error,
  } = useCategory(category.id, {
    include_ancestors_tree: true,
    fields: "id,name,parent_category",
  })

  const chips = useMemo(() => getPath(withParents), [withParents])

  if (isLoading || !withParents) {
    return <Skeleton className="h-5 w-16" />
  }

  if (isError) {
    throw error
  }

  if (!chips.length) {
    return (
      <Text size="small" leading="compact">
        -
      </Text>
    )
  }

  if (chips.length > 1 && !expanded) {
    return (
      <div className="grid grid-cols-[20px_1fr] items-start gap-x-2">
        <FolderIllustration />
        <div className="flex items-center gap-x-0.5">
          <Tooltip content={t("categories.organization.pathExpandTooltip")}>
            <button
              className="outline-none"
              type="button"
              onClick={() => setExpanded(true)}
            >
              <Text size="xsmall" leading="compact" weight="plus">
                ...
              </Text>
            </button>
          </Tooltip>
          <TriangleRightMini />
          <Text
            size="xsmall"
            leading="compact"
            weight="plus"
            className="truncate"
          >
            {chips[chips.length - 1].name}
          </Text>
        </div>
      </div>
    )
  }

  if (chips.length > 1 && expanded) {
    return (
      <div className="grid grid-cols-[20px_1fr] items-start gap-x-2">
        <FolderIllustration />
        <div className="gap- flex flex-wrap items-center gap-x-0.5 gap-y-1">
          {chips.map((chip, index) => {
            return (
              <div key={chip.id} className="flex items-center gap-x-0.5">
                {index === chips.length - 1 ? (
                  <Text size="xsmall" leading="compact" weight="plus">
                    {chip.name}
                  </Text>
                ) : (
                  <InlineLink
                    to={`/categories/${chip.id}`}
                    className="txt-compact-xsmall-plus text-ui-fg-subtle hover:text-ui-fg-base focus-visible:text-ui-fg-base"
                  >
                    {chip.name}
                  </InlineLink>
                )}
                {index < chips.length - 1 && <TriangleRightMini />}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 items-start gap-x-2">
      {chips.map((chip, index) => (
        <div key={chip.id} className="flex items-center gap-x-0.5">
          <Text size="xsmall" leading="compact" weight="plus">
            {chip.name}
          </Text>
          {index < chips.length - 1 && <TriangleRightMini />}
        </div>
      ))}
    </div>
  )
}

function getChildren(
  category?: AdminProductCategoryResponse["product_category"]
): ChipProps[] {
  if (!category || !category.category_children) {
    return []
  }

  return category.category_children.map((child) => ({
    id: child.id,
    name: child.name,
  }))
}

const ChildrenDisplay = ({
  category,
}: {
  category: AdminProductCategoryResponse["product_category"]
}) => {
  const {
    product_category: withChildren,
    isLoading,
    isError,
    error,
  } = useCategory(category.id, {
    include_descendants_tree: true,
    fields: "id,name,category_children",
  })

  const chips = useMemo(() => getChildren(withChildren), [withChildren])

  if (isLoading || !withChildren) {
    return <Skeleton className="h-5 w-16" />
  }

  if (isError) {
    throw error
  }

  if (!chips.length) {
    return (
      <Text size="small" leading="compact">
        -
      </Text>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((chip) => (
        <Badge key={chip.id} size="2xsmall" asChild>
          <Link to={`/categories/${chip.id}`}>{chip.name}</Link>
        </Badge>
      ))}
    </div>
  )
}
