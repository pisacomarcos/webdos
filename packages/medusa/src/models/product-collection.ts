<<<<<<< HEAD
import { BeforeInsert, Column, Entity, Index, JoinTable, ManyToMany, OneToMany } from "typeorm";
import _ from "lodash"
=======
import { BeforeInsert, Column, Entity, Index, OneToMany } from "typeorm"
>>>>>>> upstream/master

import { DbAwareColumn } from "../utils/db-aware-column"
import { Product } from "./product"
<<<<<<< HEAD
import { SoftDeletableEntity } from "../interfaces"
import { DbAwareColumn } from "../utils/db-aware-column"
import { generateEntityId } from "../utils"
import { Image } from "./image";
=======
import { SoftDeletableEntity } from "../interfaces/models/soft-deletable-entity"
import _ from "lodash"
import { generateEntityId } from "../utils/generate-entity-id"
>>>>>>> upstream/master

@Entity()
export class ProductCollection extends SoftDeletableEntity {
  @Column()
  title: string

  @Index({ unique: true, where: "deleted_at IS NULL" })
  @Column({ nullable: true })
  handle: string

  @OneToMany(() => Product, (product) => product.collection)
  products: Product[]

  @ManyToMany(() => Image, { cascade: ["insert"] })
  @JoinTable({
    name: "product_collection_images",
    joinColumn: {
      name: "product_collection_id",
      referencedColumnName: "id",
    },
    inverseJoinColumn: {
      name: "image_id",
      referencedColumnName: "id",
    },
  })
  images: Image[]

  @Column({ nullable: true })
  thumbnail: string

  @DbAwareColumn({ type: "jsonb", nullable: true })
  metadata: Record<string, unknown>

  @BeforeInsert()
  private createHandleIfNotProvided(): void {
    if (this.id) return

    this.id = generateEntityId(this.id, "pcol")
    if (!this.handle) {
      this.handle = _.kebabCase(this.title)
    }
  }
}

/**
 * @schema product_collection
 * title: "Product Collection"
 * description: "Product Collections represents a group of Products that are related."
 * x-resourceId: product_collection
 * required:
 *   - title
 * properties:
 *   id:
 *     type: string
 *     description: The product collection's ID
 *     example: pcol_01F0YESBFAZ0DV6V831JXWH0BG
 *   title:
 *     description: "The title that the Product Collection is identified by."
 *     type: string
 *     example: Summer Collection
 *   handle:
 *     description: "A unique string that identifies the Product Collection - can for example be used in slug structures."
 *     type: string
 *     example: summer-collection
 *   products:
 *     description: The Products contained in the Product Collection. Available if the relation `products` is expanded.
 *     type: array
 *     items:
 *       type: object
 *       description: A product collection object.
 *   created_at:
 *     type: string
 *     description: "The date with timezone at which the resource was created."
 *     format: date-time
 *   updated_at:
 *     type: string
 *     description: "The date with timezone at which the resource was updated."
 *     format: date-time
 *   deleted_at:
 *     type: string
 *     description: "The date with timezone at which the resource was deleted."
 *     format: date-time
 *   metadata:
 *     type: object
 *     description: An optional key-value map with additional details
 *     example: {car: "white"}
 */
