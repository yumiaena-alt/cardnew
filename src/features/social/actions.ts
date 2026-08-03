'use server';

import { revalidatePath } from 'next/cache';
import { DomainError } from '@/features/shared/errors';
import { getScope, requirePermission } from '@/features/shared/scope';
import { logger } from '@/libs/Logger';
import type {
  CreateAutomationInput,
  ToggleAutomationInput,
} from '@/validations/AutomationValidation';
import { createAutomationSchema, toggleAutomationSchema } from '@/validations/AutomationValidation';
import { deleteDmAutomation, insertDmAutomation, setAutomationActive } from './repository';

/**
 * Server Actions for DM automations.
 *
 * An automation only ever answers someone who commented on the owner's own
 * post — the private-reply flow the networks support. Nothing here can start a
 * conversation, and the shape of the data makes that true rather than the
 * wording of a policy: there is no recipient field to fill in.
 */

type AutomationFailureCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'insufficient_credits'
  | 'invalid_input';

export type AutomationResult = { ok: true } | { ok: false; code: AutomationFailureCode };

/**
 * Maps a thrown value onto a client-safe failure code.
 *
 * @param error - The caught value.
 * @returns The failure code.
 */
function toFailureCode(error: unknown): AutomationFailureCode {
  return error instanceof DomainError ? error.code : 'invalid_input';
}

/**
 * Creates an automation, switched off.
 *
 * New rules start inactive on purpose. A keyword list is easy to get wrong, and
 * a rule that starts answering the moment it is saved gives no chance to read
 * it back first.
 *
 * @param input - Account, name, keywords, and the reply to send.
 * @returns Success, or a failure code.
 */
export async function createAutomation(input: CreateAutomationInput): Promise<AutomationResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'board:edit');

    const parsed = createAutomationSchema.parse(input);

    await insertDmAutomation(scope, {
      accountId: parsed.accountId,
      name: parsed.name,
      externalPostId: parsed.externalPostId,
      keywords: parsed.keywords,
      message: parsed.message,
      linkUrl: parsed.linkUrl,
      isActive: false,
    });

    logger.info('Automation created', { orgId: scope.orgId });
    revalidatePath('/dashboard/automation');

    return { ok: true };
  } catch (error) {
    const code = toFailureCode(error);

    logger.warn('Automation create rejected', { code });

    return { ok: false, code };
  }
}

/**
 * Turns an automation on or off.
 *
 * @param input - Which automation, and whether it should run.
 * @returns Success, or a failure code.
 */
export async function toggleAutomation(input: ToggleAutomationInput): Promise<AutomationResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'board:edit');

    const parsed = toggleAutomationSchema.parse(input);
    const updated = await setAutomationActive(scope, parsed.automationId, parsed.isActive);

    if (!updated) {
      return { ok: false, code: 'not_found' };
    }

    logger.info('Automation toggled', { orgId: scope.orgId, isActive: parsed.isActive });
    revalidatePath('/dashboard/automation');

    return { ok: true };
  } catch (error) {
    return { ok: false, code: toFailureCode(error) };
  }
}

/**
 * Removes an automation.
 *
 * @param automationId - Automation to remove.
 * @returns Success, or a failure code.
 */
export async function removeAutomation(automationId: string): Promise<AutomationResult> {
  try {
    const scope = await getScope();
    requirePermission(scope, 'board:edit');

    await deleteDmAutomation(scope, automationId);
    revalidatePath('/dashboard/automation');

    return { ok: true };
  } catch (error) {
    return { ok: false, code: toFailureCode(error) };
  }
}
