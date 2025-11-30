const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String },
  role: { type: String, enum: ['author','reviewer','editor','hr','admin','superadmin'], default: 'author' },
  department: { type: String },
  clearanceLevel: { type: Number, default: 1 }, // for MAC
  mfaSecret: { type: String, default: '' }, // store base32 secret if MFA enabled, else ''
  mfaEnabled: { type: Boolean, default: false }, 
  accountStatus: { type: String, enum: ['pending','active','locked'], default: 'pending' },
  failedLogins: { type: Number, default: 0 },
  lastFailedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  tempMfaOtp: { type: String },
  otpExpires: { type: Date },
});

module.exports = mongoose.model('User', UserSchema);
