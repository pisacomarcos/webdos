export default async (req, res) => {
  // In Medusa, we store the cart id in merchant_data
  const { shipping_address, merchant_data } = req.body

  try {
    const cartService = req.scope.resolve("cartService")
    const klarnaProviderService = req.scope.resolve("pp_klarna")
    const shippingProfileService = req.scope.resolve("shippingProfileService")

    const cart = await cartService.retrieve(merchant_data, {
      select: ["subtotal"],
      relations: [
        "shipping_address",
        "billing_address",
        "region",
        "items",
        "items.variant",
        "items.variant.product",
      ],
    })

    if (shipping_address) {
      const shippingAddress = {
        ...cart.shipping_address,
        first_name: shipping_address.given_name,
        last_name: shipping_address.family_name,
        address_1: shipping_address.street_address,
        address_2: shipping_address.street_address2,
        city: shipping_address.city,
        country_code: shipping_address.country.toUpperCase(),
        postal_code: shipping_address.postal_code,
        phone: shipping_address.phone,
      }

      let billingAddress = {
        first_name: shipping_address.given_name,
        last_name: shipping_address.family_name,
        address_1: shipping_address.street_address,
        address_2: shipping_address.street_address2,
        city: shipping_address.city,
        country_code: shipping_address.country.toUpperCase(),
        postal_code: shipping_address.postal_code,
        phone: shipping_address.phone,
      }

      if (cart.billing_address) {
        billingAddress = {
          ...billingAddress,
          ...cart.billing_address,
        }
      }

      await cartService.update(cart.id, {
        shipping_address: shippingAddress,
        billing_address: billingAddress,
        email: shipping_address.email,
      })

      const shippingOptions = await shippingProfileService.fetchCartOptions(
        cart
      )
      const option = shippingOptions[0]
      await cartService.addShippingMethod(cart.id, option.id, option.data)

      // Fetch and return updated Klarna order
      const updatedCart = await cartService.retrieve(cart.id, {
        select: [
          "subtotal",
          "total",
          "tax_total",
          "discount_total",
          "subtotal",
        ],
        relations: [
          "shipping_address",
          "billing_address",
          "region",
          "items",
          "items.variant",
          "items.variant.product",
        ],
      })
      const order = await klarnaProviderService.cartToKlarnaOrder(updatedCart)
      res.json(order)
      return
    } else {
      res.sendStatus(400)
      return
    }
  } catch (error) {
    throw error
  }
}
