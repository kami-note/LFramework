import { createValidateBody } from "@lframework/shared";
import { registerSchema } from "../../application/dtos/register.dto";
import { loginSchema } from "../../application/dtos/login.dto";

export const validateRegister = createValidateBody(registerSchema);
export const validateLogin = createValidateBody(loginSchema);
