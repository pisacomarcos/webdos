import { CampaignBudgetType } from "@medusajs/utils"

export const defaultCampaignsData = [
  {
    id: "campaign-id-1",
    name: "campaign 1",
    description: "test description",
    currency: "USD",
    campaign_identifier: "test-1",
    starts_at: new Date("01/01/2023"),
    ends_at: new Date("01/01/2024"),
    campaign_budget: {
      type: CampaignBudgetType.SPEND,
      limit: 1000,
      used: 0,
    },
  },
  {
    id: "campaign-id-2",
    name: "campaign 1",
    description: "test description",
    currency: "USD",
    campaign_identifier: "test-2",
    starts_at: new Date("01/01/2023"),
    ends_at: new Date("01/01/2024"),
    campaign_budget: {
      type: CampaignBudgetType.USAGE,
      limit: 1000,
      used: 0,
    },
  },
]
