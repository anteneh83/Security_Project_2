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
 * Submit a paper (authenticated).
 * Accepts multipart/form-data:
 * - title, abstract, keywords (comma separated), macLabel, department
 * - paper file field name: paper
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

    // move to storage
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
 * - Authors see only their own papers
 * - Admins/superadmins can see all
 * - Security layers: MAC, ABAC, RuBAC, DAC
 */
router.get('/', auth, async (req, res) => {
  try {
    let papers;

    if (req.user.role === 'author') {
      // Only fetch papers authored by this user
      papers = await Paper.find({ authorId: req.user._id })
        .sort({ createdAt: -1 })
        .select('title abstract keywords filePath macLabel department status createdAt'); // select only necessary fields
    } else {
      // Admin / superadmin can see all
      papers = await Paper.find()
        .sort({ createdAt: -1 })
        .select('title abstract keywords authorId filePath macLabel department status createdAt');
    }

    // Format for frontend
    const formatted = papers.map((p) => ({
      _id: p._id,
      title: p.title,
      authorId: p.authorId,
      abstract: p.abstract,
      keywords: p.keywords,
      filePath: p.filePath,
      macLabel: p.macLabel,
      department: p.department,
      status: p.status,
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

    // Update fields
    paper.title = req.body.title || paper.title;
    paper.abstract = req.body.abstract || paper.abstract;
    paper.keywords = (req.body.keywords || paper.keywords.join(','))
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    paper.department = req.body.department || paper.department;

    // Replace file if new uploaded
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
 * Get paper metadata (secured)
 */
router.get(
  '/:id',
  auth,
  enforceMAC,
  enforceABACDepartment,
  enforceRuBACWorkingHours,
  enforceDAC,
  async (req, res) => {
    try {
      const paper = req.paper;
      res.json({ paper });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * Download paper file (secured)
 */
router.get(
  '/:id/download',
  auth,
  enforceMAC,
  enforceABACDepartment,
  enforceRuBACWorkingHours,
  enforceDAC,
  async (req, res) => {
    try {
      const paper = req.paper;
      const filepath = paper.filePath;
      if (!filepath || !fs.existsSync(filepath))
        return res.status(404).json({ message: 'File not found' });

      await createLog({
        userId: req.user._id,
        action: 'DOWNLOAD_PAPER',
        ip: req.ip,
        rawData: { paperId: paper._id },
      });

      res.download(filepath);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * Modify DAC permissions (only author or admin)
 */
router.put('/:id/permissions', auth, async (req, res) => {
  try {
    const paper = await Paper.findById(req.params.id);
    if (!paper) return res.status(404).json({ message: 'Paper not found' });

    const isOwner = paper.authorId.equals(req.user._id);
    if (!isOwner && req.user.role !== 'admin' && req.user.role !== 'superadmin') {
      return res
        .status(403)
        .json({ message: 'Only owner or admin can modify DAC permissions' });
    }

    const { grant = [], revoke = [] } = req.body;
    paper.dacPermissions = paper.dacPermissions || [];
    grant.forEach((g) => {
      if (!paper.dacPermissions.find((id) => String(id) === String(g)))
        paper.dacPermissions.push(g);
    });
    paper.dacPermissions = paper.dacPermissions.filter(
      (id) => !revoke.includes(String(id))
    );

    await paper.save();

    await createLog({
      userId: req.user._id,
      action: 'MODIFY_DAC',
      ip: req.ip,
      rawData: { paperId: paper._id, grant, revoke },
    });

    res.json({ message: 'Permissions updated' });
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

    // Delete file
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
