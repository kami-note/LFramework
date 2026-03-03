/**
 * Value Object: Email.
 * Imutável e com validação básica.
 */
export class Email {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(value: string): Email {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new Error("Invalid email");
    }
    return new Email(trimmed);
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }
}
