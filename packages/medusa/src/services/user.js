import _ from "lodash"
import Scrypt from "scrypt-kdf"
import jwt from "jsonwebtoken"
import { Validator, MedusaError } from "medusa-core-utils"
import { BaseService } from "medusa-interfaces"

/**
 * Provides layer to manipulate users.
 * @implements BaseService
 */
class UserService extends BaseService {
  static Events = {
    PASSWORD_RESET: "user.password_reset",
  }

  constructor({ userRepository, eventBusService, manager }) {
    super()

    /** @private @const {UserRepository} */
    this.userRepository_ = userRepository

    /** @private @const {EventBus} */
    this.eventBus_ = eventBusService

    /** @private @const {EntityManager} */
    this.manager_ = manager
  }

  /**
   * Used to validate user ids. Throws an error if the cast fails
   * @param {string} rawId - the raw user id to validate.
   * @return {string} the validated id
   */
  validateId_(rawId) {
    return rawId
  }

  /**
   * Used to validate user email.
   * @param {string} email - email to validate
   * @return {string} the validated email
   */
  validateEmail_(email) {
    return email
  }

  /**
   * @param {Object} selector - the query object for find
   * @return {Promise} the result of the find operation
   */
  list(selector) {
    return this.userModel_.find(selector)
  }

  /**
   * Gets a user by id.
   * Throws in case of DB Error and if user was not found.
   * @param {string} userId - the id of the user to get.
   * @return {Promise<User>} the user document.
   */
  async retrieve(userId, relations = []) {
    const userRepo = this.manager_.getCustomRepository(this.userRepository_)
    const validatedId = this.validateId_(userId)

    const user = await userRepo.findOne({
      where: { id: validatedId },
      relations,
    })

    if (!user) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `User with id: ${userId} was not found`
      )
    }

    return user
  }

  /**
   * Gets a user by api token.
   * Throws in case of DB Error and if user was not found.
   * @param {string} apiToken - the token of the user to get.
   * @return {Promise<User>} the user document.
   */
  async retrieveByApiToken(apiToken) {
    const userRepo = this.manager_.getCustomRepository(this.userRepository_)

    const user = await userRepo.findOne({
      where: { api_token: apiToken },
      relations,
    })

    if (!user) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `User with api token: ${apiToken} was not found`
      )
    }

    return user
  }

  /**
   * Gets a user by email.
   * Throws in case of DB Error and if user was not found.
   * @param {string} email - the email of the user to get.
   * @return {Promise<User>} the user document.
   */
  async retrieveByEmail(email) {
    const userRepo = this.manager_.getCustomRepository(this.userRepository_)

    const user = await userRepo.findOne({
      where: { email },
      relations,
    })

    if (!user) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `User with email: ${email} was not found`
      )
    }

    return user
  }

  /**
   * Hashes a password
   * @param {string} password - the value to hash
   * @return hashed password
   */
  async hashPassword_(password) {
    const buf = await Scrypt.kdf(password, { logN: 1, r: 1, p: 1 })
    return buf.toString("base64")
  }

  /**
   * Creates a user with username being validated.
   * Fails if email is not a valid format.
   * @param {object} user - the user to create
   * @return {Promise} the result of create
   */
  async create(user, password) {
    return this.atomicPhase_(async manager => {
      const userRepo = manager.getCustomRepository(this.userRepository_)

      const validatedEmail = this.validateEmail_(user.email)
      const hashedPassword = await this.hashPassword_(password)
      user.email = validatedEmail
      user.password_hash = hashedPassword

      const created = await userRepo.create(user)

      const result = await userRepo.save(created)
      return result
    })
  }

  /**
   * Updates a user.
   * @param {object} user - the user to create
   * @return {Promise} the result of create
   */
  async update(userId, update) {
    return this.atomicPhase_(async manager => {
      const userRepo = manager.getCustomRepository(this.userRepository_)
      const validatedId = this.validateId_(userId)

      const user = await this.retrieve(validatedId)

      const { email, password_hash, metadata, ...rest } = update

      if (email) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "You are not allowed to update email"
        )
      }

      if (password_hash) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Use dedicated methods, `setPassword`, `generateResetPasswordToken` for password operations"
        )
      }

      if (metadata) {
        user.metadata = this.setMetadata(user, metadata)
      }

      for (const [key, value] of Object.entries(rest)) {
        user[key] = value
      }

      const result = await userRepo.save(user)
      return result
    })
  }

  /**
   * Deletes a user from a given user id.
   * @param {string} userId - the id of the user to delete. Must be
   *   castable as an ObjectId
   * @return {Promise} the result of the delete operation.
   */
  async delete(userId) {
    return this.atomicPhase_(async manager => {
      const userRepo = manager.getCustomRepository(this.userRepository_)

      // Should not fail, if user does not exist, since delete is idempotent
      const user = await userRepo.findOne({ where: { id: userId } })

      if (!user) return Promise.resolve()

      await userRepo.softRemove(user)

      return Promise.resolve()
    })
  }

  /**
   * Sets a password for a user
   * Fails if no user exists with userId and if the hashing of the new
   * password does not work.
   * @param {string} userId - the userId to set password for
   * @param {string} password - the old password to set
   * @returns {Promise} the result of the update operation
   */
  async setPassword_(userId, password) {
    return this.atomicPhase_(async manager => {
      const userRepo = manager.getCustomRepository(this.userRepository_)

      const user = await this.retrieve(userId)

      const hashedPassword = await this.hashPassword_(password)
      if (!hashedPassword) {
        throw new MedusaError(
          MedusaError.Types.DB_ERROR,
          `An error occured while hashing password`
        )
      }

      user.password_hash = hashedPassword

      const result = await userRepo.save(user)
      return result
    })
  }

  /**
   * Generate a JSON Web token, that will be sent to a user, that wishes to
   * reset password.
   * The token will be signed with the users current password hash as a secret
   * a long side a payload with userId and the expiry time for the token, which
   * is always 15 minutes.
   * @param {User} user - the user to reset password for
   * @returns {string} the generated JSON web token
   */
  async generateResetPasswordToken(userId) {
    const user = await this.retrieve(userId)
    const secret = user.password_hash
    const expiry = Math.floor(Date.now() / 1000) + 60 * 15
    const payload = { user_id: user.id, exp: expiry }
    const token = jwt.sign(payload, secret)
    // Notify subscribers
    this.eventBus_.emit(UserService.Events.PASSWORD_RESET, {
      email: user.email,
      token,
    })
    return token
  }

  /**
   * Decorates a user.
   * @param {User} user - the cart to decorate.
   * @param {string[]} fields - the fields to include.
   * @param {string[]} expandFields - fields to expand.
   * @return {User} return the decorated user.
   */
  async decorate(user, fields, expandFields = []) {
    const requiredFields = ["id", "metadata"]
    const decorated = _.pick(user, fields.concat(requiredFields))
    const final = await this.runDecorators_(decorated)
    return final
  }

  /**
   * Dedicated method to set metadata for a user.
   * @param {string} userId - the user to apply metadata to.
   * @param {object} metadata - the metadata to set
   * @return {Promise} resolves to the updated result.
   */
  setMetadata(user, metadata) {
    const existing = user.metadata || {}
    const newData = {}
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof key !== "string") {
        throw new MedusaError(
          MedusaError.Types.INVALID_ARGUMENT,
          "Key type is invalid. Metadata keys must be strings"
        )
      }
      newData[key] = value
    }

    const updated = {
      ...existing,
      ...newData,
    }

    return updated
  }
}

export default UserService
