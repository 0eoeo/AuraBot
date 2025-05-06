const { leaveVoice } = require('../voice/manager');

module.exports = function leave(message) {
  leaveVoice(message);
};
