/**
 * Application/domain errors for identity service.
 * Extend AppError from shared so instanceof and serialization work consistently.
 */

import { AppError } from "@lframework/shared";

export class UserAlreadyExistsError extends AppError {
  override name = "UserAlreadyExistsError";
  constructor(message = "User with this email already exists") {
    super(message);
    Object.setPrototypeOf(this, UserAlreadyExistsError.prototype);
  }
}

export class InvalidCredentialsError extends AppError {
  override name = "InvalidCredentialsError";
  constructor(message = "Invalid email or password") {
    super(message);
    Object.setPrototypeOf(this, InvalidCredentialsError.prototype);
  }
}

export class InvalidEmailError extends AppError {
  override name = "InvalidEmailError";
  constructor(message = "Invalid email") {
    super(message);
    Object.setPrototypeOf(this, InvalidEmailError.prototype);
  }
}

export class PasswordValidationError extends AppError {
  override name = "PasswordValidationError";
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, PasswordValidationError.prototype);
  }
}
