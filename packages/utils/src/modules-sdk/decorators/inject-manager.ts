import { Context } from "@medusajs/types"

export function InjectManager(managerProperty?: string): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: any
  ): void {
    if (!target.MedusaContextIndex_) {
      throw new Error(
        `To apply @InjectManager you have to flag a parameter using @MedusaContext`
      )
    }

    const originalMethod = descriptor.value
    const argIndex = target.MedusaContextIndex_[propertyKey]

    descriptor.value = function (...args: any[]) {
      const originalContext = args[argIndex] ?? {}
      const copiedContext = {} as Context
      for (const key in originalContext) {
        if (key === "manager") continue
        Object.defineProperty(copiedContext, key, {
          get: function () {
            return originalContext[key]
          },
          set: function (value) {
            originalContext[key] = value
          },
        })
      }

      const resourceWithManager = !managerProperty
        ? this
        : this[managerProperty]

      copiedContext.manager ??= resourceWithManager.getFreshManager()
      args[argIndex] = copiedContext

      return originalMethod.apply(this, args)
    }
  }
}
