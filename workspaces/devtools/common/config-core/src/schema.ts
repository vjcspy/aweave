import {
  type ConfigSchema,
  ConfigValidationError,
  type ValidationIssue,
} from './types';

// ---------------------------------------------------------------------------
// Schema validation for config files
// ---------------------------------------------------------------------------

/**
 * Validate a parsed config object against a schema definition.
 * Throws `ConfigValidationError` if validation fails.
 *
 * @param config   Parsed config object
 * @param schema   Schema definition
 * @param filePath File path (for error messages)
 */
export function validateConfig(
  config: Record<string, unknown>,
  schema: ConfigSchema,
  filePath: string,
): void {
  const issues: ValidationIssue[] = [];

  // Check configVersion if schema specifies one
  if (schema.configVersion != null) {
    const actual = config.configVersion;
    if (actual != null && actual !== schema.configVersion) {
      issues.push({
        path: 'configVersion',
        message: `Expected version ${schema.configVersion}, got ${actual}`,
        expected: String(schema.configVersion),
        actual: String(actual),
      });
    }
  }

  // Validate each declared field
  for (const [fieldPath, fieldDef] of Object.entries(schema.fields)) {
    const value = getNestedValue(config, fieldPath);

    if (value === undefined) {
      if (fieldDef.required) {
        issues.push({
          path: fieldPath,
          message: `Required field is missing`,
          expected: fieldDef.type,
        });
      }
      continue;
    }

    const actualType = getValueType(value);
    if (actualType !== fieldDef.type) {
      issues.push({
        path: fieldPath,
        message: `Expected type "${fieldDef.type}", got "${actualType}"`,
        expected: fieldDef.type,
        actual: actualType,
      });
    }
  }

  if (issues.length > 0) {
    throw new ConfigValidationError(filePath, issues);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get a nested value using dot-notation path.
 * E.g. getNestedValue({ server: { port: 3000 } }, "server.port") → 3000
 */
function getNestedValue(
  obj: Record<string, unknown>,
  dotPath: string,
): unknown {
  const keys = dotPath.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}

function getValueType(value: unknown): string {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}
