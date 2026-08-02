/**
 * Domain errors raised by the server-only feature layer.
 *
 * One class carries a machine `code` instead of a class per failure: the
 * transport layer maps the code to an HTTP status and the UI maps it to an i18n
 * key, so no user-visible prose is produced here.
 *
 * `not_found` is the code a tenant query uses when a record exists but belongs
 * to another organization — crossing the boundary must never confirm that the
 * record is real.
 */

export type DomainErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'insufficient_credits';

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'DomainError';
  }
}

/**
 * Builds the error for a request with no usable session or tenant context.
 *
 * @param message - Operator-facing detail. Never shown to the user.
 * @returns The domain error.
 */
export function unauthorizedError(message: string): DomainError {
  return new DomainError('unauthorized', message);
}

/**
 * Builds the error for an authenticated caller whose role lacks the permission.
 *
 * @param message - Operator-facing detail. Never shown to the user.
 * @returns The domain error.
 */
export function forbiddenError(message: string): DomainError {
  return new DomainError('forbidden', message);
}

/**
 * Builds the error for a record that does not exist, or that exists in another
 * organization. Both cases use this code so crossing the boundary cannot be
 * told apart from asking for something imaginary.
 *
 * @param message - Operator-facing detail. Never shown to the user.
 * @returns The domain error.
 */
export function notFoundError(message: string): DomainError {
  return new DomainError('not_found', message);
}

/**
 * Builds the error for a webhook that arrives before the records it references.
 *
 * @param message - Operator-facing detail. Never shown to the user.
 * @returns The domain error.
 */
export function conflictError(message: string): DomainError {
  return new DomainError('conflict', message);
}

/**
 * Builds the error for a spend the organization cannot cover.
 *
 * @param message - Operator-facing detail. Never shown to the user.
 * @returns The domain error.
 */
export function insufficientCreditsError(message: string): DomainError {
  return new DomainError('insufficient_credits', message);
}

/**
 * Narrows an unknown caught value to a domain error of a specific kind.
 *
 * @param error - The caught value.
 * @param code - The kind to match.
 * @returns True when the value is a domain error carrying that code.
 */
export function isDomainError(error: unknown, code: DomainErrorCode): boolean {
  return error instanceof DomainError && error.code === code;
}
