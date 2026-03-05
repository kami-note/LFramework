import { z } from "zod";

export const userResponseDtoSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  createdAt: z.string(),
});

export type UserResponseDto = z.infer<typeof userResponseDtoSchema>;
