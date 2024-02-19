import { Context, DAL } from "@medusajs/types"
import {
  InjectTransactionManager,
  MedusaError,
  ModulesSdkUtils,
} from "@medusajs/utils"
import { Invite } from "@models"
import { InviteServiceTypes } from "@types"
import jwt, { JwtPayload } from "jsonwebtoken"

type InjectedDependencies = {
  inviteRepository: DAL.RepositoryService
}

// 7 days
const DEFAULT_VALID_INVITE_DURATION = 1000 * 60 * 60 * 24 * 7

export default class InviteService<
  TEntity extends Invite = Invite
> extends ModulesSdkUtils.internalModuleServiceFactory<InjectedDependencies>(
  Invite
)<TEntity> {
  // eslint-disable-next-line max-len
  protected readonly inviteRepository_: DAL.RepositoryService<TEntity>
  protected options: any

  constructor(container: InjectedDependencies) {
    super(container)
    this.inviteRepository_ = container.inviteRepository
  }

  public withModuleOptions(options: any) {
    const service = new InviteService<TEntity>(this.__container__)

    service.options = options

    return service
  }

  create(
    data: InviteServiceTypes.CreateInviteDTO,
    context?: Context
  ): Promise<TEntity>
  create(
    data: InviteServiceTypes.CreateInviteDTO[],
    context?: Context
  ): Promise<TEntity[]>

  @InjectTransactionManager("inviteRepository_")
  async create(
    data:
      | InviteServiceTypes.CreateInviteDTO
      | InviteServiceTypes.CreateInviteDTO[],
    context: Context = {}
  ): Promise<TEntity | TEntity[]> {
    const data_ = Array.isArray(data) ? data : [data]

    const invites = await super.create(data_, context)

    const updates = invites.map((invite) => {
      return {
        id: invite.id,
        expires_at: new Date().setMilliseconds(
          new Date().getMilliseconds() + this.options?.valid_duration ||
            DEFAULT_VALID_INVITE_DURATION
        ),
        token: this.generateToken({ id: invite.id }),
      }
    })

    return await super.update(updates, context)
  }

  @InjectTransactionManager("inviteRepository_")
  async validateInviteToken(
    token: string,
    context?: Context
  ): Promise<TEntity> {
    const decoded = this.validateToken(token)

    return await super.retrieve(decoded.payload.id, {}, context)
  }

  private generateToken(data: any): string {
    const jwtSecret = this.options?.jwt_secret as string | undefined

    if (!jwtSecret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No jwt_secret was provided in the UserModule's options. Please add one."
      )
    }

    return jwt.sign(data, jwtSecret, {
      expiresIn: this.options?.valid_duration || DEFAULT_VALID_INVITE_DURATION,
    })
  }
  private validateToken(data: any): JwtPayload {
    const jwtSecret = this.options?.jwt_secret as string | undefined

    if (!jwtSecret) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "No jwt_secret was provided in the UserModule's options. Please add one."
      )
    }

    return jwt.verify(data, jwtSecret, { complete: true })
  }
}
