const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../utils/db');

// Helper function to hash passwords
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Login page
router.get('/login', (req, res) => {
  res.render('auth/login', { error: null });
});

// Login process
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { username }
    });
    
    // Check if user exists and password is correct
    if (!user || user.password !== hashPassword(password)) {
      return res.render('auth/login', { error: 'Invalid username or password' });
    }
    
    // Create JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    // Set cookie and session
    res.cookie('token', token, { 
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    req.session.user = { id: user.id, username: user.username };
    
    // Redirect to dashboard
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', { error: 'An error occurred during login' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  // Clear cookie and session
  res.clearCookie('token');
  req.session.destroy();
  res.redirect('/auth/login');
});

// Create default admin user if none exists
const createDefaultUser = async () => {
  try {
    const userCount = await prisma.user.count();
    
    if (userCount === 0) {
      await prisma.user.create({
        data: {
          username: 'admin',
          password: hashPassword('admin123'),
        }
      });
      console.log('Default admin user created');
    }
  } catch (error) {
    console.error('Error creating default user:', error);
  }
};

// Call the function to create default user
createDefaultUser();

module.exports = router; 