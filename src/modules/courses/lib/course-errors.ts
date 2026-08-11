/**
 * A domain failure with the status the HTTP layer should answer with, mirroring
 * the events module's EventServiceError. Courses cannot import that class — the
 * module boundary forbids courses → events — so the live-session service throws
 * its own.
 */
export class CourseServiceError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CourseServiceError";
    this.status = status;
  }
}
