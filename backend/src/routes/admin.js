// backend/src/routes/admin.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireRole, requirePermission, assignRole } = require('../middleware/policies');
const RoleRequest = require('../models/RoleRequest');
const User = require('../models/User');
const { createLog } = require('../utils/logger');
const Review = require('../models/Review');
const Log = require('../models/Log');
const { decrypt } = require('../utils/crypto'); // your decrypt function


/**
 * Submit a role-change request (any authenticated user).
 * POST /api/admin/roles/request
 * body: { requestedRole, reason }
 */
router.post('/roles/request', auth, async (req, res) => {
  try {
    const { requestedRole, reason } = req.body;
    if (!requestedRole) return res.status(400).json({ message: 'requestedRole required' });

    // optional: validate requestedRole exists in RBAC map
    const { RBAC } = require('../middleware/policies');
    if (!RBAC[requestedRole]) return res.status(400).json({ message: 'Invalid role' });

    // create request
    const rr = await RoleRequest.create({
      userId: req.user._id,
      requestedRole,
      reason
    });

    await createLog({ userId: req.user._id, action: 'ROLE_REQUEST_SUBMIT', ip: req.ip, rawData: { requestId: rr._id, requestedRole, reason } });
    res.json({ message: 'Role change request submitted', request: rr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Get all pending role requests (admin/superadmin only)
 * GET /api/admin/roles/requests
 */
router.get('/roles/requests', auth, requireRole(['admin','superadmin']), async (req, res) => {
  try {
    const pending = await RoleRequest.find({ status: 'pending' }).populate('userId', 'name email role department');
    res.json({ pending });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Approve a role request:
 * POST /api/admin/roles/requests/:id/approve
 * body: { reviewNote (optional) }
 */
router.post('/roles/requests/:id/approve', auth, requireRole(['admin','superadmin']), async (req, res) => {
  try {
    const rr = await RoleRequest.findById(req.params.id);
    if (!rr) return res.status(404).json({ message: 'Role request not found' });
    if (rr.status !== 'pending') return res.status(400).json({ message: 'Request already processed' });

    // perform role assignment
    const actor = req.user;
    const target = await User.findById(rr.userId);
    const oldRole = target.role;
    target.role = rr.requestedRole;
    await target.save();

    rr.status = 'approved';
    rr.reviewedBy = actor._id;
    rr.reviewedAt = new Date();
    rr.reviewNote = req.body.reviewNote || '';
    await rr.save();

    // audit log for role approval and change
    await createLog({ userId: actor._id, action: 'ROLE_REQUEST_APPROVED', ip: req.ip, rawData: { requestId: rr._id, targetUserId: target._id, oldRole, newRole: rr.requestedRole } });
    await createLog({ userId: target._id, action: 'ROLE_ASSIGNED', ip: req.ip, rawData: { changedBy: actor._id, oldRole, newRole: rr.requestedRole } });

    res.json({ message: 'Role request approved', request: rr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Reject a role request:
 * POST /api/admin/roles/requests/:id/reject
 * body: { reviewNote (optional) }
 */
router.post('/roles/requests/:id/reject', auth, requireRole(['admin','superadmin']), async (req, res) => {
  try {
    const rr = await RoleRequest.findById(req.params.id);
    if (!rr) return res.status(404).json({ message: 'Role request not found' });
    if (rr.status !== 'pending') return res.status(400).json({ message: 'Request already processed' });

    rr.status = 'rejected';
    rr.reviewedBy = req.user._id;
    rr.reviewedAt = new Date();
    rr.reviewNote = req.body.reviewNote || '';
    await rr.save();

    await createLog({ userId: req.user._id, action: 'ROLE_REQUEST_REJECTED', ip: req.ip, rawData: { requestId: rr._id, reviewedBy: req.user._id } });

    res.json({ message: 'Role request rejected', request: rr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Get all users (admin/superadmin only)
 * GET /api/admin/users
 */
router.get('/users', auth, requireRole(['admin','superadmin']), async (req, res) => {
  try {
    const users = await User.find().select('name email role department');
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


/**
 * Directly assign/change a user's role (admin only).
 * PUT /api/admin/users/:id/role
 * body: { role }
 */
router.put('/users/:id/role', auth, requireRole(['admin','superadmin']), async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ message: 'role required' });

    const { RBAC } = require('../middleware/policies');
    if (!RBAC[role]) return res.status(400).json({ message: 'Invalid role' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await createLog({ userId: req.user._id, action: 'ROLE_ASSIGNED_DIRECT', ip: req.ip, rawData: { targetUserId: user._id, oldRole, newRole: role } });

    res.json({ message: 'Role updated', user: { id: user._id, email: user.email, oldRole, newRole: role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign a reviewer to a paper
// PUT /api/admin/papers/:paperId/assign-reviewer
// body: { reviewerId }
router.put('/papers/:paperId/assign-reviewer', auth, requireRole(['admin','superadmin']), async (req, res) => {
  try {
    const { paperId } = req.params;
    const { reviewerId } = req.body;

    if (!reviewerId) return res.status(400).json({ message: 'reviewerId is required' });

    const reviewer = await User.findById(reviewerId);
    if (!reviewer || reviewer.role !== 'reviewer') 
      return res.status(400).json({ message: 'Invalid reviewerId or user is not a reviewer' });

    const existingReview = await Review.findOne({ paperId, reviewerId });
    if (existingReview) return res.status(400).json({ message: 'Reviewer already assigned' });

    const newReview = await Review.create({ paperId, reviewerId, score: 0, comments: '' });

    await createLog({
      userId: req.user._id,
      action: 'REVIEWER_ASSIGNED',
      ip: req.ip,
      rawData: { paperId, reviewerId, reviewId: newReview._id }
    });

    res.json({ message: 'Reviewer assigned', review: newReview });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});



// GET all logs (with decrypted details) - only admin, superadmin, hr
router.get('/logs', auth, async (req, res) => {
  try {
    const allowedRoles = ['admin', 'superadmin', 'hr'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { action, userId } = req.query;

    const query = {};
    if (action) query.action = action;
    if (userId) query.userId = userId;

    // Fetch logs with user populated
    const logs = await Log.find(query)
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 });

    // Decrypt the encryptedData for each log
    const decryptedLogs = logs.map((log) => {
      let details = null;
      try {
        details = log.encryptedData ? JSON.parse(decrypt(log.encryptedData)) : null;
      } catch (err) {
        console.error('Failed to decrypt log:', log._id, err);
      }
      return {
        _id: log._id,
        userId: log.userId,
        action: log.action,
        ip: log.ip,
        timestamp: log.timestamp,
        details,
      };
    });

    res.json({ logs: decryptedLogs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
});

module.exports = router;


module.exports = router;
