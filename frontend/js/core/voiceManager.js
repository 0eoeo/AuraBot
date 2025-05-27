// voiceManager.js

const guildStates = new Map();

/**
 * Сохраняет состояние для сервера
 * @param {string} guildId
 * @param {object} state { player, connection, playbackQueue }
 */
function setGuildState(guildId, state) {
  guildStates.set(guildId, state);
}

/**
 * Возвращает состояние сервера
 * @param {string} guildId
 * @returns {object|undefined}
 */
function getGuildState(guildId) {
  return guildStates.get(guildId);
}

/**
 * Очищает состояние сервера
 * @param {string} guildId
 */
function clearGuildState(guildId) {
  guildStates.delete(guildId);
}

module.exports = { setGuildState, getGuildState, clearGuildState };
