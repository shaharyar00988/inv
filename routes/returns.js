const express = require('express');
const router = express.Router();
const prisma = require('../utils/db');

// List all returns
router.get('/', async (req, res) => {
  try {
    // Get customer returns
    const customerReturns = await prisma.customerReturn.findMany({
      take: 20,
      orderBy: {
        date: 'desc'
      },
      include: {
        customer: true,
        items: {
          include: {
            inventory: true
          }
        }
      }
    });
    
    // Get supplier returns
    const supplierReturns = await prisma.supplierReturn.findMany({
      take: 20,
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
    
    // Combine and format returns for display
    const formattedCustomerReturns = customerReturns.map(cr => ({
      ...cr,
      type: 'customer'
    }));
    
    const formattedSupplierReturns = supplierReturns.map(sr => ({
      ...sr,
      type: 'supplier'
    }));
    
    // Combine all returns and sort by date (newest first)
    const returns = [...formattedCustomerReturns, ...formattedSupplierReturns]
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.render('returns/index', {
      user: req.user,
      returns,
      customerReturns: formattedCustomerReturns,
      supplierReturns: formattedSupplierReturns,
      activePage: 'returns'
    });
  } catch (error) {
    console.error('Returns list error:', error);
    res.status(500).render('returns/index', { 
      user: req.user,
      returns: [],
      customerReturns: [],
      supplierReturns: [],
      error: 'Error loading returns data',
      activePage: 'returns'
    });
  }
});

// Get new customer return form
router.get('/customer/new', async (req, res) => {
  try {
    // Get all customers
    const customers = await prisma.customer.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    res.render('returns/customer-new', {
      user: req.user,
      customers,
      activePage: 'returns'
    });
  } catch (error) {
    console.error('New customer return error:', error);
    res.status(500).render('returns/customer-new', { 
      user: req.user,
      customers: [],
      error: 'Error loading customers',
      activePage: 'returns'
    });
  }
});

// Get new supplier return form
router.get('/supplier/new', async (req, res) => {
  try {
    // Get all suppliers
    const suppliers = await prisma.supplier.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    res.render('returns/supplier-new', {
      user: req.user,
      suppliers,
      activePage: 'returns'
    });
  } catch (error) {
    console.error('New supplier return error:', error);
    res.status(500).render('returns/supplier-new', { 
      user: req.user,
      suppliers: [],
      error: 'Error loading suppliers',
      activePage: 'returns'
    });
  }
});

// Create new customer return
router.post('/customer/new', async (req, res) => {
  try {
    const { 
      customerId, 
      date, 
      returnItems, 
      totalAmount, 
      refundAmount, 
      reason 
    } = req.body;
    
    // Parse items from JSON string
    const parsedItems = JSON.parse(returnItems);
    
    // Create customer return transaction
    const customerReturn = await prisma.customerReturn.create({
      data: {
        date: new Date(date),
        totalAmount: parseFloat(totalAmount),
        refundAmount: parseFloat(refundAmount),
        reason: reason || null,
        customer: customerId ? {
          connect: { id: parseInt(customerId) }
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
    
    // Update customer balance if customer is selected and refund is given
    if (customerId && parseFloat(refundAmount) > 0) {
      await prisma.customer.update({
        where: { id: parseInt(customerId) },
        data: {
          balance: {
            decrement: parseFloat(refundAmount)
          }
        }
      });
    }
    
    // Update inventory stock
    for (const item of parsedItems) {
      await prisma.inventory.update({
        where: { id: parseInt(item.id) },
        data: {
          stock: {
            increment: parseInt(item.quantity)
          }
        }
      });
    }
    
    res.redirect('/returns');
  } catch (error) {
    console.error('Create customer return error:', error);
    res.status(500).json({ 
      error: 'Error creating customer return: ' + error.message
    });
  }
});

// Create new supplier return
router.post('/supplier/new', async (req, res) => {
  try {
    const { 
      supplierId, 
      date, 
      returnItems, 
      totalAmount, 
      refundAmount, 
      reason 
    } = req.body;
    
    // Parse items from JSON string
    const parsedItems = JSON.parse(returnItems);
    
    // Create supplier return transaction
    const supplierReturn = await prisma.supplierReturn.create({
      data: {
        date: new Date(date),
        totalAmount: parseFloat(totalAmount),
        refundAmount: parseFloat(refundAmount),
        reason: reason || null,
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
    
    // Update supplier balance if supplier is selected and refund is received
    if (supplierId && parseFloat(refundAmount) > 0) {
      await prisma.supplier.update({
        where: { id: parseInt(supplierId) },
        data: {
          balance: {
            decrement: parseFloat(refundAmount)
          }
        }
      });
    }
    
    // Update inventory stock
    for (const item of parsedItems) {
      await prisma.inventory.update({
        where: { id: parseInt(item.id) },
        data: {
          stock: {
            decrement: parseInt(item.quantity)
          }
        }
      });
    }
    
    res.redirect('/returns');
  } catch (error) {
    console.error('Create supplier return error:', error);
    res.status(500).json({ 
      error: 'Error creating supplier return: ' + error.message
    });
  }
});

// View customer return details
router.get('/customer/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get customer return with items and customer
    const returnData = await prisma.customerReturn.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        items: {
          include: {
            inventory: true
          }
        }
      }
    });
    
    if (!returnData) {
      return res.status(404).render('error', { 
        user: req.user,
        error: 'Customer return not found',
        activePage: 'returns'
      });
    }
    
    res.render('returns/customer-view', {
      user: req.user,
      returnData,
      activePage: 'returns'
    });
  } catch (error) {
    console.error('View customer return error:', error);
    res.status(500).render('error', { 
      user: req.user,
      error: 'Error loading customer return details',
      activePage: 'returns'
    });
  }
});

// View supplier return details
router.get('/supplier/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get supplier return with items and supplier
    const returnData = await prisma.supplierReturn.findUnique({
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
    
    if (!returnData) {
      return res.status(404).render('error', { 
        user: req.user,
        error: 'Supplier return not found',
        activePage: 'returns'
      });
    }
    
    res.render('returns/supplier-view', {
      user: req.user,
      returnData,
      activePage: 'returns'
    });
  } catch (error) {
    console.error('View supplier return error:', error);
    res.status(500).render('error', { 
      user: req.user,
      error: 'Error loading supplier return details',
      activePage: 'returns'
    });
  }
});

// Delete customer return
router.post('/customer/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the customer return with its items and customer details
    const customerReturn = await prisma.customerReturn.findUnique({
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

    if (!customerReturn) {
      return res.redirect('/returns?error=Customer return not found');
    }

    // Start a transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      // 1. Update inventory quantities (remove the returned quantities)
      for (const item of customerReturn.items) {
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

      // 2. If there's a customer and refund was given, update their balance
      if (customerReturn.customerId && customerReturn.refundAmount > 0) {
        await tx.customer.update({
          where: {
            id: customerReturn.customerId
          },
          data: {
            balance: {
              increment: customerReturn.refundAmount
            }
          }
        });
      }

      // 3. Delete return items (they will be automatically deleted due to onDelete: Cascade)
      await tx.customerReturnItem.deleteMany({
        where: {
          customerReturnId: parseInt(id)
        }
      });

      // 4. Finally, delete the return record
      await tx.customerReturn.delete({
        where: {
          id: parseInt(id)
        }
      });
    });

    res.redirect('/returns?success=Customer return deleted successfully');
  } catch (error) {
    console.error('Error deleting customer return:', error);
    res.redirect(`/returns?error=Failed to delete customer return: ${error.message}`);
  }
});

// Delete supplier return
router.post('/supplier/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the supplier return with its items and supplier details
    const supplierReturn = await prisma.supplierReturn.findUnique({
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

    if (!supplierReturn) {
      return res.redirect('/returns?error=Supplier return not found');
    }

    // Start a transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      // 1. Update inventory quantities (remove the returned quantities)
      for (const item of supplierReturn.items) {
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

      // 2. If there's a supplier and refund was received, update their balance
      if (supplierReturn.supplierId && supplierReturn.refundAmount > 0) {
        await tx.supplier.update({
          where: {
            id: supplierReturn.supplierId
          },
          data: {
            balance: {
              increment: supplierReturn.refundAmount
            }
          }
        });
      }

      // 3. Delete return items (they will be automatically deleted due to onDelete: Cascade)
      await tx.supplierReturnItem.deleteMany({
        where: {
          supplierReturnId: parseInt(id)
        }
      });

      // 4. Finally, delete the return record
      await tx.supplierReturn.delete({
        where: {
          id: parseInt(id)
        }
      });
    });

    res.redirect('/returns?success=Supplier return deleted successfully');
  } catch (error) {
    console.error('Error deleting supplier return:', error);
    res.redirect(`/returns?error=Failed to delete supplier return: ${error.message}`);
  }
});

module.exports = router; 