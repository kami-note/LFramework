import { createValidateBody } from "@lframework/shared";
import { createUserSchema } from "../../../application/dtos/create-user.dto";

export const validateCreateUser = createValidateBody(createUserSchema);
