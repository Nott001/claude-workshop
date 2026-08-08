/**
 * A domain failure with the status the HTTP layer should answer with. The
 * routes distinguish 404 (hidden/missing), 400 (draft/range violations), 403
 * (not allowed), 409 (already registered) and 500 (write/assignment failures);
 * throwing one of these keeps that contract without dragging HTTP types into
 * the service.
 */
export class EventServiceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "EventServiceError";
    this.status = status;
  }
}
