/**
 * Value Object: Money (simplificado para exemplo).
 * Imutável; valor em centavos ou unidade base.
 */
export class Money {
  private constructor(
    private readonly _amount: number,
    private readonly _currency: string
  ) {}

  static create(amount: number, currency: string = "BRL"): Money {
    if (amount < 0) throw new Error("Amount cannot be negative");
    if (!currency || currency.length !== 3) throw new Error("Invalid currency");
    return new Money(amount, currency);
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): string {
    return this._currency;
  }
}
