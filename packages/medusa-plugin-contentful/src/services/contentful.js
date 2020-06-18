import _ from "lodash"
import { createClient } from "contentful-management"
import redis from "redis"

class ContentfulService extends PaymentService {
  constructor({ productService, productVariantService, eventBus }, options) {
    super()

    this.productService_ = productService

    this.productVariantService_ = productVariantService

    this.eventBus_ = eventBus

    this.options_ = options

    this.contentful_ = createClient({
      accessToken: options.access_token,
    })

    this.redis_ = redis.createClient()
  }

  async getIgnoreIds_(type) {
    return new Promise((resolve, reject) => {
      this.redis_.get(`${type}_ignore_ids`, (err, reply) => {
        if (err) {
          return reject(err)
        }

        if (reply) {
          return reject("Missing key")
        }

        return resolve(JSON.parse(reply))
      })
    })
  }

  async getContentfulEnvironment_() {
    try {
      const space = await this.contentful_.getSpace(options.space_id)
      const environment = await space.getEnvironment(options.environment)
      return environment
    } catch (error) {
      throw error
    }
  }

  async getVariantEntries_(variantEntryIds) {
    try {
      const environment = await this.getContentfulEnvironment_()
      return Promise.all(variantEntryIds.map((v) => environment.getEntry(v)))
    } catch (error) {
      throw error
    }
  }

  async getVariantLinks_(variantEntries) {
    return variantEntries.map((v) => ({
      sys: {
        type: "Link",
        linkType: "Entry",
        id: v.sys.id,
      },
    }))
  }

  async createProductInContentful(product) {
    try {
      const environment = await this.getContentfulEnvironment_()
      const variantEntries = await this.getVariantEntries_(product.variants)
      return environment.createEntryWithId("product", product._id, {
        fields: {
          title: {
            "en-US": product.title,
          },
          variants: {
            "en-US": this.getVariantLinks_(variantEntries),
          },
          objectId: {
            "en-US": product._id,
          },
        },
      })
    } catch (error) {
      throw error
    }
  }

  async createProductVariantInContentful(variant) {
    try {
      const environment = await this.getContentfulEnvironment_()
      return environment.createEntryWithId("productVariant", variant._id, {
        fields: {
          title: {
            "en-US": variant.title,
          },
          sku: {
            "en-US": variant.sku,
          },
          prices: {
            "en-US": variant.prices,
          },
          objectId: {
            "en-US": variant._id,
          },
        },
      })
    } catch (error) {
      throw error
    }
  }

  async updateProductInContentful(product) {
    try {
      const environment = await this.getContentfulEnvironment_()
      // check if product exists
      let productEntry = undefined
      productEntry = await environment.getEntry(product._id)
      // if not, we create a new one
      if (!productEntry) {
        return this.createProductInContentful(product)
      }

      const variantEntries = await this.getVariantEntries_(product.variants)
      productEntry.fields = _.assignIn(productEntry.fields, {
        title: {
          "en-US": product.title,
        },
        variants: {
          "en-US": this.getVariantLinks_(variantEntries),
        },
      })

      await productEntry.update()
      const publishedEntry = await productEntry.publish()

      const ignoreIds = await this.getIgnoreIds_("product")
      if (ignoreIds.includes(publishedEntry.sys.id)) {
        ignoreIds.filter((id) => id !== publishedEntry.sys.id)
      } else {
        this.eventBus_.emit("product.updated", publishedEntry)
      }

      return publishedEntry
    } catch (error) {
      throw error
    }
  }

  async updateProductVariantInContentful(variant) {
    try {
      const environment = await this.getContentfulEnvironment_()
      // check if product exists
      let variantEntry = undefined
      variantEntry = await environment.getEntry(variant._id)
      // if not, we create a new one
      if (!variantEntry) {
        return this.createProductVariantInContentful(variant)
      }

      variantEntry.fields = _.assignIn(variantEntry.fields, {
        title: {
          "en-US": variant.title,
        },
        sku: {
          "en-US": variant.sku,
        },
        prices: {
          "en-US": variant.prices,
        },
        objectId: {
          "en-US": variant._id,
        },
      })

      await variantEntry.update()
      const publishedEntry = await variantEntry.publish()

      const ignoreIds = await this.getIgnoreIds_("product_variant")
      if (ignoreIds.includes(publishedEntry.sys.id)) {
        ignoreIds.filter((id) => id !== publishedEntry.sys.id)
      } else {
        this.eventBus_.emit("product-variant.updated", publishedEntry)
      }

      return publishedEntry
    } catch (error) {
      throw error
    }
  }

  async sendContentfulProductToAdmin(product) {
    try {
      const environment = await this.getContentfulEnvironment_()
      const productEntry = await environment.getEntry(product.sys.id)

      const ignoreIds = await this.getIgnoreIds_("product")
      ignoreIds.push(product.sys.id)
      this.redis_.set("product_ignore_ids", JSON.stringify(ignoreIds))

      const updatedProduct = await this.productService_.update(
        productEntry.objectId,
        {
          title: productEntry.fields.title["en-US"],
          variants: productEntry.fields.variants["en-US"],
        }
      )

      return updatedProduct
    } catch (error) {
      throw error
    }
  }

  async sendContentfulProductVariantToAdmin(variant) {
    try {
      const environment = await this.getContentfulEnvironment_()
      const variantEntry = await environment.getEntry(variant.sys.id)

      const ignoreIds = await this.getIgnoreIds_("product_variant")
      ignoreIds.push(variant.sys.id)
      this.redis_.set("product_variant_ignore_ids", JSON.stringify(ignoreIds))

      const updatedVariant = await this.variantService_.update(
        variantEntry.objectId,
        {
          title: variantEntry.fields.title["en-US"],
          sku: variantEntry.fields.sku["en-US"],
          prices: variantEntry.fields.prices["en-US"],
        }
      )

      return updatedVariant
    } catch (error) {
      throw error
    }
  }
}

export default ContentfulService
