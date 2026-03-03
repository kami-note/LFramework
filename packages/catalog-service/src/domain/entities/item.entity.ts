import { Money } from "../value-objects/money.vo";

/**
 * Entidade de domínio: Item (produto do catálogo).
 */
export class Item {
  private constructor(
    private readonly _id: string,
    private _name: string,
    private _price: Money,
    private readonly _createdAt: Date
  ) {}

  static create(id: string, name: string, price: Money): Item {
    if (!name || name.trim().length === 0) {
      throw new Error("Name is required");
    }
    return new Item(id, name.trim(), price, new Date());
  }

  static reconstitute(
    id: string,
    name: string,
    amount: number,
    currency: string,
    createdAt: Date
  ): Item {
    return new Item(id, name, Money.create(amount, currency), createdAt);
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get price(): Money {
    return this._price;
  }

  get createdAt(): Date {
    return this._createdAt;
  }
}
