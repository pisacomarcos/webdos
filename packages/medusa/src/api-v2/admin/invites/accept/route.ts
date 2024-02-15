import { acceptInviteWorkflow } from "@medusajs/core-flows"
import { MedusaRequest, MedusaResponse } from "../../../../types/routing"
import { InviteWorkflow } from "@medusajs/types"
import { AdminPostInvitesInviteAcceptReq } from "../validators"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  if (req.auth_user?.app_metadata?.user_id) {
    res.status(200).json({ user: req.auth_user })
    return
  }

  const { token, user } = req.validatedBody as AdminPostInvitesInviteAcceptReq

  const workflow = acceptInviteWorkflow(req.scope)

  const input = {
    invite_token: token,
    auth_user_id: req.auth_user!.id,
    user: user,
  } as InviteWorkflow.AcceptInviteWorkflowInputDTO

  const { result: users } = await workflow.run({ input })

  res.status(200).json({ user: users[0] })
}
