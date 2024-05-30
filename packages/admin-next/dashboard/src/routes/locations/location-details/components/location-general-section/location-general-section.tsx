import {
  ArchiveBox,
  CheckMini,
  CurrencyDollar,
  Map,
  PencilSquare,
  Plus,
  Trash,
  TriangleDownMini,
  XMarkMini,
} from "@medusajs/icons"
import {
  FulfillmentSetDTO,
  ServiceZoneDTO,
  ShippingOptionDTO,
  StockLocationDTO,
} from "@medusajs/types"
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  StatusBadge,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import { ActionMenu } from "../../../../../components/common/action-menu"
import { Divider } from "../../../../../components/common/divider"
import { NoRecords } from "../../../../../components/common/empty-table-content"
import { LinkButton } from "../../../../../components/common/link-button"
import { ListSummary } from "../../../../../components/common/list-summary"
import { useDeleteShippingOption } from "../../../../../hooks/api/shipping-options"
import {
  useCreateFulfillmentSet,
  useDeleteFulfillmentSet,
  useDeleteServiceZone,
  useDeleteStockLocation,
} from "../../../../../hooks/api/stock-locations"
import { getFormattedAddress } from "../../../../../lib/addresses"
import { countries as staticCountries } from "../../../../../lib/countries"
import { formatProvider } from "../../../../../lib/format-provider"
import {
  isOptionEnabledInStore,
  isReturnOption,
} from "../../../../../lib/shipping-options"

type LocationGeneralSectionProps = {
  location: StockLocationDTO
}

export const LocationGeneralSection = ({
  location,
}: LocationGeneralSectionProps) => {
  return (
    <>
      <Container className="p-0">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <Heading>{location.name}</Heading>
            <Text className="text-ui-fg-subtle txt-small">
              {getFormattedAddress({ address: location.address }).join(", ")}
            </Text>
          </div>
          <Actions location={location} />
        </div>
      </Container>

      <FulfillmentSet
        locationId={location.id}
        locationName={location.name}
        type={FulfillmentSetType.Pickup}
        fulfillmentSet={location.fulfillment_sets.find(
          (f) => f.type === FulfillmentSetType.Pickup
        )}
      />

      <FulfillmentSet
        locationId={location.id}
        locationName={location.name}
        type={FulfillmentSetType.Delivery}
        fulfillmentSet={location.fulfillment_sets.find(
          (f) => f.type === FulfillmentSetType.Delivery
        )}
      />
    </>
  )
}

type ShippingOptionProps = {
  option: ShippingOptionDTO
  fulfillmentSetId: string
  locationId: string
  isReturn?: boolean
}

function ShippingOption({
  option,
  isReturn,
  fulfillmentSetId,
  locationId,
}: ShippingOptionProps) {
  const prompt = usePrompt()
  const { t } = useTranslation()

  const isStoreOption = isOptionEnabledInStore(option)

  const { mutateAsync: deleteOption } = useDeleteShippingOption(option.id)

  const handleDelete = async () => {
    const res = await prompt({
      title: t("general.areYouSure"),
      description: t("location.shippingOptions.deleteWarning", {
        name: option.name,
      }),
      confirmText: t("actions.delete"),
      cancelText: t("actions.cancel"),
    })

    if (!res) {
      return
    }

    await deleteOption(undefined, {
      onSuccess: () => {
        toast.success(t("general.success"), {
          description: t("location.shippingOptions.toast.delete", {
            name: option.name,
          }),
          dismissLabel: t("actions.close"),
        })
      },
      onError: (e) => {
        toast.error(t("general.error"), {
          description: e.message,
          dismissLabel: t("actions.close"),
        })
      },
    })
  }

  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="flex-1">
        <span className="txt-small font-medium">
          {option.name} - {option.shipping_profile.name} (
          {formatProvider(option.provider_id)})
        </span>
      </div>
      <Badge
        className="mr-4"
        color={isStoreOption ? "grey" : "purple"}
        size="2xsmall"
        rounded="full"
      >
        {isStoreOption ? t("general.store") : t("general.admin")}
      </Badge>
      <ActionMenu
        groups={[
          {
            actions: [
              {
                icon: <PencilSquare />,
                label: t("location.serviceZone.editOption"),
                to: `/settings/locations/${locationId}/fulfillment-set/${fulfillmentSetId}/service-zone/${option.service_zone_id}/shipping-option/${option.id}/edit`,
              },
              {
                label: t("location.serviceZone.editPrices"),
                icon: <CurrencyDollar />,
                to: `/settings/locations/${locationId}/fulfillment-set/${fulfillmentSetId}/service-zone/${option.service_zone_id}/shipping-option/${option.id}/edit-pricing`,
              },
            ],
          },
          {
            actions: [
              {
                label: t("actions.delete"),
                icon: <Trash />,
                onClick: handleDelete,
              },
            ],
          },
        ]}
      />
    </div>
  )
}

type ServiceZoneOptionsProps = {
  zone: ServiceZoneDTO
  locationId: string
  fulfillmentSetId: string
}

function ServiceZoneOptions({
  zone,
  locationId,
  fulfillmentSetId,
}: ServiceZoneOptionsProps) {
  const { t } = useTranslation()

  const shippingOptions = zone.shipping_options.filter(
    (o) => !isReturnOption(o)
  )

  const returnOptions = zone.shipping_options.filter((o) => isReturnOption(o))

  return (
    <div>
      <Divider variant="dashed" />
      <div className="flex flex-col px-6 py-4">
        <div className="item-center flex justify-between">
          <span className="text-ui-fg-subtle txt-small self-center font-medium">
            {t("location.serviceZone.shippingOptions")}
          </span>
          <LinkButton
            to={`/settings/locations/${locationId}/fulfillment-set/${fulfillmentSetId}/service-zone/${zone.id}/shipping-option/create`}
          >
            {t("location.serviceZone.addOption")}
          </LinkButton>
        </div>

        {!!shippingOptions.length && (
          <div className="shadow-elevation-card-rest bg-ui-bg-subtle mt-4 grid divide-y rounded-md">
            {shippingOptions.map((o) => (
              <ShippingOption
                key={o.id}
                option={o}
                locationId={locationId}
                fulfillmentSetId={fulfillmentSetId}
              />
            ))}
          </div>
        )}
      </div>

      <Divider variant="dashed" />

      <div className="flex flex-col px-6 py-4">
        <div className="item-center flex justify-between">
          <span className="text-ui-fg-subtle txt-small self-center font-medium">
            {t("location.serviceZone.returnOptions")}
          </span>
          <LinkButton
            to={`/settings/locations/${locationId}/fulfillment-set/${fulfillmentSetId}/service-zone/${zone.id}/shipping-option/create?is_return`}
          >
            {t("location.serviceZone.addOption")}
          </LinkButton>
        </div>

        {!!returnOptions.length && (
          <div className="shadow-elevation-card-rest bg-ui-bg-subtle grid divide-y rounded-md pt-4">
            {returnOptions.map((o) => (
              <ShippingOption
                key={o.id}
                isReturn
                option={o}
                locationId={locationId}
                fulfillmentSetId={fulfillmentSetId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

type ServiceZoneProps = {
  zone: ServiceZoneDTO
  locationId: string
  fulfillmentSetId: string
}

function ServiceZone({ zone, locationId, fulfillmentSetId }: ServiceZoneProps) {
  const { t } = useTranslation()
  const prompt = usePrompt()
  const [open, setOpen] = useState(false)

  const { mutateAsync: deleteZone } = useDeleteServiceZone(
    fulfillmentSetId,
    zone.id
  )

  const handleDelete = async () => {
    const res = await prompt({
      title: t("general.areYouSure"),
      description: t("location.serviceZone.deleteWarning", {
        name: zone.name,
      }),
      confirmText: t("actions.delete"),
      cancelText: t("actions.cancel"),
    })

    if (!res) {
      return
    }

    try {
      await deleteZone()

      toast.success(t("general.success"), {
        description: t("location.serviceZone.toast.delete", {
          name: zone.name,
        }),
        dismissLabel: t("actions.close"),
      })
    } catch (e) {
      toast.error(t("general.error"), {
        description: e.message,
        dismissLabel: t("actions.close"),
      })
    }
  }

  const countries = useMemo(() => {
    return zone.geo_zones
      .filter((g) => g.type === "country")
      .map((g) => g.country_code)
      .map((code) => staticCountries.find((c) => c.iso_2 === code))
      .sort((c1, c2) => c1.name.localeCompare(c2.name))
  }, zone.geo_zones)

  const [shippingOptionsCount, returnOptionsCount] = useMemo(() => {
    const optionsCount = zone.shipping_options.filter(
      (o) => !isReturnOption(o)
    ).length

    const returnOptionsCount = zone.shipping_options.filter((o) =>
      isReturnOption(o)
    ).length

    return [optionsCount, returnOptionsCount]
  }, [zone.shipping_options])

  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-center justify-between gap-x-4 px-6 py-4">
        {/* ICON*/}
        <div className="shadow-borders-base flex size-7 items-center justify-center rounded-md">
          <div className="bg-ui-bg-field flex size-6 items-center justify-center rounded-[4px]">
            <Map className="text-ui-fg-subtle" />
          </div>
        </div>

        {/* INFO*/}
        <div className="grow-1 flex flex-1 flex-col">
          <Text size="small" leading="compact" weight="plus">
            {zone.name}
          </Text>
          <div className="flex items-center gap-2">
            <ListSummary
              variant="base"
              list={countries.map((c) => c.display_name)}
              inline
              n={1}
            />
            <span>·</span>
            <Text className="text-ui-fg-subtle txt-small">
              {shippingOptionsCount}{" "}
              {t("location.serviceZone.optionsLength", {
                count: shippingOptionsCount,
              })}
            </Text>
            <span>·</span>
            <Text className="text-ui-fg-subtle txt-small">
              {returnOptionsCount}{" "}
              {t("location.serviceZone.returnOptionsLength", {
                count: returnOptionsCount,
              })}
            </Text>
          </div>
        </div>

        {/* ACTION*/}
        <div className="flex grow-0 items-center gap-4">
          <IconButton
            size="small"
            onClick={() => setOpen((s) => !s)}
            variant="transparent"
          >
            <TriangleDownMini
              style={{
                transform: `rotate(${!open ? 0 : 180}deg)`,
                transition: ".2s transform ease-in-out",
              }}
            />
          </IconButton>
          <ActionMenu
            groups={[
              {
                actions: [
                  {
                    label: t("actions.edit"),
                    icon: <PencilSquare />,
                    to: `/settings/locations/${locationId}/fulfillment-set/${fulfillmentSetId}/service-zone/${zone.id}/edit`,
                  },
                  {
                    label: t("location.serviceZone.areas.manage"),
                    icon: <Map />,
                    to: `/settings/locations/${locationId}/fulfillment-set/${fulfillmentSetId}/service-zone/${zone.id}/edit-areas`,
                  },
                ],
              },
              {
                actions: [
                  {
                    label: t("actions.delete"),
                    icon: <Trash />,
                    onClick: handleDelete,
                  },
                ],
              },
            ]}
          />
        </div>
      </div>
      {open && (
        <ServiceZoneOptions
          fulfillmentSetId={fulfillmentSetId}
          locationId={locationId}
          zone={zone}
        />
      )}
    </div>
  )
}

enum FulfillmentSetType {
  Delivery = "delivery",
  Pickup = "pickup",
}

type FulfillmentSetProps = {
  fulfillmentSet?: FulfillmentSetDTO
  locationName: string
  locationId: string
  type: FulfillmentSetType
}

function FulfillmentSet(props: FulfillmentSetProps) {
  const { t } = useTranslation()
  const prompt = usePrompt()
  const navigate = useNavigate()

  const { fulfillmentSet, locationName, locationId, type } = props

  const fulfillmentSetExists = !!fulfillmentSet

  const hasServiceZones = !!fulfillmentSet?.service_zones.length

  const { mutateAsync: createFulfillmentSet, isPending: isLoading } =
    useCreateFulfillmentSet(locationId)

  const { mutateAsync: deleteFulfillmentSet } = useDeleteFulfillmentSet(
    fulfillmentSet?.id
  )

  const handleCreate = async () => {
    try {
      await createFulfillmentSet({
        name: `${locationName} ${
          type === FulfillmentSetType.Pickup ? "pick up" : type
        }`,
        type,
      })
    } catch (e) {
      toast.error(t("general.error"), {
        description: e.message,
        dismissLabel: t("actions.close"),
      })
    }
  }

  const handleDelete = async () => {
    const res = await prompt({
      title: t("general.areYouSure"),
      description: t("location.fulfillmentSet.disableWarning", {
        name: fulfillmentSet?.name,
      }),
      confirmText: t("actions.delete"),
      cancelText: t("actions.cancel"),
    })

    if (!res) {
      return
    }

    try {
      await deleteFulfillmentSet()

      toast.success(t("general.success"), {
        description: t("location.fulfillmentSet.toast.disable", {
          name: fulfillmentSet?.name,
        }),
        dismissLabel: t("actions.close"),
      })
    } catch (e) {
      toast.error(t("general.error"), {
        description: e.message,
        dismissLabel: t("actions.close"),
      })
    }
  }

  return (
    <Container className="p-0">
      <div className="flex flex-col divide-y">
        <div className="flex items-center justify-between px-6 py-4">
          <Text size="large" weight="plus" className="flex-1" as="div">
            {t(`location.fulfillmentSet.${type}.offers`)}
          </Text>
          <div className="flex items-center gap-4">
            <StatusBadge color={fulfillmentSetExists ? "green" : "red"}>
              {t(
                fulfillmentSetExists ? "statuses.enabled" : "statuses.disabled"
              )}
            </StatusBadge>

            <ActionMenu
              groups={[
                {
                  actions: [
                    {
                      icon: <Plus />,
                      label: t("location.fulfillmentSet.addZone"),
                      onClick: () =>
                        navigate(
                          `/settings/locations/${locationId}/fulfillment-set/${fulfillmentSet.id}/service-zones/create`
                        ),
                      disabled: !fulfillmentSetExists,
                    },
                    {
                      icon: fulfillmentSetExists ? (
                        <XMarkMini />
                      ) : (
                        <CheckMini />
                      ),
                      label: fulfillmentSetExists
                        ? t("actions.disable")
                        : t("actions.enable"),
                      onClick: fulfillmentSetExists
                        ? handleDelete
                        : handleCreate,
                    },
                  ],
                },
              ]}
            />
          </div>
        </div>

        {fulfillmentSetExists && !hasServiceZones && (
          <div className="text-ui-fg-muted txt-medium flex flex-col items-center justify-center gap-y-4 py-8">
            <NoRecords
              message={t("location.fulfillmentSet.placeholder")}
              className="h-fit"
            />

            <Button
              variant="secondary"
              onClick={() =>
                navigate(
                  `/settings/locations/${locationId}/fulfillment-set/${fulfillmentSet.id}/service-zones/create`
                )
              }
            >
              {t("location.fulfillmentSet.addZone")}
            </Button>
          </div>
        )}

        {hasServiceZones && (
          <div className="flex flex-col divide-y">
            {fulfillmentSet?.service_zones.map((zone) => (
              <ServiceZone
                zone={zone}
                key={zone.id}
                locationId={locationId}
                fulfillmentSetId={fulfillmentSet.id}
              />
            ))}
          </div>
        )}
      </div>
    </Container>
  )
}

const Actions = ({ location }: { location: StockLocationDTO }) => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { mutateAsync } = useDeleteStockLocation(location.id)
  const prompt = usePrompt()

  const handleDelete = async () => {
    const res = await prompt({
      title: t("general.areYouSure"),
      description: t("location.deleteLocationWarning", {
        name: location.name,
      }),
      verificationText: location.name,
      verificationInstruction: t("general.typeToConfirm"),
      confirmText: t("actions.delete"),
      cancelText: t("actions.cancel"),
    })

    if (!res) {
      return
    }

    try {
      await mutateAsync(undefined)
      toast.success(t("general.success"), {
        description: t("location.toast.delete"),
        dismissLabel: t("actions.close"),
      })
    } catch (e) {
      toast.error(t("general.error"), {
        description: e.message,
        dismissLabel: t("actions.close"),
      })
    }
    navigate("/settings/locations", { replace: true })
  }

  return (
    <ActionMenu
      groups={[
        {
          actions: [
            {
              icon: <PencilSquare />,
              label: t("actions.edit"),
              to: `edit`,
            },
            {
              icon: <ArchiveBox />,
              label: t("location.viewInventory"),
              to: `/inventory?location_id=${location.id}`,
            },
          ],
        },
        {
          actions: [
            {
              icon: <Trash />,
              label: t("actions.delete"),
              onClick: handleDelete,
            },
          ],
        },
      ]}
    />
  )
}
