/**
 * Application/domain errors for catalog service.
 * Extend AppError from shared so instanceof and serialization work consistently.
 */

import { AppError } from "@lframework/shared";

export class InvalidItemError extends AppError {
  override name = "InvalidItemError";
  constructor(message = "Invalid item") {
    super(message);
    Object.setPrototypeOf(this, InvalidItemError.prototype);
  }
}
