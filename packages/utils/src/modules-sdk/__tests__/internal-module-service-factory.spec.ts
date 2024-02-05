import { internalModuleServiceFactory } from "../internal-module-service-factory"
import { lowerCaseFirst } from "../../common"

const defaultContext = { __type: "MedusaContext" }

class Model {}
describe("Internal Module Service Factory", () => {
  const modelRepositoryName = `${lowerCaseFirst(Model.name)}Repository`

  const containerMock = {
    [modelRepositoryName]: {
      transaction: (task) => task(),
      getFreshManager: jest.fn().mockReturnThis(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      upsert: jest.fn(),
    },
    [`composite${Model.name}Repository`]: {
      transaction: (task) => task(),
      getFreshManager: jest.fn().mockReturnThis(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      softDelete: jest.fn(),
      restore: jest.fn(),
      upsert: jest.fn(),
    },
  }

  const internalModuleService = internalModuleServiceFactory<any>(Model)

  describe("Internal Module Service Methods", () => {
    let instance

    beforeEach(() => {
      jest.clearAllMocks()
      instance = new internalModuleService(containerMock)
    })

    test("should throw model id undefined error on retrieve if id is not defined", async () => {
      const err = await instance.retrieve().catch((e) => e)
      expect(err.message).toBe("model - id must be defined")
    })

    test("should throw an error on retrieve if composite key values are not defined", async () => {
      class CompositeModel {
        id: string
        name: string

        static meta = { primaryKeys: ["id", "name"] }
      }

      const compositeInternalModuleService =
        internalModuleServiceFactory<any>(CompositeModel)

      const instance = new compositeInternalModuleService(containerMock)

      const err = await instance.retrieve().catch((e) => e)
      expect(err.message).toBe("compositeModel - id, name must be defined")
    })

    test("should throw NOT_FOUND error on retrieve if entity not found", async () => {
      containerMock[modelRepositoryName].find.mockResolvedValueOnce([])

      const err = await instance.retrieve("1").catch((e) => e)
      expect(err.message).toBe("Model with id: 1 was not found")
    })

    test("should retrieve entity successfully", async () => {
      const entity = { id: "1", name: "Item" }
      containerMock[modelRepositoryName].find.mockResolvedValueOnce([entity])

      const result = await instance.retrieve("1")
      expect(result).toEqual(entity)
    })

    test("should retrieve entity successfully with composite key", async () => {
      class CompositeModel {
        id: string
        name: string

        static meta = { primaryKeys: ["id", "name"] }
      }

      const compositeInternalModuleService =
        internalModuleServiceFactory<any>(CompositeModel)

      const instance = new compositeInternalModuleService(containerMock)

      const entity = { id: "1", name: "Item" }
      containerMock[
        `${lowerCaseFirst(CompositeModel.name)}Repository`
      ].find.mockResolvedValueOnce([entity])

      const result = await instance.retrieve({ id: "1", name: "Item" })
      expect(result).toEqual(entity)
    })

    test("should list entities successfully", async () => {
      const entities = [
        { id: "1", name: "Item" },
        { id: "2", name: "Item2" },
      ]
      containerMock[modelRepositoryName].find.mockResolvedValueOnce(entities)

      const result = await instance.list()
      expect(result).toEqual(entities)
    })

    test("should list and count entities successfully", async () => {
      const entities = [
        { id: "1", name: "Item" },
        { id: "2", name: "Item2" },
      ]
      const count = entities.length
      containerMock[modelRepositoryName].findAndCount.mockResolvedValueOnce([
        entities,
        count,
      ])

      const result = await instance.listAndCount()
      expect(result).toEqual([entities, count])
    })

    test("should create entity successfully", async () => {
      const entity = { id: "1", name: "Item" }

      containerMock[modelRepositoryName].find.mockReturnValue([entity])

      containerMock[modelRepositoryName].create.mockImplementation(
        async (entity) => entity
      )

      const result = await instance.create(entity)
      expect(result).toEqual(entity)
    })

    test("should create entities successfully", async () => {
      const entities = [
        { id: "1", name: "Item" },
        { id: "2", name: "Item2" },
      ]

      containerMock[modelRepositoryName].find.mockResolvedValueOnce([entities])

      containerMock[modelRepositoryName].create.mockResolvedValueOnce(entities)

      const result = await instance.create(entities)
      expect(result).toEqual(entities)
    })

    test("should update entity successfully", async () => {
      const updateData = { id: "1", name: "UpdatedItem" }

      containerMock[modelRepositoryName].find.mockResolvedValueOnce([
        updateData,
      ])

      containerMock[modelRepositoryName].update.mockResolvedValueOnce([
        updateData,
      ])

      const result = await instance.update(updateData)
      expect(result).toEqual([updateData])
    })

    test("should update entities successfully", async () => {
      const updateData = { id: "1", name: "UpdatedItem" }
      const entitiesToUpdate = [{ id: "1", name: "Item" }]

      containerMock[modelRepositoryName].find.mockResolvedValueOnce(
        entitiesToUpdate
      )

      containerMock[modelRepositoryName].update.mockResolvedValueOnce([
        { entity: entitiesToUpdate[0], update: updateData },
      ])

      const result = await instance.update({ selector: {}, data: updateData })
      expect(result).toEqual([
        { entity: entitiesToUpdate[0], update: updateData },
      ])
    })

    test("should delete entity successfully", async () => {
      await instance.delete("1")
      expect(containerMock[modelRepositoryName].delete).toHaveBeenCalledWith(
        {
          $or: [
            {
              id: "1",
            },
          ],
        },
        defaultContext
      )
    })

    test("should delete entities successfully", async () => {
      const entitiesToDelete = [{ id: "1", name: "Item" }]
      containerMock[modelRepositoryName].find.mockResolvedValueOnce(
        entitiesToDelete
      )

      await instance.delete({ selector: {} })
      expect(containerMock[modelRepositoryName].delete).toHaveBeenCalledWith(
        {
          $or: [
            {
              id: "1",
            },
          ],
        },
        defaultContext
      )
    })

    test("should soft delete entity successfully", async () => {
      await instance.softDelete("1")
      expect(
        containerMock[modelRepositoryName].softDelete
      ).toHaveBeenCalledWith("1", defaultContext)
    })

    test("should restore entity successfully", async () => {
      await instance.restore("1")
      expect(containerMock[modelRepositoryName].restore).toHaveBeenCalledWith(
        "1",
        defaultContext
      )
    })
  })
})
