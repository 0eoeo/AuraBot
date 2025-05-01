const { leaveVoice } = require('../js/voice/manager');

module.exports = function leave(message) {
  leaveVoice(message);
};
