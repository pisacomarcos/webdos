import {
  createPsqlIndexStatementHelper,
  generateEntityId,
} from "@medusajs/utils"
import {
  BeforeCreate,
  Cascade,
  Entity,
  ManyToOne,
  OnInit,
} from "@mikro-orm/core"
import ShippingMethod from "./shipping-method"
import TaxLine from "./tax-line"

const ShippingMethodIdIdIndex = createPsqlIndexStatementHelper({
  tableName: "order_shipping_method_tax_line",
  columns: "shipping_method_id",
})

@Entity({ tableName: "order_shipping_method_tax_line" })
export default class ShippingMethodTaxLine extends TaxLine {
  @ManyToOne({
    entity: () => ShippingMethod,
    fieldName: "shipping_method_id",
    cascade: [Cascade.REMOVE],
    persist: false,
  })
  shipping_method: ShippingMethod

  @ManyToOne({
    entity: () => ShippingMethod,
    fieldName: "shipping_method_id",
    columnType: "text",
    mapToPk: true,
    cascade: [Cascade.REMOVE],
  })
  @ShippingMethodIdIdIndex.MikroORMIndex()
  shipping_method_id: string

  @BeforeCreate()
  onCreate() {
    this.id = generateEntityId(this.id, "ordsmtxl")
  }

  @OnInit()
  onInit() {
    this.id = generateEntityId(this.id, "ordsmtxl")
  }
}
