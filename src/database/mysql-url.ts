/** Normalize JDBC URLs returned by hosting panels to Node URL-compatible MySQL URLs. */
export function normalizeMysqlConnectionString(raw: string): string {
  return String(raw ?? '').trim().replace(/^jdbc:/i, '');
}

/** Reject common template values that otherwise cause ENOTFOUND HOST at runtime. */
export function isMysqlPlaceholderHost(host: string): boolean {
  return /^(?:HOST|HOTE|EXAMPLE|YOUR_HOST|YOURHOST|DB_HOST|MYSQL_HOST|CHANGE_ME|CHANGEME)$/i.test(String(host ?? '').trim());
}
