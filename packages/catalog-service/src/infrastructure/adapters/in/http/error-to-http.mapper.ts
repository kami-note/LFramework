import { createErrorToHttpMapper } from "@lframework/shared";
import { InvalidItemError } from "../../../../application/errors";

/**
 * Mapeia erros de aplicação/domínio para resposta HTTP (status + mensagem).
 * Centraliza as regras em um único lugar (SRP); controllers só orquestram.
 */
export const mapApplicationErrorToHttp = createErrorToHttpMapper([[InvalidItemError, 400]]);
