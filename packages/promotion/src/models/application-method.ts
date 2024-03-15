import {
  ApplicationMethodAllocationValues,
  ApplicationMethodTargetTypeValues,
  ApplicationMethodTypeValues,
  BigNumberRawValue,
  DAL,
} from "@medusajs/types"
import {
  BigNumber,
  DALUtils,
  MikroOrmBigNumberProperty,
  PromotionUtils,
  generateEntityId,
} from "@medusajs/utils"
import {
  BeforeCreate,
  Collection,
  Entity,
  Enum,
  Filter,
  Index,
  ManyToMany,
  OnInit,
  OneToOne,
  OptionalProps,
  PrimaryKey,
  Property,
} from "@mikro-orm/core"
import Promotion from "./promotion"
import PromotionRule from "./promotion-rule"

type OptionalFields =
  | "value"
  | "max_quantity"
  | "apply_to_quantity"
  | "buy_rules_min_quantity"
  | "allocation"
  | DAL.SoftDeletableEntityDateColumns

@Entity({ tableName: "promotion_application_method" })
@Filter(DALUtils.mikroOrmSoftDeletableFilterOptions)
export default class ApplicationMethod {
  [OptionalProps]?: OptionalFields

  @PrimaryKey({ columnType: "text" })
  id!: string

  @MikroOrmBigNumberProperty({ nullable: true })
  value: BigNumber | number | null = null

  @Property({ columnType: "jsonb", nullable: true })
  raw_value: BigNumberRawValue | null = null

  @Property({ columnType: "numeric", nullable: true, serializer: Number })
  max_quantity?: number | null = null

  @Property({ columnType: "numeric", nullable: true, serializer: Number })
  apply_to_quantity?: number | null = null

  @Property({ columnType: "numeric", nullable: true, serializer: Number })
  buy_rules_min_quantity?: number | null = null

  @Index({ name: "IDX_application_method_type" })
  @Enum(() => PromotionUtils.ApplicationMethodType)
  type: ApplicationMethodTypeValues

  @Index({ name: "IDX_application_method_target_type" })
  @Enum(() => PromotionUtils.ApplicationMethodTargetType)
  target_type: ApplicationMethodTargetTypeValues

  @Index({ name: "IDX_application_method_allocation" })
  @Enum({
    items: () => PromotionUtils.ApplicationMethodAllocation,
    nullable: true,
  })
  allocation?: ApplicationMethodAllocationValues

  @OneToOne({
    entity: () => Promotion,
    deleteRule: "cascade",
  })
  promotion: Promotion

  @ManyToMany(() => PromotionRule, "method_target_rules", {
    owner: true,
    pivotTable: "application_method_target_rules",
    cascade: ["soft-remove"] as any,
  })
  target_rules = new Collection<PromotionRule>(this)

  @ManyToMany(() => PromotionRule, "method_buy_rules", {
    owner: true,
    pivotTable: "application_method_buy_rules",
    cascade: ["soft-remove"] as any,
  })
  buy_rules = new Collection<PromotionRule>(this)

  @Property({
    onCreate: () => new Date(),
    columnType: "timestamptz",
    defaultRaw: "now()",
  })
  created_at: Date

  @Property({
    onCreate: () => new Date(),
    onUpdate: () => new Date(),
    columnType: "timestamptz",
    defaultRaw: "now()",
  })
  updated_at: Date

  @Property({ columnType: "timestamptz", nullable: true })
  deleted_at: Date | null = null

  @BeforeCreate()
  onCreate() {
    this.id = generateEntityId(this.id, "proappmet")
  }

  @OnInit()
  onInit() {
    this.id = generateEntityId(this.id, "proappmet")
  }
}
