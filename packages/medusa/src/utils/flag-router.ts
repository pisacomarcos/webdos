import { FeatureFlagTypes } from "@medusajs/types"

export class FlagRouter implements FeatureFlagTypes.IFlagRouter {
  private flags: Record<string, boolean | Record<string, boolean>> = {}

  constructor(flags: Record<string, boolean | Record<string, boolean>>) {
    this.flags = flags
  }

  /**
   * Check if a feature flag is enabled.
   * There are two ways of using this method:
   * 1. `isFeatureEnabled("myFeatureFlag")`
   * 2. `isFeatureEnabled({ myNestedFeatureFlag: "someNestedFlag" })`
   * We use 1. for top-level feature flags and 2. for nested feature flags. Almost all flags are top-level.
   * An example of a nested flag is workflows. To use it, you would do:
   * `isFeatureEnabled({ workflows: Workflows.CreateCart })`
   * @param flag - The flag to check
   * @return {boolean} - Whether the flag is enabled or not
   */
  public isFeatureEnabled(flag: string | Record<string, string>): boolean {
    if (typeof flag === `string`) {
      return !!this.flags[flag]
    }

    const [nestedFlag, value] = Object.entries(flag)[0]

    return !!this.flags[nestedFlag]?.[value]
  }

  /**
   * Sets a feature flag.
   * Flags take two shapes:
   * setFlag("myFeatureFlag", true)
   * setFlag("myFeatureFlag", { nestedFlag: true })
   * These shapes are used for top-level and nested flags respectively, as explained in isFeatureEnabled.
   * @param key - The key of the flag to set.
   * @param value - The value of the flag to set.
   * @return {void} - void
   */
  public setFlag(
    key: string,
    value: boolean | { [key: string]: boolean }
  ): void {
    if (typeof value === `object`) {
      const existing = this.flags[key]

      if (!existing) {
        this.flags[key] = value
        return
      }

      this.flags[key] = { ...(this.flags[key] as object), ...value }
      return
    }

    this.flags[key] = value
  }

  public listFlags(): FeatureFlagTypes.FeatureFlagsResponse {
    return Object.entries(this.flags || {}).map(([key, value]) => ({
      key,
      value,
    }))
  }
}
