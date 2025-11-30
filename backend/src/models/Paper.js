const mongoose = require('mongoose');

const PaperSchema = new mongoose.Schema({
  title: { type: String, required: true },
  abstract: { type: String },
  keywords: [{ type: String }],
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filePath: { type: String },
  macLabel: { type: Number, enum: [1,2,3], default: 1 }, // 1: Public, 2: Internal, 3: Confidential
  dacPermissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  department: { type: String },
  status: { type: String, enum: ['submitted','under_review','accepted','rejected'], default: 'submitted' },
  assignedReviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Paper', PaperSchema);
