/**
 * Porta: notificação de usuário criado (evento + cache).
 * Use cases dependem desta abstração (DIP); a implementação fica em infrastructure.
 */
export interface UserCreatedNotifyInput {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface IUserCreatedNotifier {
  notify(user: UserCreatedNotifyInput): Promise<void>;
}
