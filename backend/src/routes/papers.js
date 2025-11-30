const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Paper = require('../models/Paper');
const { createLog } = require('../utils/logger');
const auth = require('../middleware/auth');
const {
  enforceMAC,
  enforceDAC,
  enforceRuBACWorkingHours,
  enforceABACDepartment,
} = require('../middleware/policies');

const upload = multer({ dest: 'uploads/' });

/**
 * Submit a paper (authenticated)
 */
router.post('/', auth, upload.single('paper'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'File is required' });
    const allowed = ['.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ message: 'Invalid file type' });
    }

    const destDir = path.join('storage', String(new Date().getFullYear()));
    fs.mkdirSync(destDir, { recursive: true });
    const newPath = path.join(destDir, `${Date.now()}_${file.originalname}`);
    fs.renameSync(file.path, newPath);

    const p = await Paper.create({
      title: req.body.title || 'Untitled',
      abstract: req.body.abstract || '',
      keywords: (req.body.keywords || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      authorId: req.user._id,
      filePath: newPath,
      macLabel: Number(req.body.macLabel) || 1,
      department: req.body.department || req.user.department,
      status: 'submitted', // default status
    });

    await createLog({
      userId: req.user._id,
      action: 'SUBMIT_PAPER',
      ip: req.ip,
      rawData: { paperId: p._id },
    });

    res.json({ message: 'Submitted', paper: p });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Get all papers (authenticated)
 * Includes DAC access
 */
router.get('/', auth, async (req, res) => {
  try {
    let papers = [];

    if (req.user.role === 'author') {
      // Own papers
      papers = await Paper.find({ authorId: req.user._id });
    } else {
      // Admin / superadmin / editor can see all
      papers = await Paper.find();
    }

    // Include papers shared via DAC
    const dacPapers = await Paper.find({ dacPermissions: req.user._id });

    // Merge and remove duplicates
    const allPapers = [...papers, ...dacPapers].filter(
      (v, i, a) => a.findIndex((t) => t._id.equals(v._id)) === i
    );

    const formatted = allPapers.map((p) => ({
      _id: p._id,
      title: p.title,
      authorId: p.authorId,
      abstract: p.abstract,
      keywords: p.keywords,
      filePath: p.filePath,
      macLabel: p.macLabel,
      department: p.department,
      status: p.status,
      dacPermissions: p.dacPermissions,
      createdAt: p.createdAt,
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update paper (author only)
router.put('/:id', auth, upload.single('paper'), async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ message: 'Paper not found' });

    if (!paper.authorId.equals(req.user._id))
      return res.status(403).json({ message: 'Only author can update' });

    paper.title = req.body.title || paper.title;
    paper.abstract = req.body.abstract || paper.abstract;
    paper.keywords = (req.body.keywords || paper.keywords.join(','))
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    paper.department = req.body.department || paper.department;

    if (req.file) {
      if (fs.existsSync(paper.filePath)) fs.unlinkSync(paper.filePath);
      const destDir = path.join('storage', String(new Date().getFullYear()));
      fs.mkdirSync(destDir, { recursive: true });
      const newPath = path.join(destDir, `${Date.now()}_${req.file.originalname}`);
      fs.renameSync(req.file.path, newPath);
      paper.filePath = newPath;
    }

    await paper.save();

    await createLog({
      userId: req.user._id,
      action: 'UPDATE_PAPER',
      ip: req.ip,
      rawData: { paperId: paper._id },
    });

    res.json({ message: 'Paper updated', paper });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Modify DAC permissions (author/admin only)
 */
router.put('/:id/permissions', auth, async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ message: 'Paper not found' });

    const isOwner = paper.authorId.equals(req.user._id);
    if (!isOwner && !['admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only author or admin can modify DAC permissions' });
    }

    const { grant = [], revoke = [] } = req.body;
    paper.dacPermissions = paper.dacPermissions || [];

    // Grant access
    grant.forEach((g) => {
      if (!paper.dacPermissions.find((id) => String(id) === String(g))) {
        paper.dacPermissions.push(g);
      }
    });

    // Revoke access
    paper.dacPermissions = paper.dacPermissions.filter((id) => !revoke.includes(String(id)));

    await paper.save();

    await createLog({
      userId: req.user._id,
      action: 'MODIFY_DAC',
      ip: req.ip,
      rawData: { paperId: paper._id, grant, revoke },
    });

    res.json({ message: 'Permissions updated', dacPermissions: paper.dacPermissions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Update paper status (editor/admin/superadmin only)
 */
router.put('/:id/status', auth, async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ message: 'Paper not found' });

    if (!['editor', 'admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized to update status' });
    }

    const { status } = req.body;
    const allowedStatuses = ['submitted', 'under_review', 'accepted', 'rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    paper.status = status;
    await paper.save();

    await createLog({
      userId: req.user._id,
      action: 'UPDATE_PAPER_STATUS',
      ip: req.ip,
      rawData: { paperId: paper._id, newStatus: status },
    });

    res.json({ message: 'Paper status updated', paper });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete paper (author only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ message: 'Paper not found' });

    if (!paper.authorId.equals(req.user._id))
      return res.status(403).json({ message: 'Only author can delete' });

    if (fs.existsSync(paper.filePath)) fs.unlinkSync(paper.filePath);

    await paper.deleteOne();

    await createLog({
      userId: req.user._id,
      action: 'DELETE_PAPER',
      ip: req.ip,
      rawData: { paperId: paper._id },
    });

    res.json({ message: 'Paper deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
