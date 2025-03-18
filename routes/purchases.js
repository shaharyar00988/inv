const express = require('express');
const router = express.Router();
const prisma = require('../utils/db');

// List all purchases with optional search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    
    // Get all inventory items
    const inventory = await prisma.inventory.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    // Get all suppliers
    const suppliers = await prisma.supplier.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    // Prepare where clause for search
    let whereClause = {};
    
    if (search) {
      whereClause = {
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { supplier: { name: { contains: search, mode: 'insensitive' } } }
        ]
      };
    }
    
    // Get recent purchases with optional search
    const recentPurchases = await prisma.purchase.findMany({
      where: whereClause,
      take: search ? 100 : 10, // Show more results when searching
      orderBy: {
        date: 'desc'
      },
      include: {
        supplier: true,
        items: {
          include: {
            inventory: true
          }
        }
      }
    });
    
    res.render('purchases/index', {
      user: req.user,
      inventory,
      suppliers,
      recentPurchases,
      search: search || '',
      activePage: 'purchases'
    });
  } catch (error) {
    console.error('Purchases list error:', error);
    res.status(500).render('purchases/index', { 
      user: req.user,
      error: 'Error loading purchase data',
      inventory: [],
      suppliers: [],
      recentPurchases: [],
      search: req.query.search || '',
      activePage: 'purchases'
    });
  }
});

// Get new purchase form
router.get('/new', async (req, res) => {
  try {
    // Get all suppliers
    const suppliers = await prisma.supplier.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    res.render('purchases/new', {
      user: req.user,
      suppliers,
      activePage: 'purchases'
    });
  } catch (error) {
    console.error('New purchase error:', error);
    res.status(500).render('purchases/new', { 
      user: req.user,
      error: 'Error loading suppliers',
      suppliers: [],
      activePage: 'purchases'
    });
  }
});

// Create new purchase
router.post('/create', async (req, res) => {
  try {
    const { 
      supplierId, 
      date, 
      items, 
      totalAmount, 
      amountPaid, 
      notes 
    } = req.body;
    
    // Parse items from JSON string
    const parsedItems = JSON.parse(items);
    
    // Create purchase transaction
    const purchase = await prisma.purchase.create({
      data: {
        date: new Date(date),
        totalAmount: parseFloat(totalAmount),
        amountPaid: parseFloat(amountPaid),
        notes: notes || null,
        supplier: supplierId ? {
          connect: { id: parseInt(supplierId) }
        } : undefined,
        items: {
          create: parsedItems.map(item => ({
            quantity: parseInt(item.quantity),
            price: parseFloat(item.price),
            inventory: {
              connect: { id: parseInt(item.id) }
            }
          }))
        }
      }
    });
    
    // Update supplier balance if supplier is selected
    if (supplierId) {
      const remainingAmount = parseFloat(totalAmount) - parseFloat(amountPaid);
      if (remainingAmount > 0) {
        await prisma.supplier.update({
          where: { id: parseInt(supplierId) },
          data: {
            balance: {
              increment: remainingAmount
            }
          }
        });
      }
    }
    
    // Update inventory stock
    for (const item of parsedItems) {
      await prisma.inventory.update({
        where: { id: parseInt(item.id) },
        data: {
          stock: {
            increment: parseInt(item.quantity)
          },
          purchasePrice: parseFloat(item.price),
          retailPrice: parseFloat(item.retailPrice)
        }
      });
    }
    
    res.redirect('/purchases');
  } catch (error) {
    console.error('Create purchase error:', error);
    res.status(500).json({ 
      error: 'Error creating purchase: ' + error.message
    });
  }
});

// View purchase details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get purchase with items and supplier
    const purchase = await prisma.purchase.findUnique({
      where: { id: parseInt(id) },
      include: {
        supplier: true,
        items: {
          include: {
            inventory: true
          }
        }
      }
    });
    
    if (!purchase) {
      return res.status(404).render('error', { 
        user: req.user,
        error: 'Purchase not found',
        activePage: 'purchases'
      });
    }
    
    res.render('purchases/view', {
      user: req.user,
      purchase,
      activePage: 'purchases'
    });
  } catch (error) {
    console.error('View purchase error:', error);
    res.status(500).render('error', { 
      user: req.user,
      error: 'Error loading purchase details',
      activePage: 'purchases'
    });
  }
});

// Add new inventory item
router.post('/add-item', async (req, res) => {
  try {
    const { 
      name, 
      urduName, 
      type, 
      purchasePrice, 
      retailPrice, 
      stock 
    } = req.body;
    
    // Create new inventory item
    await prisma.inventory.create({
      data: {
        name,
        urduName: urduName || null,
        type,
        purchasePrice: parseFloat(purchasePrice),
        retailPrice: parseFloat(retailPrice),
        stock: parseInt(stock)
      }
    });
    
    res.redirect('/purchases');
  } catch (error) {
    console.error('Add inventory error:', error);
    
    // Get all inventory items and suppliers for re-rendering the page
    const inventory = await prisma.inventory.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    const suppliers = await prisma.supplier.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    res.status(500).render('purchases/index', { 
      user: req.user,
      error: 'Error adding inventory item: ' + error.message,
      inventory,
      suppliers,
      recentPurchases: [],
      activePage: 'purchases'
    });
  }
});

// Update inventory item
router.post('/update-item/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      purchasePrice, 
      retailPrice, 
      additionalStock 
    } = req.body;
    
    // Get current item
    const item = await prisma.inventory.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Update inventory item
    await prisma.inventory.update({
      where: { id: parseInt(id) },
      data: {
        purchasePrice: parseFloat(purchasePrice),
        retailPrice: parseFloat(retailPrice),
        stock: item.stock + parseInt(additionalStock || 0)
      }
    });
    
    res.redirect('/purchases');
  } catch (error) {
    console.error('Update inventory error:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

// Add new supplier
router.post('/add-supplier', async (req, res) => {
  try {
    const { 
      name, 
      address, 
      number 
    } = req.body;
    
    // Create new supplier
    await prisma.supplier.create({
      data: {
        name,
        address: address || null,
        number: number || null,
        balance: 0
      }
    });
    
    res.redirect('/purchases');
  } catch (error) {
    console.error('Add supplier error:', error);
    
    // Get all inventory items and suppliers for re-rendering the page
    const inventory = await prisma.inventory.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    const suppliers = await prisma.supplier.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    res.status(500).render('purchases/index', { 
      user: req.user,
      error: 'Error adding supplier: ' + error.message,
      inventory,
      suppliers,
      recentPurchases: [],
      activePage: 'purchases'
    });
  }
});

// Update supplier balance
router.post('/update-supplier-balance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentAmount } = req.body;
    
    // Get current supplier
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    
    // Update supplier balance
    await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: {
        balance: Math.max(0, supplier.balance - parseFloat(paymentAmount))
      }
    });
    
    res.redirect('/purchases');
  } catch (error) {
    console.error('Update supplier balance error:', error);
    res.status(500).json({ error: 'Failed to update supplier balance' });
  }
});

// Delete purchase
router.post('/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the purchase with its items and supplier details
    const purchase = await prisma.purchase.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        items: {
          include: {
            inventory: true
          }
        },
        supplier: true
      }
    });

    if (!purchase) {
      return res.redirect('/purchases?error=Purchase not found');
    }

    // Start a transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      // 1. Update inventory quantities (remove the purchased quantities)
      for (const item of purchase.items) {
        await tx.inventory.update({
          where: {
            id: item.inventoryId
          },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        });
      }

      // 2. If there's a supplier, update their balance
      if (purchase.supplierId) {
        const remainingAmount = purchase.totalAmount - purchase.amountPaid;
        if (remainingAmount > 0) {
          await tx.supplier.update({
            where: {
              id: purchase.supplierId
            },
            data: {
              balance: {
                decrement: remainingAmount
              }
            }
          });
        }
      }

      // 3. Delete purchase items (they will be automatically deleted due to onDelete: Cascade)
      await tx.purchaseItem.deleteMany({
        where: {
          purchaseId: parseInt(id)
        }
      });

      // 4. Finally, delete the purchase record
      await tx.purchase.delete({
        where: {
          id: parseInt(id)
        }
      });
    });

    res.redirect('/purchases?success=Purchase deleted successfully');
  } catch (error) {
    console.error('Error deleting purchase:', error);
    res.redirect(`/purchases?error=Failed to delete purchase: ${error.message}`);
  }
});

module.exports = router; 