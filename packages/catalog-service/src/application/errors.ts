/**
 * Application/domain errors for catalog service.
 * Subclasses of Error with name set so instanceof works.
 */

export class InvalidItemError extends Error {
  override name = "InvalidItemError";
  constructor(message = "Invalid item") {
    super(message);
    Object.setPrototypeOf(this, InvalidItemError.prototype);
  }
}
