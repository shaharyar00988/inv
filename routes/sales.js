const express = require('express');
const router = express.Router();
const prisma = require('../utils/db');

// List all sales with optional search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    
    let whereClause = {};
    
    // If search query is provided, filter results
    if (search) {
      whereClause = {
        OR: [
          { invoiceNo: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          { worker: { name: { contains: search, mode: 'insensitive' } } }
        ]
      };
    }
    
    const sales = await prisma.sales.findMany({
      where: whereClause,
      orderBy: {
        date: 'desc'
      },
      include: {
        customer: true,
        worker: true
      }
    });
    
    res.render('sales/index', {
      user: req.user,
      sales,
      search: search || '',
      activePage: 'sales'
    });
  } catch (error) {
    console.error('Sales list error:', error);
    res.status(500).render('sales/index', { 
      user: req.user,
      error: 'Error loading sales data',
      sales: [],
      search: req.query.search || '',
      activePage: 'sales'
    });
  }
});

// New sale form
router.get('/new', async (req, res) => {
  try {
    // Get all workers for the dropdown
    const workers = await prisma.worker.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    // Generate a new invoice number
    const salesCount = await prisma.sales.count();
    const invoiceNo = `INV-${(salesCount + 1).toString().padStart(3, '0')}`;
    
    res.render('sales/new', {
      user: req.user,
      workers,
      invoiceNo,
      activePage: 'sales'
    });
  } catch (error) {
    console.error('New sale form error:', error);
    res.status(500).render('sales/new', { 
      user: req.user,
      error: 'Error loading form data',
      workers: [],
      invoiceNo: 'INV-ERROR',
      activePage: 'sales'
    });
  }
});

// Process new sale form
router.post('/new', async (req, res) => {
  try {
    const { 
      invoiceNo, 
      date, 
      customerId, 
      workerId, 
      items, 
      totalAmount, 
      discount, 
      netAmount, 
      amountPaid, 
      notes 
    } = req.body;
    
    // Parse items from JSON string
    const parsedItems = JSON.parse(items);
    
    // Create sale items data
    const itemsData = parsedItems.map(item => ({
      quantity: parseInt(item.quantity),
      unitPrice: parseFloat(item.unitPrice),
      totalPrice: parseFloat(item.totalPrice),
      inventoryId: item.isCustom ? null : parseInt(item.inventoryId),
      isCustom: item.isCustom || false,
      customItemName: item.isCustom ? item.name : null
    }));
    
    // Create the sale
    const sale = await prisma.sales.create({
      data: {
        invoiceNo,
        date: new Date(date),
        totalAmount: parseFloat(totalAmount),
        discount: parseFloat(discount || 0),
        netAmount: parseFloat(netAmount),
        amountPaid: parseFloat(amountPaid || 0),
        notes,
        customerId: customerId ? parseInt(customerId) : null,
        workerId: parseInt(workerId),
        items: {
          create: itemsData
        }
      }
    });
    
    // Update inventory stock for non-service and non-custom items
    for (const item of parsedItems) {
      if (item.type !== 'service' && !item.isCustom) {
        await prisma.inventory.update({
          where: {
            id: parseInt(item.inventoryId)
          },
          data: {
            stock: {
              decrement: parseInt(item.quantity)
            }
          }
        });
      }
    }
    
    // Update customer balance if applicable
    if (customerId && parseFloat(netAmount) > parseFloat(amountPaid || 0)) {
      await prisma.customer.update({
        where: {
          id: parseInt(customerId)
        },
        data: {
          balance: {
            increment: parseFloat(netAmount) - parseFloat(amountPaid || 0)
          }
        }
      });
    }
    
    res.redirect(`/sales/${sale.id}`);
  } catch (error) {
    console.error('Create sale error:', error);
    
    // Get all workers for the dropdown (in case of error)
    const workers = await prisma.worker.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    res.status(500).render('sales/new', { 
      user: req.user,
      error: 'Error creating sale: ' + error.message,
      workers,
      invoiceNo: req.body.invoiceNo,
      activePage: 'sales'
    });
  }
});

// View single sale details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const sale = await prisma.sales.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        worker: true,
        items: {
          include: {
            inventory: true
          }
        }
      }
    });
    
    if (!sale) {
      return res.status(404).render('sales/detail', {
        user: req.user,
        error: 'Sale not found',
        sale: null,
        activePage: 'sales'
      });
    }
    
    res.render('sales/detail', {
      user: req.user,
      sale,
      activePage: 'sales'
    });
  } catch (error) {
    console.error('Sale detail error:', error);
    res.status(500).render('sales/detail', { 
      user: req.user,
      error: 'Error loading sale details',
      sale: null,
      activePage: 'sales'
    });
  }
});

// Delete sale
router.post('/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the sale with its items and customer details
    const sale = await prisma.sales.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        items: {
          include: {
            inventory: true
          }
        },
        customer: true
      }
    });

    if (!sale) {
      return res.redirect('/sales?error=Sale not found');
    }

    // Start a transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      // 1. Update inventory quantities (add back the sold quantities)
      for (const item of sale.items) {
        await tx.inventory.update({
          where: {
            id: item.inventoryId
          },
          data: {
            stock: {
              increment: item.quantity
            }
          }
        });
      }

      // 2. If there's a customer, update their balance
      if (sale.customerId) {
        await tx.customer.update({
          where: {
            id: sale.customerId
          },
          data: {
            balance: {
              decrement: sale.netAmount - sale.amountPaid
            }
          }
        });
      }

      // 3. Delete sale items (they will be automatically deleted due to onDelete: Cascade)
      await tx.salesItem.deleteMany({
        where: {
          salesId: parseInt(id)
        }
      });

      // 4. Finally, delete the sale record
      await tx.sales.delete({
        where: {
          id: parseInt(id)
        }
      });
    });

    res.redirect('/sales?success=Sale deleted successfully');
  } catch (error) {
    console.error('Error deleting sale:', error);
    res.redirect(`/sales?error=Failed to delete sale: ${error.message}`);
  }
});

module.exports = router; 