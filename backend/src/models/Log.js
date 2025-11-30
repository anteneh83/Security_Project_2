const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String },
  ip: { type: String },
  timestamp: { type: Date, default: Date.now },
  encryptedData: { type: String } // encrypted JSON blob
});

module.exports = mongoose.model('Log', LogSchema);
