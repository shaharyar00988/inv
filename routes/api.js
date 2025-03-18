const express = require('express');
const router = express.Router();
const prisma = require('../utils/db');

// Get all customers
router.get('/customers', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// Get all workers
router.get('/workers', async (req, res) => {
  try {
    const workers = await prisma.worker.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    res.json(workers);
  } catch (error) {
    console.error('Error fetching workers:', error);
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
});

// Search inventory items
router.get('/inventory/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.json([]);
    }
    
    // For SQLite, we need to handle case-insensitive search differently
    const items = await prisma.inventory.findMany({
      where: {
        OR: [
          {
            name: {
              contains: query
            }
          },
          {
            urduName: {
              contains: query
            }
          }
        ]
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    // Filter results manually for case-insensitive search
    const filteredItems = items.filter(item => 
      (item.name && item.name.toLowerCase().includes(query.toLowerCase())) ||
      (item.urduName && item.urduName.toLowerCase().includes(query.toLowerCase()))
    );
    
    // Ensure we always return an array
    res.json(filteredItems);
  } catch (error) {
    console.error('Error searching inventory:', error);
    res.status(500).json({ error: 'Failed to search inventory' });
  }
});

// Get inventory item by ID
router.get('/inventory/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await prisma.inventory.findUnique({
      where: {
        id: parseInt(id)
      }
    });
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    res.json(item);
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    res.status(500).json({ error: 'Failed to fetch inventory item' });
  }
});

// Create a new sale
router.post('/sales', async (req, res) => {
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
    
    // Create sale items data
    const itemsData = items.map(item => ({
      quantity: parseInt(item.quantity),
      unitPrice: parseFloat(item.unitPrice),
      totalPrice: parseFloat(item.totalPrice),
      inventoryId: parseInt(item.inventoryId)
    }));
    
    // Create the sale
    const sale = await prisma.sales.create({
      data: {
        invoiceNo,
        date: new Date(date),
        totalAmount: parseFloat(totalAmount),
        discount: parseFloat(discount),
        netAmount: parseFloat(netAmount),
        amountPaid: parseFloat(amountPaid),
        notes,
        customerId: customerId ? parseInt(customerId) : null,
        workerId: parseInt(workerId),
        items: {
          create: itemsData
        }
      },
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
    
    // Update inventory stock
    for (const item of items) {
      if (item.type !== 'service') {
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
    if (customerId && netAmount > amountPaid) {
      await prisma.customer.update({
        where: {
          id: parseInt(customerId)
        },
        data: {
          balance: {
            increment: parseFloat(netAmount) - parseFloat(amountPaid)
          }
        }
      });
    }
    
    res.status(201).json(sale);
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ error: 'Failed to create sale' });
  }
});

module.exports = router; 