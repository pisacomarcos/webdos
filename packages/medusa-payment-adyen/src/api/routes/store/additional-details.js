import { Validator, MedusaError } from "medusa-core-utils"

export default async (req, res) => {
  const schema = Validator.object().keys({
    payment_data: Validator.any().required(),
    details: Validator.any().required(),
    cart_id: Validator.string().required(),
  })

  const { value, error } = schema.validate(req.body)
  if (error) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, error.details)
  }

  try {
    const adyen = req.scope.resolve("adyenService")
    const cartService = req.scope.resolve("cartService")

    const result = await adyen.additionalDetails(
      value.payment_data,
      value.details
    )

    const updatedPaymentSession = {
      pspReference: result.pspReference,
      resultCode: result.resultCode,
    }

    const cart = await cartService.retrieve(value.cart_id)

    await cartService.updatePaymentSession(
      cart._id,
      cart.payment_method.provider_id,
      updatedPaymentSession
    )

    res.status(200).json({ data: result })
  } catch (err) {
    throw err
  }
}
