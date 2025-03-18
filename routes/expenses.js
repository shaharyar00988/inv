const express = require('express');
const router = express.Router();
const prisma = require('../utils/db');

// Get all expenses with search and filter functionality
router.get('/', async (req, res) => {
  try {
    const { search, category, startDate, endDate } = req.query;
    
    let whereClause = {};
    
    // If search query is provided, filter results
    if (search) {
      whereClause = {
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } }
        ]
      };
    }
    
    // If category filter is provided
    if (category) {
      whereClause = {
        ...whereClause,
        category
      };
    }
    
    // If date range is provided
    if (startDate && endDate) {
      whereClause = {
        ...whereClause,
        date: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        }
      };
    } else if (startDate) {
      whereClause = {
        ...whereClause,
        date: {
          gte: new Date(startDate)
        }
      };
    } else if (endDate) {
      whereClause = {
        ...whereClause,
        date: {
          lte: new Date(endDate)
        }
      };
    }
    
    // Get all expenses
    const expenses = await prisma.expense.findMany({
      where: whereClause,
      orderBy: {
        date: 'desc'
      }
    });
    
    // Get expense categories for filter dropdown
    const categories = await prisma.expense.findMany({
      select: {
        category: true
      },
      distinct: ['category']
    });
    
    // Calculate total expenses
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    // Group expenses by category
    const expensesByCategory = {};
    expenses.forEach(expense => {
      if (!expensesByCategory[expense.category]) {
        expensesByCategory[expense.category] = 0;
      }
      expensesByCategory[expense.category] += expense.amount;
    });
    
    res.render('expenses/index', {
      user: req.user,
      expenses,
      categories: categories.map(c => c.category),
      search: search || '',
      category: category || '',
      startDate: startDate || '',
      endDate: endDate || '',
      totalExpenses,
      expensesByCategory,
      activePage: 'expenses',
      successMessage: req.query.success,
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).render('expenses/index', {
      user: req.user,
      expenses: [],
      categories: [],
      search: req.query.search || '',
      category: req.query.category || '',
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      totalExpenses: 0,
      expensesByCategory: {},
      activePage: 'expenses',
      errorMessage: 'Failed to fetch expenses data'
    });
  }
});

// Get expense creation form
router.get('/create', (req, res) => {
  res.render('expenses/create', {
    user: req.user,
    activePage: 'expenses',
    errorMessage: req.query.error
  });
});

// Create new expense
router.post('/create', async (req, res) => {
  try {
    const { description, category, amount, date, paymentMethod, reference } = req.body;
    
    await prisma.expense.create({
      data: {
        description,
        category,
        amount: parseFloat(amount),
        date: new Date(date),
        paymentMethod: paymentMethod || 'Cash',
        reference: reference || null
      }
    });
    
    res.redirect('/expenses?success=Expense created successfully');
  } catch (error) {
    console.error('Error creating expense:', error);
    res.redirect('/expenses/create?error=Failed to create expense');
  }
});

// Get expense details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const expense = await prisma.expense.findUnique({
      where: {
        id: parseInt(id)
      }
    });
    
    if (!expense) {
      return res.redirect('/expenses?error=Expense not found');
    }
    
    res.render('expenses/show', {
      user: req.user,
      expense,
      activePage: 'expenses',
      successMessage: req.query.success,
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching expense details:', error);
    res.redirect('/expenses?error=Failed to fetch expense details');
  }
});

// Get expense edit form
router.get('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    
    const expense = await prisma.expense.findUnique({
      where: {
        id: parseInt(id)
      }
    });
    
    if (!expense) {
      return res.redirect('/expenses?error=Expense not found');
    }
    
    res.render('expenses/edit', {
      user: req.user,
      expense,
      activePage: 'expenses',
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching expense for edit:', error);
    res.redirect('/expenses?error=Failed to fetch expense for edit');
  }
});

// Update expense
router.post('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { description, category, amount, date, paymentMethod, reference } = req.body;
    
    await prisma.expense.update({
      where: {
        id: parseInt(id)
      },
      data: {
        description,
        category,
        amount: parseFloat(amount),
        date: new Date(date),
        paymentMethod: paymentMethod || 'Cash',
        reference: reference || null
      }
    });
    
    res.redirect(`/expenses/${id}?success=Expense updated successfully`);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.redirect(`/expenses/${req.params.id}/edit?error=Failed to update expense`);
  }
});

// Delete expense
router.post('/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.expense.delete({
      where: {
        id: parseInt(id)
      }
    });
    
    res.redirect('/expenses?success=Expense deleted successfully');
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.redirect(`/expenses/${req.params.id}?error=Failed to delete expense`);
  }
});

module.exports = router; 