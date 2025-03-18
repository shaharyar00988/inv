const express = require('express');
const router = express.Router();
const prisma = require('../utils/db');
const { Prisma } = require('@prisma/client');

// Get all inventory items with search functionality
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    
    let inventory;
    
    // If search query is provided, use raw query for case-insensitive search
    if (search) {
      inventory = await prisma.$queryRaw`
        SELECT * FROM Inventory 
        WHERE (LOWER(name) LIKE LOWER(${'%' + search + '%'}) 
        OR LOWER(urduName) LIKE LOWER(${'%' + search + '%'}))
        ${category ? Prisma.sql`AND type = ${category}` : Prisma.empty}
        ORDER BY name ASC
      `;
    } else {
      // If no search, use regular query
      inventory = await prisma.inventory.findMany({
        where: category ? { type: category } : {},
        orderBy: {
          name: 'asc'
        }
      });
    }
    
    // Get inventory statistics
    const totalItems = await prisma.inventory.count();
    const lowStockItems = await prisma.inventory.count({
      where: {
        type: { not: 'service' },
        stock: { lte: 5 }
      }
    });
    
    // Calculate total inventory value
    let totalValue = 0;
    inventory.forEach(item => {
      if (item.type !== 'service') {
        totalValue += item.stock * item.purchasePrice;
      }
    });
    
    res.render('inventory/index', {
      user: req.user,
      inventory,
      search: search || '',
      category: category || '',
      totalItems,
      lowStockItems,
      totalValue,
      activePage: 'inventory',
      successMessage: req.query.success,
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).render('inventory/index', {
      user: req.user,
      inventory: [],
      search: req.query.search || '',
      category: req.query.category || '',
      totalItems: 0,
      lowStockItems: 0,
      totalValue: 0,
      activePage: 'inventory',
      errorMessage: 'Failed to fetch inventory data'
    });
  }
});

// Get inventory creation form
router.get('/create', (req, res) => {
  res.render('inventory/create', {
    user: req.user,
    activePage: 'inventory',
    errorMessage: req.query.error
  });
});

// Create new inventory item
router.post('/create', async (req, res) => {
  try {
    const { name, urduName, type, purchasePrice, retailPrice, stock } = req.body;
    
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
    
    res.redirect('/inventory?success=Item created successfully');
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.redirect('/inventory/create?error=Failed to create inventory item');
  }
});

// Get inventory item details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await prisma.inventory.findUnique({
      where: {
        id: parseInt(id)
      }
    });
    
    if (!item) {
      return res.redirect('/inventory?error=Item not found');
    }
    
    // Get purchase history
    const purchaseItems = await prisma.purchaseItem.findMany({
      where: {
        inventoryId: parseInt(id)
      },
      include: {
        purchase: {
          include: {
            supplier: true
          }
        }
      },
      orderBy: {
        purchase: {
          date: 'desc'
        }
      }
    });
    
    // Transform purchaseItems into the format expected by the template
    const purchases = purchaseItems.map(item => ({
      date: item.purchase.date,
      supplier: item.purchase.supplier ? item.purchase.supplier.name : 'One-time Supplier',
      quantity: item.quantity,
      price: item.price,
      total: item.price * item.quantity
    }));
    
    // Get sales history
    const salesItems = await prisma.salesItem.findMany({
      where: {
        inventoryId: parseInt(id)
      },
      include: {
        sales: {
          include: {
            customer: true
          }
        }
      },
      orderBy: {
        sales: {
          date: 'desc'
        }
      }
    });
    
    // Transform salesItems into the format expected by the template
    const sales = salesItems.map(item => ({
      date: item.sales.date,
      customer: item.sales.customer ? item.sales.customer.name : 'Walk-in Customer',
      quantity: item.quantity,
      price: item.unitPrice,
      total: item.totalPrice
    }));
    
    res.render('inventory/show', {
      user: req.user,
      item,
      purchases,
      sales,
      activePage: 'inventory',
      successMessage: req.query.success,
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching inventory item details:', error);
    res.redirect('/inventory?error=Failed to fetch item details');
  }
});

// Get inventory edit form
router.get('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await prisma.inventory.findUnique({
      where: {
        id: parseInt(id)
      }
    });
    
    if (!item) {
      return res.redirect('/inventory?error=Item not found');
    }
    
    res.render('inventory/edit', {
      user: req.user,
      item,
      activePage: 'inventory',
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching inventory item for edit:', error);
    res.redirect('/inventory?error=Failed to fetch item for edit');
  }
});

// Update inventory item
router.post('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, urduName, type, purchasePrice, retailPrice, stock } = req.body;
    
    await prisma.inventory.update({
      where: {
        id: parseInt(id)
      },
      data: {
        name,
        urduName: urduName || null,
        type,
        purchasePrice: parseFloat(purchasePrice),
        retailPrice: parseFloat(retailPrice),
        stock: parseInt(stock)
      }
    });
    
    res.redirect(`/inventory/${id}?success=Item updated successfully`);
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.redirect(`/inventory/${req.params.id}/edit?error=Failed to update item`);
  }
});

// Adjust stock
router.post('/:id/adjust-stock', async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body;
    
    const item = await prisma.inventory.findUnique({
      where: {
        id: parseInt(id)
      }
    });
    
    if (!item) {
      return res.redirect('/inventory?error=Item not found');
    }
    
    const newStock = item.stock + parseInt(adjustment);
    
    if (newStock < 0) {
      return res.redirect(`/inventory/${id}?error=Stock cannot be negative`);
    }
    
    await prisma.inventory.update({
      where: {
        id: parseInt(id)
      },
      data: {
        stock: newStock
      }
    });
    
    // Create stock adjustment record
    await prisma.stockAdjustment.create({
      data: {
        inventoryId: parseInt(id),
        quantity: parseInt(adjustment),
        reason,
        date: new Date()
      }
    });
    
    res.redirect(`/inventory/${id}?success=Stock adjusted successfully`);
  } catch (error) {
    console.error('Error adjusting stock:', error);
    res.redirect(`/inventory/${req.params.id}?error=Failed to adjust stock`);
  }
});

// Delete inventory item
router.post('/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if item has related sales or purchases
    const salesItems = await prisma.salesItem.count({
      where: {
        inventoryId: parseInt(id)
      }
    });
    
    const purchaseItems = await prisma.purchaseItem.count({
      where: {
        inventoryId: parseInt(id)
      }
    });
    
    if (salesItems > 0 || purchaseItems > 0) {
      return res.redirect(`/inventory/${id}?error=Cannot delete item with related sales or purchases`);
    }
    
    await prisma.inventory.delete({
      where: {
        id: parseInt(id)
      }
    });
    
    res.redirect('/inventory?success=Item deleted successfully');
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.redirect(`/inventory/${req.params.id}?error=Failed to delete item`);
  }
});

module.exports = router; 