/**
 * The shared base for the domain services' error classes. Carries the status
 * the HTTP layer should answer with; each module keeps a thin subclass so a
 * service never drags HTTP or a sibling module's type across its boundary.
 * `new.target.name` keeps the subclass's own name for `instanceof` and tests.
 */
export class ServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
