/** Normalize JDBC URLs returned by hosting panels to Node URL-compatible MySQL URLs. */
export function normalizeMysqlConnectionString(raw: string): string {
  return String(raw ?? '').trim().replace(/^jdbc:/i, '');
}
