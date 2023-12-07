import { CartDTO } from "@medusajs/types"
import { WorkflowArguments } from "@medusajs/workflows-sdk"

type HandlerInputData = {
  cart: {
    id: string
  }
  config: {
    retrieveConfig: {
      select: string[]
      relations: string[]
    }
  }
}

enum Aliases {
  Cart = "cart",
  Config = "config",
}

export async function retrieveCart({
  container,
  data,
}: WorkflowArguments<HandlerInputData>): Promise<CartDTO> {
  const cartService = container.resolve("cartService")

  const retrieved = await cartService.retrieve(
    data[Aliases.Cart].id,
    data[Aliases.Config].retrieveConfig
  )

  return retrieved
}

retrieveCart.aliases = Aliases
