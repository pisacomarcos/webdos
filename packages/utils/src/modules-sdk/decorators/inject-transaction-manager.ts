import { Context } from "@medusajs/types"
import { isString } from "../../common"

export function InjectTransactionManager(
  shouldForceTransactionOrManagerProperty:
    | string
    | ((target: any) => boolean) = () => false,
  managerProperty?: string
): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: any
  ): void {
    if (!target.MedusaContextIndex_) {
      throw new Error(
        `To apply @InjectTransactionManager you have to flag a parameter using @MedusaContext`
      )
    }

    const originalMethod = descriptor.value
    const shouldForceTransaction = !isString(
      shouldForceTransactionOrManagerProperty
    )
      ? shouldForceTransactionOrManagerProperty
      : () => false
    managerProperty = isString(shouldForceTransactionOrManagerProperty)
      ? shouldForceTransactionOrManagerProperty
      : managerProperty

    const argIndex = target.MedusaContextIndex_[propertyKey]
    descriptor.value = async function (...args: any[]) {
      const shouldForceTransactionRes = shouldForceTransaction(target)
      const context: Context = args[argIndex] ?? {}
      const originalContext = args[argIndex] ?? {}

      if (!shouldForceTransactionRes && context?.transactionManager) {
        return await originalMethod.apply(this, args)
      }

      return await (!managerProperty
        ? this
        : this[managerProperty]
      ).transaction(
        async (transactionManager) => {
          const copiedContext = {} as Context
          for (const key in originalContext) {
            if (key === "transactionManager") continue
            Object.defineProperty(copiedContext, key, {
              get: function () {
                return originalContext[key]
              },
              set: function (value) {
                originalContext[key] = value
              },
            })
          }

          copiedContext.transactionManager = transactionManager
          args[argIndex] = copiedContext

          return await originalMethod.apply(this, args)
        },
        {
          transaction: context?.transactionManager,
          isolationLevel: (context as Context)?.isolationLevel,
          enableNestedTransactions:
            (context as Context).enableNestedTransactions ?? false,
        }
      )
    }
  }
}
