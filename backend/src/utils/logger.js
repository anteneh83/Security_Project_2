const Log = require('../models/Log');
const { encrypt } = require('./crypto');

async function createLog({ userId = null, action = '', ip = '', rawData = {} }) {
  try {
    const data = { userId, action, ip, rawData, timestamp: new Date() };
    const encryptedData = encrypt(JSON.stringify(data));
    await Log.create({ userId, action, ip, encryptedData });
  } catch (err) {
    console.error('Failed to create log', err);
  }
}

module.exports = { createLog };
