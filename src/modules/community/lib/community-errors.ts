/**
 * A domain failure with the status the HTTP layer should answer with. The
 * routes distinguish 404 (missing/hidden) and 500 (write failures); throwing
 * one keeps that contract without dragging HTTP types into the service.
 */
export class CommunityServiceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CommunityServiceError";
    this.status = status;
  }
}
