export default async (req, res) => {
  try {
    if (req.user && req.user.customer_id) {
      const customerService = req.scope.resolve("customerService")
      const customer = await customerService.retrieve(req.user.customer_id, [
        "shipping_addresses",
        "orders",
      ])
      res.json({ customer })
    } else {
      res.sendStatus(401)
    }
  } catch (err) {
    throw err
  }
}
