import type { FieldSchema } from "@/lib/fieldSchema";

export function validateAttributes(
  fieldSchema: FieldSchema,
  attributes: Record<string, unknown> | undefined
): string[] {
  const errors: string[] = [];
  const attrFields = fieldSchema.filter((f) => f.kind === "attribute");
  for (const field of attrFields) {
    if (!field.required) continue;
    const value = attributes?.[field.key];
    if (value === undefined || value === null || value === "") {
      errors.push(`${field.label} is required`);
    }
  }
  return errors;
}
