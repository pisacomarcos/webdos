import {
  Context,
  DAL,
  InternalModuleDeclaration,
  ModuleJoinerConfig,
  UserTypes,
  ModulesSdkTypes,
} from "@medusajs/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  ModulesSdkUtils,
} from "@medusajs/utils"
import { entityNameToLinkableKeysMap, joinerConfig } from "../joiner-config"

import { Invite, User } from "@models"
import InviteService from "./invite"

type InjectedDependencies = {
  baseRepository: DAL.RepositoryService
  userService: ModulesSdkTypes.InternalModuleService<any>
  inviteService: InviteService<any>
}

const generateMethodForModels = [Invite]

export default class UserModuleService<
    TUser extends User = User,
    TInvite extends Invite = Invite
  >
  extends ModulesSdkUtils.abstractModuleServiceFactory<
    InjectedDependencies,
    UserTypes.UserDTO,
    {
      Invite: {
        dto: UserTypes.InviteDTO
      }
    }
  >(User, generateMethodForModels, entityNameToLinkableKeysMap)
  implements UserTypes.IUserModuleService
{
  __joinerConfig(): ModuleJoinerConfig {
    return joinerConfig
  }

  protected baseRepository_: DAL.RepositoryService

  protected readonly userService_: ModulesSdkTypes.InternalModuleService<TUser>
  protected readonly inviteService_: InviteService<TInvite>

  constructor(
    { userService, inviteService, baseRepository }: InjectedDependencies,
    protected readonly moduleDeclaration: InternalModuleDeclaration
  ) {
    // @ts-ignore
    super(...arguments)

    this.baseRepository_ = baseRepository
    this.userService_ = userService
    this.inviteService_ = inviteService
  }

  @InjectTransactionManager("baseRepository_")
  async validateInviteToken(
    token: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<UserTypes.InviteDTO> {
    return await this.inviteService_
      .withModuleOptions(this.moduleDeclaration)
      .validateInviteToken(token, sharedContext)
  }

  create(
    data: UserTypes.CreateUserDTO[],
    sharedContext?: Context
  ): Promise<UserTypes.UserDTO[]>
  create(
    data: UserTypes.CreateUserDTO,
    sharedContext?: Context
  ): Promise<UserTypes.UserDTO>

  @InjectTransactionManager("baseRepository_")
  async create(
    data: UserTypes.CreateUserDTO[] | UserTypes.CreateUserDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<UserTypes.UserDTO | UserTypes.UserDTO[]> {
    const input = Array.isArray(data) ? data : [data]

    const users = await this.userService_.create(input, sharedContext)

    const serializedUsers = await this.baseRepository_.serialize<
      UserTypes.UserDTO[] | UserTypes.UserDTO
    >(users, {
      populate: true,
    })

    return Array.isArray(data) ? serializedUsers : serializedUsers[0]
  }

  update(
    data: UserTypes.UpdateUserDTO[],
    sharedContext?: Context
  ): Promise<UserTypes.UserDTO[]>
  update(
    data: UserTypes.UpdateUserDTO,
    sharedContext?: Context
  ): Promise<UserTypes.UserDTO>

  @InjectTransactionManager("baseRepository_")
  async update(
    data: UserTypes.UpdateUserDTO | UserTypes.UpdateUserDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<UserTypes.UserDTO | UserTypes.UserDTO[]> {
    const input = Array.isArray(data) ? data : [data]

    const updatedUsers = await this.userService_.update(input, sharedContext)

    const serializedUsers = await this.baseRepository_.serialize<
      UserTypes.UserDTO[]
    >(updatedUsers, {
      populate: true,
    })

    return Array.isArray(data) ? serializedUsers : serializedUsers[0]
  }

  createInvites(
    data: UserTypes.CreateInviteDTO[],
    sharedContext?: Context
  ): Promise<UserTypes.InviteDTO[]>
  createInvites(
    data: UserTypes.CreateInviteDTO,
    sharedContext?: Context
  ): Promise<UserTypes.InviteDTO>

  @InjectTransactionManager("baseRepository_")
  async createInvites(
    data: UserTypes.CreateInviteDTO[] | UserTypes.CreateInviteDTO,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<UserTypes.InviteDTO | UserTypes.InviteDTO[]> {
    const input = Array.isArray(data) ? data : [data]

    const invites = await this.createInvites_(input, sharedContext)

    const serializedInvites = await this.baseRepository_.serialize<
      UserTypes.InviteDTO[] | UserTypes.InviteDTO
    >(invites, {
      populate: true,
    })

    return Array.isArray(data) ? serializedInvites : serializedInvites[0]
  }

  @InjectTransactionManager("baseRepository_")
  private async createInvites_(
    data: UserTypes.CreateInviteDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<TInvite[]> {
    const toCreate = data.map((invite) => {
      return {
        ...invite,
        expires_at: new Date(),
        token: "placeholder",
      }
    })

    return await this.inviteService_
      .withModuleOptions(this.moduleDeclaration)
      .create(toCreate)
  }

  updateInvites(
    data: UserTypes.UpdateInviteDTO[],
    sharedContext?: Context
  ): Promise<UserTypes.InviteDTO[]>
  updateInvites(
    data: UserTypes.UpdateInviteDTO,
    sharedContext?: Context
  ): Promise<UserTypes.InviteDTO>

  @InjectTransactionManager("baseRepository_")
  async updateInvites(
    data: UserTypes.UpdateInviteDTO | UserTypes.UpdateInviteDTO[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<UserTypes.InviteDTO | UserTypes.InviteDTO[]> {
    const input = Array.isArray(data) ? data : [data]

    const updatedInvites = await this.inviteService_.update(
      input,
      sharedContext
    )

    const serializedInvites = await this.baseRepository_.serialize<
      UserTypes.InviteDTO[]
    >(updatedInvites, {
      populate: true,
    })

    return Array.isArray(data) ? serializedInvites : serializedInvites[0]
  }
}
