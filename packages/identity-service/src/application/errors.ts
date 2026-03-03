/**
 * Application/domain errors for identity service.
 * Subclasses of Error with name set so instanceof works.
 */

export class UserAlreadyExistsError extends Error {
  override name = "UserAlreadyExistsError";
  constructor(message = "User with this email already exists") {
    super(message);
    Object.setPrototypeOf(this, UserAlreadyExistsError.prototype);
  }
}

export class InvalidCredentialsError extends Error {
  override name = "InvalidCredentialsError";
  constructor(message = "Invalid email or password") {
    super(message);
    Object.setPrototypeOf(this, InvalidCredentialsError.prototype);
  }
}

export class InvalidEmailError extends Error {
  override name = "InvalidEmailError";
  constructor(message = "Invalid email") {
    super(message);
    Object.setPrototypeOf(this, InvalidEmailError.prototype);
  }
}

export class PasswordValidationError extends Error {
  override name = "PasswordValidationError";
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, PasswordValidationError.prototype);
  }
}
