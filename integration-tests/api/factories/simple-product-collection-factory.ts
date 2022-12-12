import { Connection } from "typeorm"
import faker from "faker"
import { ProductCollection } from "@medusajs/medusa"

export type Data = {
  title?: string,
  handle: string
}

export const simpleProductCollectionFactory = async (
  connection: Connection,
  data: Data | Data[],
  seed?: number
): Promise<ProductCollection | ProductCollection[]> => {
  if (typeof seed !== "undefined") {
    faker.seed(seed)
  }

  const manager = connection.manager

  const collectionsData = Array.isArray(data) ? data : [data]

  const collections: ProductCollection[] = []

  for (const collectionData of collectionsData) {
    const collection_ = manager.create(ProductCollection, {
      id: `simple-id-${Math.random() * 1000}`,
      title: collectionData.title ?? "",
      handle: collectionData.handle
    })
    collections.push(collection_)
  }

  const productCollections = await manager.save(collections)
  return Array.isArray(data) ? productCollections : productCollections[0]
}
