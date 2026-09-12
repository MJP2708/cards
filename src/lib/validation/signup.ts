import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

/**
 * One schema, imported by both the sign-up form and the route handler, so the
 * inline errors a user sees are produced by exactly the rules the server enforces.
 */
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.");

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your full name."),
    storeName: z.string().trim().min(1, "Enter your store name."),
    email: z.email("Enter a valid email address.").trim().toLowerCase(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Both passwords must match.",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;
