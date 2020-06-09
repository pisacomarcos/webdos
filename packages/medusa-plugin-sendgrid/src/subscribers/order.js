class OrderSubscriber {
  constructor({ sendgridService, eventBusService }) {
    this.sendgridService_ = sendgridService

    this.eventBus_ = eventBusService

    this.eventBus_.subscribe("order.placed", async (order) => {
      // TODO: How to make from and subject dynamic
      await this.sendgridService_.sendEmail(
        "order.placed",
        "Oli",
        "Order confirmation",
        order
      )
    })

    this.eventBus_.subscribe("order.cancelled", async (order) => {
      // TODO: How to make from and subject dynamic
      await this.sendgridService_.sendEmail(
        "order.cancelled",
        "Oli",
        "Order confirmation",
        order
      )
    })

    this.eventBus_.subscribe("order.updated", async (order) => {
      // TODO: How to make from and subject dynamic
      await this.sendgridService_.sendEmail(
        "order.updated",
        "Oli",
        "Order confirmation",
        order
      )
    })
  }
}

export default OrderSubscriber
