const express = require('express');
const router = express.Router();
const prisma = require('../utils/db');

// Dashboard home
router.get('/', async (req, res) => {
  try {
    // Get counts for dashboard stats
    const inventoryCount = await prisma.inventory.count();
    const customerCount = await prisma.customer.count();
    const workerCount = await prisma.worker.count();
    const supplierCount = await prisma.supplier.count();
    
    // Get today's start and end dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get today's sales total
    const todaySales = await prisma.sales.aggregate({
      where: {
        date: {
          gte: today,
          lt: tomorrow
        }
      },
      _sum: {
        totalAmount: true
      }
    });
    
    // Get today's purchases total
    const todayPurchases = await prisma.purchase.aggregate({
      where: {
        date: {
          gte: today,
          lt: tomorrow
        }
      },
      _sum: {
        totalAmount: true
      }
    });
    
    // Get today's expenses total
    const todayExpenses = await prisma.expense.aggregate({
      where: {
        date: {
          gte: today,
          lt: tomorrow
        }
      },
      _sum: {
        amount: true
      }
    });
    
    // Get today's cash received (payments from customers)
    const todayCashReceived = await prisma.payment.aggregate({
      where: {
        date: {
          gte: today,
          lt: tomorrow
        }
      },
      _sum: {
        amount: true
      }
    });
    
    // Get recent sales
    const recentSales = await prisma.sales.findMany({
      take: 5,
      orderBy: {
        date: 'desc'
      },
      include: {
        customer: true,
        worker: true
      }
    });
    
    // Get low stock items
    const lowStockItems = await prisma.inventory.findMany({
      where: {
        stock: {
          lte: 5
        }
      },
      take: 5,
      orderBy: {
        stock: 'asc'
      }
    });
    
    res.render('dashboard/index', {
      user: req.user,
      stats: {
        inventoryCount,
        customerCount,
        workerCount,
        supplierCount,
        todaySales: todaySales._sum.totalAmount || 0,
        todayPurchases: todayPurchases._sum.totalAmount || 0,
        todayExpenses: todayExpenses._sum.amount || 0,
        todayCashReceived: todayCashReceived._sum.amount || 0
      },
      recentSales,
      lowStockItems
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('dashboard/index', { 
      user: req.user,
      error: 'Error loading dashboard data',
      stats: {},
      recentSales: [],
      lowStockItems: []
    });
  }
});

module.exports = router; 