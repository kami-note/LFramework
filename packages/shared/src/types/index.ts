/**
 * Barrel de tipos compartilhados entre microserviços.
 * Reexporta a partir de http e dtos; as exportações originais permanecem nos módulos de origem.
 */
export type {
  JwtPayload,
  AuthenticatedRequest,
  RequestWithRequestId,
  HttpErrorMapping,
} from "../http";
export type { HealthResponseDto, ErrorResponseDto } from "../dtos";
