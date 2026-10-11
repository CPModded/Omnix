"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OMNIX_COLORS = void 0;
exports.omnixEmbed = omnixEmbed;
exports.omnixLoading = omnixLoading;
exports.omnixSuccess = omnixSuccess;
exports.omnixError = omnixError;
const discord_js_1 = require("discord.js");
exports.OMNIX_COLORS = {
    primary: 0x7c5cff,
    success: 0x10b981,
    warning: 0xf59e0b,
    danger: 0xef4444,
    info: 0x38bdf8,
};
function omnixEmbed(title, description, color = exports.OMNIX_COLORS.primary) {
    const embed = new discord_js_1.EmbedBuilder().setColor(color).setTitle(`OMNIX · ${title}`).setTimestamp();
    if (description)
        embed.setDescription(description);
    return embed;
}
function omnixLoading(title = 'Traitement en cours', description = 'OMNIX prépare votre demande…') {
    return omnixEmbed(title, `⏳ ${description}`, exports.OMNIX_COLORS.info);
}
function omnixSuccess(title, description) {
    return omnixEmbed(title, `✓ ${description}`, exports.OMNIX_COLORS.success);
}
function omnixError(title, description) {
    return omnixEmbed(title, `✕ ${description}`, exports.OMNIX_COLORS.danger);
}
