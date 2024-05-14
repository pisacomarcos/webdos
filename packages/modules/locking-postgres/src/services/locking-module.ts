import {
  Context,
  ILockingModuleService,
  InternalModuleDeclaration,
} from "@medusajs/types"
import { isDefined } from "@medusajs/utils"
import { EntityManager } from "@mikro-orm/core"

type InjectedDependencies = {
  manager: EntityManager
}

export default class LockingModuleService implements ILockingModuleService {
  protected manager: EntityManager

  constructor(
    container: InjectedDependencies,
    protected readonly moduleDeclaration: InternalModuleDeclaration
  ) {
    this.manager = container.manager
  }

  private getManager(): any {
    return this.manager
  }

  async execute<T>(
    key: string,
    job: () => Promise<T>,
    timeoutSeconds = 5,
    sharedContext: Context = {}
  ): Promise<T> {
    const numKey = this.hashStringToInt(key)

    return await this.getManager().transactional(async (manager) => {
      const ops: Promise<unknown>[] = []
      if (timeoutSeconds > 0) {
        ops.push(this.getTimeout(timeoutSeconds))
      }

      const fnName = "pg_advisory_xact_lock"
      const lock = new Promise((ok, nok) => {
        manager
          .execute(`SELECT ${fnName}(?)`, [numKey])
          .then((rs) => ok(rs[0][fnName]))
          .catch((err) => nok(err))
      })
      ops.push(lock)

      await Promise.race(ops)

      return await job()
    })
  }

  private async loadLock(key: string): Promise<{
    owner_id: string | null
    expiration: number | null
    now: number
  }> {
    const [row] = await this.getManager().execute(
      `SELECT owner_id, expiration, NOW() AS now FROM locking WHERE id = ?`,
      [key]
    )

    return row
  }

  async acquire(
    key: string,
    ownerId: string | null = null,
    expire?: number,
    sharedContext: Context = {}
  ): Promise<void> {
    const row = await this.loadLock(key)

    if (!row) {
      const expireSql = expire
        ? "NOW() + INTERVAL '${+expire} SECONDS'"
        : "NULL"

      try {
        await this.getManager().execute(
          `INSERT INTO locking (id, owner_id, expiration) VALUES (?, ?, ${expireSql})`,
          [key, ownerId ?? null]
        )
      } catch (err) {
        if (err.toString().includes("locking_pkey")) {
          const owner = await this.loadLock(key)
          if (ownerId != owner.owner_id) {
            throw new Error(`"${key}" is already locked.`)
          }
        } else {
          throw err
        }
      }
      return
    }

    if (row.owner_id !== ownerId) {
      throw new Error(`"${key}" is already locked.`)
    }

    if (!row.expiration && row.owner_id == ownerId) {
      return
    }

    const canRefresh =
      row.owner_id == ownerId && (expire || row.expiration! <= row.now)

    if (!canRefresh || !expire) {
      return
    }

    await this.getManager().execute(
      `UPDATE locking SET owner_id = ?, expiration = NOW() + INTERVAL '${+expire} SECONDS' WHERE id = ?`,
      [ownerId ?? null, key]
    )
  }

  async release(
    key: string,
    ownerId: string | null = null,
    sharedContext: Context = {}
  ): Promise<boolean> {
    const row = await this.loadLock(key)

    if (!row || row.owner_id != ownerId) {
      return false
    }

    await this.getManager().execute(`DELETE FROM locking WHERE id = ?`, [key])

    return !row.expiration || row.expiration > row.now
  }

  async releaseAll(
    ownerId: string | null = null,
    sharedContext: Context = {}
  ): Promise<void> {
    if (!isDefined(ownerId)) {
      await this.getManager().execute(`TRUNCATE TABLE locking`)
    } else {
      await this.getManager().execute(
        `DELETE FROM locking WHERE owner_id = ?`,
        [ownerId]
      )
    }
  }

  private hashStringToInt(str): number {
    let hash = 5381
    for (let i = str.length; i--; ) {
      hash = (hash * 33) ^ str.charCodeAt(i)
    }
    return hash >>> 0
  }

  private async getTimeout(seconds): Promise<void> {
    return new Promise((ok, nok) => {
      setTimeout(() => {
        nok(new Error("Timed-out acquiring lock."))
      }, seconds * 1000)
    })
  }
}
