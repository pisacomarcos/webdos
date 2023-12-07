import { AddressDTO } from "@medusajs/types"
import { MedusaError } from "@medusajs/utils"

import { WorkflowArguments } from "@medusajs/workflows-sdk"

type AddressesDTO = {
  shipping_address_id?: string
  billing_address_id?: string
}

type HandlerInputData = {
  addresses: AddressesDTO & {
    billing_address?: AddressDTO
    shipping_address?: AddressDTO
  }
  region: {
    region_id?: string
  }
}

enum Aliases {
  Addresses = "addresses",
  Region = "region",
}

export async function findOrCreateAddresses({
  container,
  context,
  data,
}: WorkflowArguments<HandlerInputData>): Promise<AddressesDTO> {
  const { manager } = context
  const regionService = container.resolve("regionService")
  const regionServiceTx = regionService.withTransaction(manager)

  const addressRepository = container.resolve("addressRepository")

  const shippingAddress = data[Aliases.Addresses].shipping_address
  const shippingAddressId = data[Aliases.Addresses].shipping_address_id
  const billingAddress = data[Aliases.Addresses].billing_address
  const billingAddressId = data[Aliases.Addresses].billing_address_id
  const addressesDTO: AddressesDTO = {}

  const region = await regionServiceTx.retrieve(data[Aliases.Region].region_id, {
    relations: ["countries"],
  })

  const regionCountries = region.countries.map(({ iso_2 }) => iso_2)

  if (!shippingAddress && !shippingAddressId) {
    if (region.countries.length === 1) {
      const shippingAddress = await addressRepository.save(addressRepository.create({
        country_code: regionCountries[0],
      }))

      addressesDTO.shipping_address_id = shippingAddress?.id
    }
  } else {
    if (shippingAddress) {
      if (!regionCountries.includes(shippingAddress.country_code!)) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Shipping country not in region"
        )
      }
    }

    if (shippingAddressId) {
      const address = await regionServiceTx.findOne({
        where: { id: shippingAddressId },
      })

      if (
        address?.country_code &&
        !regionCountries.includes(address.country_code)
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Shipping country not in region"
        )
      }

      addressesDTO.shipping_address_id = address.id
    }
  }

  if (billingAddress) {
    if (!regionCountries.includes(billingAddress.country_code!)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Billing country not in region"
      )
    }
  }

  if (billingAddressId) {
    const address = await regionServiceTx.findOne({
      where: { id: billingAddressId },
    })

    if (
      address?.country_code &&
      !regionCountries.includes(address.country_code)
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Billing country not in region"
      )
    }

    addressesDTO.billing_address_id = billingAddressId
  }

  return addressesDTO
}

findOrCreateAddresses.aliases = Aliases
