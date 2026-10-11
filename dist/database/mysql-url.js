"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMysqlConnectionString = normalizeMysqlConnectionString;
exports.isMysqlPlaceholderHost = isMysqlPlaceholderHost;
/** Normalize JDBC URLs returned by hosting panels to Node URL-compatible MySQL URLs. */
function normalizeMysqlConnectionString(raw) {
    return String(raw ?? '').trim().replace(/^jdbc:/i, '');
}
/** Reject common template values that otherwise cause ENOTFOUND HOST at runtime. */
function isMysqlPlaceholderHost(host) {
    return /^(?:HOST|HOTE|EXAMPLE|YOUR_HOST|YOURHOST|DB_HOST|MYSQL_HOST|CHANGE_ME|CHANGEME)$/i.test(String(host ?? '').trim());
}
