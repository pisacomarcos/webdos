import * as ModuleModels from "@models"
import * as ModuleServices from "@services"

import { ModulesSdkUtils } from "@medusajs/utils"

export default ModulesSdkUtils.moduleContainerLoaderFactory({
  moduleModels: ModuleModels,
  moduleServices: ModuleServices,
})
