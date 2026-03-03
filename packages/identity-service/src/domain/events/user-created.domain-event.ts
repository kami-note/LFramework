/**
 * Evento de domínio: UserCreated.
 * Representação no bounded context Identity; shared exporta o contrato para outros serviços.
 */
export interface UserCreatedDomainEvent {
  userId: string;
  email: string;
  name: string;
  occurredAt: Date;
}
