const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { createLog } = require('../utils/logger');
const speakeasy = require('speakeasy');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  logger: true,
  debug: true
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, department } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already used' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email, passwordHash, department,
      mfaSecret: '',
      mfaEnabled: false,   // <-- important
      accountStatus: 'pending'
    });

    const verifyToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    const verifyLink = `http://localhost:${process.env.PORT || 4000}/api/auth/verify-email?token=${verifyToken}`;

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'no-reply@gmail.com',
        to: email,
        subject: 'Verify email',
        text: `Please verify your email: ${verifyLink}`
      });
    } catch (err) {
      console.warn('Email send failed. Verify link:', verifyLink);
    }

    await createLog({ userId: user._id, action: 'REGISTER', ip: req.ip });
    res.json({ message: 'Registered. Check email for verification.' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// -------------------- EMAIL VERIFICATION --------------------
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('token required');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    await User.findByIdAndUpdate(payload.id, { accountStatus: 'active' });
    res.send('Email verified. You can login now.');
  } catch (err) {
    res.status(400).send('Invalid or expired token');
  }
});

// -------------------- LOGIN --------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: 'Invalid credentials' });

    if (user.accountStatus === 'pending') {
      return res.status(400).json({ message: 'Email not verified. Please verify your email.' });
    }
    // -------------------- Bypass MFA for Admin + Superadmin --------------------
    if (['admin', 'superadmin'].includes(user.role)) {
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
      );

      await createLog({ userId: user._id, action: 'LOGIN', ip: req.ip });

      return res.json({
        token,
        role: user.role,
        mfaRequired: false
      });
    }

    // -------------------- PASSWORD CHECK --------------------
    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) {
      user.failedLogins = (user.failedLogins || 0) + 1;
      user.lastFailedAt = new Date();

      if (user.failedLogins >= 5) user.accountStatus = 'locked';
      await user.save();

      return res.status(400).json({
        message: `Invalid credentials, after ${user.failedLogins} attempt(s) your account may be locked!`
      });
    }

    // Reset failed logins
    user.failedLogins = 0;
    user.lastFailedAt = null;
    await user.save();

    // -------------------- MFA CHECK --------------------
    // requires BOTH mfaEnabled = true AND secret to exist
    if (user.mfaEnabled && user.mfaSecret) {
      const tempToken = jwt.sign(
        { id: user._id, mfa: true, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '10m' }
      );

      await createLog({
        userId: user._id,
        action: 'MFA_REQUIRED',
        ip: req.ip
      });

      return res.json({
        mfaRequired: true,
        alreadyEnabled: true,
        tempToken,
        role: user.role,
        message: 'Enter your MFA OTP'
      });
    }

    // -------------------- NORMAL LOGIN (NO MFA) --------------------
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    await createLog({ userId: user._id, action: 'LOGIN', ip: req.ip });

    return res.json({
      token,
      role: user.role,
      mfaRequired: false,
      alreadyEnabled: false
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error' });
  }
});


router.post('/mfa/verify', async (req, res) => {
  try {
    const { tempToken, otp } = req.body;
    if (!tempToken || !otp)
      return res.status(400).json({ message: 'Temp token and OTP required' });

    const payload = jwt.verify(tempToken, process.env.JWT_SECRET);
    if (!payload?.id) return res.status(400).json({ message: 'Invalid temporary token' });

    const user = await User.findById(payload.id);
    if (!user || !user.mfaSecret)
      return res.status(400).json({ message: 'MFA not configured' });

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: otp,
      window: 1
    });

    if (!verified)
      return res.status(400).json({ message: 'Invalid or expired OTP' });

    // NOW ENABLE MFA
    if (!user.mfaEnabled) user.mfaEnabled = true;
    await user.save();
    console.log('MFA enabled for user', user.mfaEnabled);

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    res.json({ token, role: user.role, success: true });

  } catch (err) {
    console.error(err);
    res.status(400).json({ message: 'Invalid token or OTP' });
  }
});

router.post('/mfa/setup', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const secret = speakeasy.generateSecret({ length: 20 });

    user.mfaSecret = secret.base32;
    user.mfaEnabled = false;    // will be enabled after verify
    await user.save();

    const tempToken = jwt.sign(
      { id: user._id, mfa: true, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    const otp = speakeasy.totp({
      secret: secret.base32,
      encoding: 'base32'
    });

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'no-reply@example.com',
        to: user.email,
        subject: 'Your MFA OTP',
        text: `Your MFA setup OTP is: ${otp}`
      });
    } catch (err) {
      console.log('Email failed, OTP:', otp);
    }

    res.json({
      secret: secret.base32,
      otpauth_url: secret.otpauth_url,
      tempToken,
      message: 'MFA secret generated. Check OTP in email.'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
