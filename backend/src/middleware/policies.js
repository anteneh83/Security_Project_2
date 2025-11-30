// backend/src/middleware/policies.js
const Paper = require('../models/Paper');
const User = require('../models/User');
const { createLog } = require('../utils/logger');

/**
 * RBAC configuration:
 * - define roles and the permissions each role possesses.
 * - permissions are simple strings used across the app, e.g. "papers.create", "papers.read", "reviews.submit", "users.manage"
 *
 * Update this map when adding new permissions.
 */
const RBAC = {
  superadmin: [
    'papers.create','papers.read','papers.update','papers.delete',
    'reviews.submit','reviews.read','users.manage','roles.approve','roles.request.view'
  ],
  admin: [
    'papers.create','papers.read','papers.update','papers.delete',
    'reviews.submit','reviews.read','users.manage','roles.approve','roles.request.view'
  ],
  editor: [
    'papers.read','papers.update','reviews.read','reviews.submit'
  ],
  reviewer: [
    'papers.read','reviews.submit','reviews.read'
  ],
  hr: [
    'users.view','users.manage' // example HR capabilities
  ],
  author: [
    'papers.create','papers.read'
  ]
};

/**
 * Helper: check if a role contains a permission
 */
function roleHasPermission(role, permission) {
  if (!role) return false;
  const perms = RBAC[role];
  if (!perms) return false;
  return perms.includes(permission);
}

/**
 * Middleware: require that user has at least one role in `allowedRoles` or a specific permission.
 * Usage:
 *  - requireRole('admin')
 *  - requireRole(['admin','superadmin'])
 *  - requirePermission('papers.read')
 */
function requireRole(allowedRoles) {
  if (!Array.isArray(allowedRoles)) allowedRoles = [allowedRoles];
  return function (req, res, next) {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (allowedRoles.includes(req.user.role) || req.user.role === 'superadmin') return next();
    return res.status(403).json({ message: 'Access denied: role' });
  };
}

function requirePermission(permission) {
  return async function (req, res, next) {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    // superadmin bypass
    if (req.user.role === 'superadmin') return next();
    if (roleHasPermission(req.user.role, permission)) return next();
    return res.status(403).json({ message: 'Access denied: permission' });
  };
}

/* --- Existing policy middlewares (MAC, DAC, RuBAC, ABAC) --- */

// MAC enforcement middleware (paper id in req.params.id or req.body.paperId)
async function enforceMAC(req, res, next) {
  const id = req.params.id || req.body.paperId;
  if (!id) return res.status(400).json({ message: 'Paper id required for MAC check' });
  const paper = await Paper.findById(id);
  if (!paper) return res.status(404).json({ message: 'Paper not found' });
  // user.clearanceLevel must be >= paper.macLabel (admins bypass)
  if ((req.user.clearanceLevel || 1) < paper.macLabel && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Access denied: MAC policy' });
  }
  req.paper = paper;
  next();
}

// DAC: check if user is owner or in dacPermissions or admin
async function enforceDAC(req, res, next) {
  const paper = req.paper || await Paper.findById(req.params.id);
  if (!paper) return res.status(404).json({ message: 'Paper not found' });
  const isOwner = paper.authorId.equals(req.user._id);
  const allowed = (paper.dacPermissions || []).some(id => String(id) === String(req.user._id));
  if (!isOwner && !allowed && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Access denied: DAC policy' });
  }
  next();
}

// RuBAC: time / location rules example
function enforceRuBACWorkingHours(req, res, next) {
  const hour = new Date().getHours();
  // working hours 08:00 - 18:00
  if (hour < 8 || hour > 18) {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) return next();
    return res.status(403).json({ message: 'Outside working hours (RuBAC)' });
  }
  next();
}

// ABAC example: department must match (unless admin)
async function enforceABACDepartment(req, res, next) {
  const paper = req.paper || await Paper.findById(req.params.id);
  if (!paper) return res.status(404).json({ message: 'Paper not found' });
  if (paper.department && req.user.department && paper.department !== req.user.department && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'ABAC restriction: department mismatch' });
  }
  next();
}

/* --- RBAC util: assign role (used by admin routes) --- */
async function assignRole(targetUserId, newRole, actorUser) {
  // sanity checks
  if (!RBAC[newRole]) throw new Error('Invalid role');
  const target = await User.findById(targetUserId);
  if (!target) throw new Error('User not found');

  const oldRole = target.role;
  target.role = newRole;
  await target.save();

  // audit log: who changed the role and when
  try {
    await createLog({
      userId: actorUser ? actorUser._id : null,
      action: 'ROLE_CHANGED',
      ip: actorUser ? actorUser.ip : '',
      rawData: { targetUserId, oldRole, newRole, changedAt: new Date() }
    });
  } catch (err) {
    console.error('Failed to log role change', err);
  }

  return target;
}

module.exports = {
  // RBAC middleware
  requireRole,
  requirePermission,
  roleHasPermission,
  RBAC,

  // role assign helper
  assignRole,

  // other policies
  enforceMAC,
  enforceDAC,
  enforceRuBACWorkingHours,
  enforceABACDepartment
};
