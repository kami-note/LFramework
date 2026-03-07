import { createValidateBody } from "@lframework/shared";
import { createItemSchema } from "../../../../application/dtos/create-item.dto";

export const validateCreateItem = createValidateBody(createItemSchema);
