const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Review = require('../models/Review');
const Paper = require('../models/Paper');
const { createLog } = require('../utils/logger');
const { enforceMAC, enforceABACDepartment, enforceRuBACWorkingHours } = require('../middleware/policies');

// ------------------- CREATE -------------------
// Submit review - only reviewer/editor/admin
router.post('/', auth, enforceRuBACWorkingHours, async (req, res) => {
  try {
    const { paperId, comments, score } = req.body;
    if (!paperId) return res.status(400).json({ message: 'paperId required' });

    const paper = await Paper.findById(paperId);
    if (!paper) return res.status(404).json({ message: 'Paper not found' });

    if (!['reviewer', 'editor', 'admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Not allowed to review' });
    }

    const review = await Review.create({
      paperId,
      reviewerId: req.user._id,
      comments,
      score,
    });

    await createLog({
      userId: req.user._id,
      action: 'SUBMIT_REVIEW',
      ip: req.ip,
      rawData: { reviewId: review._id },
    });

    res.json({ message: 'Review submitted', review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------- READ -------------------
// Get reviews for a paper (apply MAC & ABAC)
router.get('/paper/:id', auth, enforceMAC, enforceABACDepartment, async (req, res) => {
  try {
    const reviews = await Review.find({ paperId: req.params.id }).populate(
      'reviewerId',
      'name email role'
    );
    res.json({ reviews });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------- UPDATE -------------------
router.put('/:id', auth, enforceRuBACWorkingHours, async (req, res) => {
  try {
    const { score, comments } = req.body;
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    // Only reviewer who created or editor/admin can update
    if (
      review.reviewerId.toString() !== req.user._id.toString() &&
      !['editor', 'admin', 'superadmin'].includes(req.user.role)
    ) {
      return res.status(403).json({ message: 'Not allowed to update this review' });
    }

    review.score = score ?? review.score;
    review.comments = comments ?? review.comments;
    await review.save();

    await createLog({
      userId: req.user._id,
      action: 'UPDATE_REVIEW',
      ip: req.ip,
      rawData: { reviewId: review._id },
    });

    res.json({ message: 'Review updated', review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ------------------- DELETE -------------------
router.delete('/:id', auth, enforceRuBACWorkingHours, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    // Only reviewer who created or editor/admin can delete
    if (
      review.reviewerId.toString() !== req.user._id.toString() &&
      !['editor', 'admin', 'superadmin'].includes(req.user.role)
    ) {
      return res.status(403).json({ message: 'Not allowed to delete this review' });
    }

    await Review.findByIdAndDelete(req.params.id);

    await createLog({
      userId: req.user._id,
      action: 'DELETE_REVIEW',
      ip: req.ip,
      rawData: { reviewId: review._id },
    });

    res.json({ message: 'Review deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
