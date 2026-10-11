"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMysqlConnectionString = normalizeMysqlConnectionString;
/** Normalize JDBC URLs returned by hosting panels to Node URL-compatible MySQL URLs. */
function normalizeMysqlConnectionString(raw) {
    return String(raw ?? '').trim().replace(/^jdbc:/i, '');
}
