import { AGE_CATEGORIES, EMPLOYEE_STATUSES, type AgeCategory, type EmployeeStatus } from "@/types";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return uuidPattern.test(value);
}

export function isAgeCategory(value: unknown): value is AgeCategory {
  return typeof value === "string" && AGE_CATEGORIES.includes(value as AgeCategory);
}

export function isEmployeeStatus(value: unknown): value is EmployeeStatus {
  return typeof value === "string" && EMPLOYEE_STATUSES.includes(value as EmployeeStatus);
}

export function readText(formData: FormData, key: string, maxLength = 160) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function normalizeIdentityPart(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > 256) {
    return null;
  }

  return normalized;
}
