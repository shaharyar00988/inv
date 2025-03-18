const express = require('express');
const router = express.Router();
const prisma = require('../utils/db');

// Get all suppliers with search functionality
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    
    let suppliers;
    
    if (search) {
      suppliers = await prisma.supplier.findMany({
        where: {
          OR: [
            { name: { contains: search } },
            { address: { contains: search } },
            { number: { contains: search } }
          ]
        },
        orderBy: {
          name: 'asc'
        }
      });
    } else {
      suppliers = await prisma.supplier.findMany({
        orderBy: {
          name: 'asc'
        }
      });
    }
    
    res.render('suppliers/index', {
      user: req.user,
      suppliers,
      search: search || '',
      activePage: 'suppliers',
      successMessage: req.query.success,
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).send('Error fetching suppliers');
  }
});

// Get supplier creation form
router.get('/create', (req, res) => {
  res.render('suppliers/create', {
    user: req.user,
    activePage: 'suppliers',
    errorMessage: req.query.error
  });
});

// Create new supplier
router.post('/create', async (req, res) => {
  try {
    const { name, address, number, balance } = req.body;
    
    // Check if supplier with same phone number exists
    if (number) {
      const existingSupplier = await prisma.supplier.findFirst({
        where: {
          number: number
        }
      });
      
      if (existingSupplier) {
        return res.redirect(`/suppliers/create?error=A supplier with phone number ${number} already exists (${existingSupplier.name})`);
      }
    }
    
    await prisma.supplier.create({
      data: {
        name,
        address,
        number,
        balance: balance ? parseFloat(balance) : 0
      }
    });
    
    res.redirect('/suppliers?success=Supplier created successfully');
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.redirect('/suppliers/create?error=Failed to create supplier');
  }
});

// Get supplier details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const supplier = await prisma.supplier.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        purchases: {
          orderBy: {
            date: 'desc'
          }
        },
        supplierReturns: {
          orderBy: {
            date: 'desc'
          }
        },
        payments: {
          orderBy: {
            date: 'desc'
          }
        }
      }
    });
    
    if (!supplier) {
      return res.redirect('/suppliers?error=Supplier not found');
    }
    
    res.render('suppliers/show', {
      user: req.user,
      supplier,
      purchases: supplier.purchases,
      returns: supplier.supplierReturns,
      payments: supplier.payments,
      activePage: 'suppliers',
      successMessage: req.query.success,
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching supplier details:', error);
    res.redirect('/suppliers?error=Failed to fetch supplier details');
  }
});

// Get supplier edit form
router.get('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    
    const supplier = await prisma.supplier.findUnique({
      where: {
        id: parseInt(id)
      }
    });
    
    if (!supplier) {
      return res.redirect('/suppliers?error=Supplier not found');
    }
    
    res.render('suppliers/edit', {
      user: req.user,
      supplier,
      activePage: 'suppliers',
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching supplier for edit:', error);
    res.redirect('/suppliers?error=Failed to fetch supplier for edit');
  }
});

// Update supplier
router.post('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, number } = req.body;
    
    // Check if another supplier with same phone number exists
    if (number) {
      const existingSupplier = await prisma.supplier.findFirst({
        where: {
          AND: [
            { number: number },
            { NOT: { id: parseInt(id) } }
          ]
        }
      });
      
      if (existingSupplier) {
        return res.redirect(`/suppliers/${id}/edit?error=A supplier with phone number ${number} already exists (${existingSupplier.name})`);
      }
    }
    
    await prisma.supplier.update({
      where: {
        id: parseInt(id)
      },
      data: {
        name,
        address,
        number
      }
    });
    
    res.redirect(`/suppliers/${id}?success=Supplier updated successfully`);
  } catch (error) {
    console.error('Error updating supplier:', error);
    res.redirect(`/suppliers/${req.params.id}/edit?error=Failed to update supplier`);
  }
});

// Delete supplier
router.post('/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if supplier has related purchases or returns
    const supplier = await prisma.supplier.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        purchases: true,
        supplierReturns: true,
        payments: true
      }
    });
    
    if (supplier.purchases.length > 0 || supplier.supplierReturns.length > 0 || supplier.payments.length > 0) {
      return res.redirect(`/suppliers/${id}?error=Cannot delete supplier with related transactions`);
    }
    
    await prisma.supplier.delete({
      where: {
        id: parseInt(id)
      }
    });
    
    res.redirect('/suppliers?success=Supplier deleted successfully');
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.redirect(`/suppliers/${req.params.id}?error=Failed to delete supplier`);
  }
});

// Make payment to supplier
router.post('/:id/make-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, reference } = req.body;
    
    // Get current supplier
    const supplier = await prisma.supplier.findUnique({
      where: {
        id: parseInt(id)
      }
    });

    if (!supplier) {
      return res.redirect(`/suppliers?error=Supplier not found`);
    }

    // Start a transaction
    await prisma.$transaction(async (prisma) => {
      // Update supplier balance
      await prisma.supplier.update({
        where: {
          id: parseInt(id)
        },
        data: {
          balance: supplier.balance - parseFloat(amount)
        }
      });

      // Create payment record
      await prisma.supplierPayment.create({
        data: {
          supplierId: parseInt(id),
          amount: parseFloat(amount),
          paymentMethod,
          reference,
          date: new Date()
        }
      });
    });

    res.redirect(`/suppliers/${id}?success=Payment of PKR ${parseFloat(amount).toLocaleString()} made successfully`);
  } catch (error) {
    console.error('Error making payment:', error);
    res.redirect(`/suppliers/${req.params.id}?error=Failed to process payment`);
  }
});

// Print supplier ledger
router.get('/:id/ledger', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get supplier details with all transactions
    const supplier = await prisma.supplier.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        purchases: {
          select: {
            id: true,
            date: true,
            totalAmount: true
          },
          orderBy: {
            date: 'asc'
          }
        },
        supplierReturns: {
          select: {
            id: true,
            date: true,
            totalAmount: true
          },
          orderBy: {
            date: 'asc'
          }
        },
        payments: {
          select: {
            id: true,
            date: true,
            amount: true,
            paymentMethod: true,
            reference: true
          },
          orderBy: {
            date: 'asc'
          }
        }
      }
    });
    
    if (!supplier) {
      return res.redirect('/suppliers?error=Supplier not found');
    }
    
    // Get shop settings
    const settings = await prisma.settings.findFirst();
    
    // Combine all transactions and sort by date
    const transactions = [
      ...supplier.purchases.map(p => ({
        ...p,
        type: 'purchase',
        amount: p.totalAmount
      })),
      ...supplier.supplierReturns.map(r => ({
        ...r,
        type: 'return',
        amount: r.totalAmount
      })),
      ...supplier.payments.map(p => ({
        ...p,
        type: 'payment'
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    res.render('invoices/supplier-ledger', {
      supplier,
      transactions,
      settings
    });
  } catch (error) {
    console.error('Error generating supplier ledger:', error);
    res.redirect(`/suppliers/${req.params.id}?error=Failed to generate ledger`);
  }
});

module.exports = router; 