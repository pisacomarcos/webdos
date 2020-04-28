import { IdMap } from "medusa-test-utils"

export const orders = {
  testOrder: {
    _id: IdMap.getId("test-order"),
    email: "oliver@test.dk",
    billing_address: {
      first_name: "Oli",
      last_name: "Medusa",
      address_1: "testaddress",
      city: "LA",
      country_code: "US",
      postal_code: "90002",
    },
    shipping_address: {
      first_name: "Oli",
      last_name: "Medusa",
      address_1: "testaddress",
      city: "LA",
      country_code: "US",
      postal_code: "90002",
    },
    items: [
      {
        _id: IdMap.getId("existingLine"),
        title: "merge line",
        description: "This is a new line",
        thumbnail: "test-img-yeah.com/thumb",
        content: {
          unit_price: 123,
          variant: {
            _id: IdMap.getId("can-cover"),
          },
          product: {
            _id: IdMap.getId("product"),
          },
          quantity: 1,
        },
        quantity: 10,
      },
    ],
    region: IdMap.getId("region-france"),
    customer_id: IdMap.getId("test-customer"),
    payment_method: {
      provider_id: "default_provider",
    },
    shipping_methods: [
      {
        provider_id: "default_provider",
        profile_id: IdMap.getId("default"),
        data: {},
        items: {},
      },
      {
        provider_id: "default_provider",
        profile_id: IdMap.getId("default"),
        data: {},
        items: {},
      },
    ],
  },
}

export const OrderModelMock = {
  create: jest.fn().mockReturnValue(Promise.resolve()),
  updateOne: jest.fn().mockImplementation((query, update) => {
    return Promise.resolve()
  }),
  deleteOne: jest.fn().mockReturnValue(Promise.resolve()),
  findOne: jest.fn().mockImplementation(query => {
    if (query._id === IdMap.getId("test-order")) {
      orders.testOrder.payment_status = "awaiting"
      return Promise.resolve(orders.testOrder)
    }
    if (query._id === IdMap.getId("not-fulfilled-order")) {
      orders.testOrder.fulfillment_status = "not_fulfilled"
      orders.testOrder.payment_status = "awaiting"
      return Promise.resolve(orders.testOrder)
    }
    if (query._id === IdMap.getId("fulfilled-order")) {
      orders.testOrder.fulfillment_status = "fulfilled"
      return Promise.resolve(orders.testOrder)
    }
    if (query._id === IdMap.getId("payed-order")) {
      orders.testOrder.fulfillment_status = "not_fulfilled"
      orders.testOrder.payment_status = "captured"
      return Promise.resolve(orders.testOrder)
    }
    return Promise.resolve(undefined)
  }),
}
