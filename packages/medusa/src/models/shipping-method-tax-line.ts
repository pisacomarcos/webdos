import {
  BeforeInsert,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from "typeorm"

import { TaxLine } from "./tax-line"
import { ShippingMethod } from "./shipping-method"
import { generateAndApplyEntityId } from "../utils/generate-and-apply-entity-id"

@Entity()
@Unique(["shipping_method_id", "code"])
export class ShippingMethodTaxLine extends TaxLine {
  @Index()
  @Column()
  shipping_method_id: string

  @ManyToOne(() => ShippingMethod, (sm) => sm.tax_lines)
  @JoinColumn({ name: "shipping_method_id" })
  shipping_method: ShippingMethod

  @BeforeInsert()
  private beforeInsert(): void {
    generateAndApplyEntityId(this, "id", "smtl")
  }
}
