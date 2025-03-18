const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const salesRoutes = require('./routes/sales');
const purchasesRoutes = require('./routes/purchases');
const returnsRoutes = require('./routes/returns');
const settingsRoutes = require('./routes/settings');
const invoicesRoutes = require('./routes/invoices');
const apiRoutes = require('./routes/api');
const reportsRoutes = require('./routes/reports');
const customersRoutes = require('./routes/customers');
const workersRoutes = require('./routes/workers');
const inventoryRoutes = require('./routes/inventory');
const expensesRoutes = require('./routes/expenses');
const suppliersRoutes = require('./routes/suppliers');
const paymentsRoutes = require('./routes/payments');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.JWT_SECRET || 'your-super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
const { authenticateToken } = require('./middleware/auth');

// Routes
app.use('/auth', authRoutes);
app.use('/dashboard', authenticateToken, dashboardRoutes);
app.use('/sales', authenticateToken, salesRoutes);
app.use('/purchases', authenticateToken, purchasesRoutes);
app.use('/returns', authenticateToken, returnsRoutes);
app.use('/settings', authenticateToken, settingsRoutes);
app.use('/invoices', authenticateToken, invoicesRoutes);
app.use('/api', authenticateToken, apiRoutes);
app.use('/reports', authenticateToken, reportsRoutes);
app.use('/customers', authenticateToken, customersRoutes);
app.use('/workers', authenticateToken, workersRoutes);
app.use('/inventory', authenticateToken, inventoryRoutes);
app.use('/expenses', authenticateToken, expensesRoutes);
app.use('/suppliers', authenticateToken, suppliersRoutes);
app.use('/payments', authenticateToken, paymentsRoutes);

// Root route - redirect to login
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 