import { Email } from "../value-objects/email.vo";

/**
 * Entidade de domínio: User.
 * Identidade: id. Regras de negócio no domínio.
 */
export class User {
  private constructor(
    private readonly _id: string,
    private _email: Email,
    private _name: string,
    private readonly _role: string,
    private readonly _createdAt: Date
  ) {}

  static create(id: string, email: Email, name: string, role: string = "user"): User {
    if (!name || name.trim().length === 0) {
      throw new Error("Name is required");
    }
    return new User(id, email, name.trim(), role, new Date());
  }

  static reconstitute(
    id: string,
    email: string,
    name: string,
    createdAt: Date,
    role: string = "user"
  ): User {
    return new User(id, Email.create(email), name, role, createdAt);
  }

  get id(): string {
    return this._id;
  }

  get email(): Email {
    return this._email;
  }

  get name(): string {
    return this._name;
  }

  get role(): string {
    return this._role;
  }

  get createdAt(): Date {
    return this._createdAt;
  }
}
