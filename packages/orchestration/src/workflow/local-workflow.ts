import { Context, LoadedModule, MedusaContainer } from "@medusajs/types"
import { createContainerLike, createMedusaContainer } from "@medusajs/utils"
import { asValue } from "awilix"
import {
  DistributedTransaction,
  DistributedTransactionEvents,
  TransactionOrchestrator,
  TransactionStepsDefinition,
} from "../transaction"
import { OrchestratorBuilder } from "../transaction/orchestrator-builder"
import {
  WorkflowDefinition,
  WorkflowManager,
  WorkflowStepHandler,
} from "./workflow-manager"

type StepHandler = {
  invoke: WorkflowStepHandler
  compensate?: WorkflowStepHandler
}

export class LocalWorkflow {
  protected container: MedusaContainer
  protected workflowId: string
  protected flow: OrchestratorBuilder
  protected workflow: WorkflowDefinition
  protected handlers: Map<string, StepHandler>

  constructor(
    workflowId: string,
    modulesLoaded: LoadedModule[] | MedusaContainer
  ) {
    const globalWorkflow = WorkflowManager.getWorkflow(workflowId)
    if (!globalWorkflow) {
      throw new Error(`Workflow with id "${workflowId}" not found.`)
    }

    this.flow = new OrchestratorBuilder(globalWorkflow.flow_)
    this.workflowId = workflowId
    this.workflow = globalWorkflow
    this.handlers = new Map(globalWorkflow.handlers_)

    let container

    if (!Array.isArray(modulesLoaded) && modulesLoaded) {
      if (!("cradle" in modulesLoaded)) {
        container = createContainerLike(modulesLoaded)
      } else {
        container = modulesLoaded
      }
    } else if (Array.isArray(modulesLoaded) && modulesLoaded.length) {
      container = createMedusaContainer()

      for (const mod of modulesLoaded) {
        const registrationName = mod.__definition.registrationName
        container.register(registrationName, asValue(mod))
      }
    }

    this.container = container
  }

  protected commit() {
    const finalFlow = this.flow.build()

    this.workflow = {
      id: this.workflowId,
      flow_: finalFlow,
      orchestrator: new TransactionOrchestrator(this.workflowId, finalFlow),
      handler: WorkflowManager.buildHandlers(this.handlers),
      handlers_: this.handlers,
    }
  }

  public getFlow() {
    if (this.flow.hasChanges) {
      this.commit()
    }

    return this.workflow.flow_
  }

  private registerEventCallbacks(
    orchestrator: TransactionOrchestrator,
    transaction?: DistributedTransaction,
    subscribe?: DistributedTransactionEvents
  ) {
    if (subscribe?.onBegin) {
      orchestrator.on("begin", subscribe.onBegin)
    }

    if (subscribe?.onResume) {
      orchestrator.on("resume", subscribe.onResume)
    }

    if (subscribe?.onCompensateBegin) {
      orchestrator.on("compensateBegin", subscribe.onCompensateBegin)
    }

    if (subscribe?.onFinish) {
      orchestrator.on("finish", subscribe.onFinish)
    }

    if (subscribe?.onTimeout) {
      orchestrator.on("timeout", subscribe.onTimeout)
    }

    if (transaction) {
      if (subscribe?.onStepBegin) {
        transaction.on("stepBegin", subscribe.onStepBegin)
      }

      if (subscribe?.onStepSuccess) {
        transaction.on("stepSuccess", subscribe.onStepSuccess)
      }

      if (subscribe?.onStepFailure) {
        transaction.on("stepFailure", subscribe.onStepFailure)
      }

      if (subscribe?.onCompensateStepSuccess) {
        transaction.on(
          "compensateStepSuccess",
          subscribe.onCompensateStepSuccess
        )
      }

      if (subscribe?.onCompensateStepFailure) {
        transaction.on(
          "compensateStepFailure",
          subscribe.onCompensateStepFailure
        )
      }
    } else {
      orchestrator.once("resume", (transaction) => {
        if (subscribe?.onStepBegin) {
          transaction.on("stepBegin", subscribe.onStepBegin)
        }

        if (subscribe?.onStepSuccess) {
          transaction.on("stepSuccess", subscribe.onStepSuccess)
        }

        if (subscribe?.onStepFailure) {
          transaction.on("stepFailure", subscribe.onStepFailure)
        }

        if (subscribe?.onCompensateStepSuccess) {
          transaction.on(
            "compensateStepSuccess",
            subscribe.onCompensateStepSuccess
          )
        }

        if (subscribe?.onCompensateStepFailure) {
          transaction.on(
            "compensateStepFailure",
            subscribe.onCompensateStepFailure
          )
        }
      })
    }
  }

  async run(
    uniqueTransactionId: string,
    input?: unknown,
    context?: Context,
    subscribe?: DistributedTransactionEvents
  ) {
    if (this.flow.hasChanges) {
      this.commit()
    }

    const { handler, orchestrator } = this.workflow

    const transaction = await orchestrator.beginTransaction(
      uniqueTransactionId,
      handler(this.container, context),
      input
    )

    this.registerEventCallbacks(orchestrator, transaction, subscribe)

    await orchestrator.resume(transaction)

    return transaction
  }

  async getRunningTransaction(uniqueTransactionId: string, context?: Context) {
    const { handler, orchestrator } = this.workflow

    const transaction = await orchestrator.retrieveExistingTransaction(
      uniqueTransactionId,
      handler(this.container, context)
    )

    return transaction
  }

  async cancel(uniqueTransactionId: string, context?: Context) {
    const { orchestrator } = this.workflow

    const transaction = await this.getRunningTransaction(
      uniqueTransactionId,
      context
    )

    await orchestrator.cancelTransaction(transaction)

    return transaction
  }

  async registerStepSuccess(
    idempotencyKey: string,
    response?: unknown,
    context?: Context,
    subscribe?: DistributedTransactionEvents
  ): Promise<DistributedTransaction> {
    const { handler, orchestrator } = this.workflow

    this.registerEventCallbacks(orchestrator, undefined, subscribe)

    return await orchestrator.registerStepSuccess(
      idempotencyKey,
      handler(this.container, context),
      undefined,
      response
    )
  }

  async registerStepFailure(
    idempotencyKey: string,
    error?: Error | any,
    context?: Context,
    subscribe?: DistributedTransactionEvents
  ): Promise<DistributedTransaction> {
    const { handler, orchestrator } = this.workflow

    this.registerEventCallbacks(orchestrator, undefined, subscribe)

    return await orchestrator.registerStepFailure(
      idempotencyKey,
      error,
      handler(this.container, context)
    )
  }

  addAction(
    action: string,
    handler: StepHandler,
    options: Partial<TransactionStepsDefinition> = {}
  ) {
    this.assertHandler(handler, action)
    this.handlers.set(action, handler)

    return this.flow.addAction(action, options)
  }

  replaceAction(
    existingAction: string,
    action: string,
    handler: StepHandler,
    options: Partial<TransactionStepsDefinition> = {}
  ) {
    this.assertHandler(handler, action)
    this.handlers.set(action, handler)

    return this.flow.replaceAction(existingAction, action, options)
  }

  insertActionBefore(
    existingAction: string,
    action: string,
    handler: StepHandler,
    options: Partial<TransactionStepsDefinition> = {}
  ) {
    this.assertHandler(handler, action)
    this.handlers.set(action, handler)

    return this.flow.insertActionBefore(existingAction, action, options)
  }

  insertActionAfter(
    existingAction: string,
    action: string,
    handler: StepHandler,
    options: Partial<TransactionStepsDefinition> = {}
  ) {
    this.assertHandler(handler, action)
    this.handlers.set(action, handler)

    return this.flow.insertActionAfter(existingAction, action, options)
  }

  appendAction(
    action: string,
    to: string,
    handler: StepHandler,
    options: Partial<TransactionStepsDefinition> = {}
  ) {
    this.assertHandler(handler, action)
    this.handlers.set(action, handler)

    return this.flow.appendAction(action, to, options)
  }

  moveAction(actionToMove: string, targetAction: string): OrchestratorBuilder {
    return this.flow.moveAction(actionToMove, targetAction)
  }

  moveAndMergeNextAction(
    actionToMove: string,
    targetAction: string
  ): OrchestratorBuilder {
    return this.flow.moveAndMergeNextAction(actionToMove, targetAction)
  }

  mergeActions(where: string, ...actions: string[]) {
    return this.flow.mergeActions(where, ...actions)
  }

  deleteAction(action: string, parentSteps?) {
    return this.flow.deleteAction(action, parentSteps)
  }

  pruneAction(action: string) {
    return this.flow.pruneAction(action)
  }

  protected assertHandler(handler: StepHandler, action: string): void | never {
    if (!handler?.invoke) {
      throw new Error(
        `Handler for action "${action}" is missing invoke function.`
      )
    }
  }
}
