const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  // Check if user is authenticated via session
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }

  // Check for JWT token in cookies
  const token = req.cookies.token;
  
  if (!token) {
    return res.redirect('/auth/login');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.session.user = decoded;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.clearCookie('token');
    return res.redirect('/auth/login');
  }
};

module.exports = {
  authenticateToken
}; 