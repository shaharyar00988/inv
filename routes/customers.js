const express = require('express');
const router = express.Router();
const prisma = require('../utils/db');

// Get all customers with search functionality
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    
    let customers;
    
    if (search) {
      // Search by name, address, or phone number
      customers = await prisma.customer.findMany({
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
      // Get all customers
      customers = await prisma.customer.findMany({
        orderBy: {
          name: 'asc'
        }
      });
    }
    
    res.render('customers/index', {
      user: req.user,
      customers,
      search: search || '',
      activePage: 'customers',
      successMessage: req.query.success,
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).send('Error fetching customers');
  }
});

// Get customer creation form
router.get('/create', (req, res) => {
  res.render('customers/create', {
    user: req.user,
    activePage: 'customers',
    errorMessage: req.query.error
  });
});

// Create new customer
router.post('/create', async (req, res) => {
  try {
    const { name, address, number, balance } = req.body;
    
    // Check if customer with same phone number exists
    if (number) {
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          number: number
        }
      });
      
      if (existingCustomer) {
        return res.redirect(`/customers/create?error=A customer with phone number ${number} already exists (${existingCustomer.name})`);
      }
    }
    
    await prisma.customer.create({
      data: {
        name,
        address,
        number,
        balance: balance ? parseFloat(balance) : 0
      }
    });
    
    res.redirect('/customers?success=Customer created successfully');
  } catch (error) {
    console.error('Error creating customer:', error);
    res.redirect('/customers/create?error=Failed to create customer');
  }
});

// Get customer details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = await prisma.customer.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        sales: {
          orderBy: {
            date: 'desc'
          },
          include: {
            worker: true
          }
        },
        customerReturns: {
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
    
    if (!customer) {
      return res.redirect('/customers?error=Customer not found');
    }
    
    // Log the structure of the first sale if available
    if (customer.sales && customer.sales.length > 0) {
      console.log('First sale structure:', JSON.stringify(customer.sales[0], null, 2));
    }
    
    res.render('customers/show', {
      user: req.user,
      customer,
      sales: customer.sales,
      returns: customer.customerReturns,
      payments: customer.payments,
      activePage: 'customers',
      successMessage: req.query.success,
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching customer details:', error);
    res.redirect('/customers?error=Failed to fetch customer details');
  }
});

// Get customer edit form
router.get('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    
    const customer = await prisma.customer.findUnique({
      where: {
        id: parseInt(id)
      }
    });
    
    if (!customer) {
      return res.redirect('/customers?error=Customer not found');
    }
    
    res.render('customers/edit', {
      user: req.user,
      customer,
      activePage: 'customers',
      errorMessage: req.query.error
    });
  } catch (error) {
    console.error('Error fetching customer for edit:', error);
    res.redirect('/customers?error=Failed to fetch customer for edit');
  }
});

// Update customer
router.post('/:id/edit', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, number } = req.body;
    
    // Check if another customer with same phone number exists
    if (number) {
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          AND: [
            { number: number },
            { NOT: { id: parseInt(id) } }
          ]
        }
      });
      
      if (existingCustomer) {
        return res.redirect(`/customers/${id}/edit?error=A customer with phone number ${number} already exists (${existingCustomer.name})`);
      }
    }
    
    await prisma.customer.update({
      where: {
        id: parseInt(id)
      },
      data: {
        name,
        address,
        number
      }
    });
    
    res.redirect(`/customers/${id}?success=Customer updated successfully`);
  } catch (error) {
    console.error('Error updating customer:', error);
    res.redirect(`/customers/${req.params.id}/edit?error=Failed to update customer`);
  }
});

// Delete customer
router.post('/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if customer has related sales or returns
    const customer = await prisma.customer.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        sales: true,
        customerReturns: true
      }
    });
    
    if (customer.sales.length > 0 || customer.customerReturns.length > 0) {
      return res.redirect(`/customers/${id}?error=Cannot delete customer with related sales or returns`);
    }
    
    await prisma.customer.delete({
      where: {
        id: parseInt(id)
      }
    });
    
    res.redirect('/customers?success=Customer deleted successfully');
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.redirect(`/customers/${req.params.id}?error=Failed to delete customer`);
  }
});

// Receive payment from customer
router.post('/:id/receive-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, reference } = req.body;
    
    // Get current customer
    const customer = await prisma.customer.findUnique({
      where: {
        id: parseInt(id)
      }
    });

    if (!customer) {
      return res.redirect(`/customers?error=Customer not found`);
    }

    // Start a transaction
    await prisma.$transaction(async (prisma) => {
      // Update customer balance
      await prisma.customer.update({
        where: {
          id: parseInt(id)
        },
        data: {
          balance: customer.balance - parseFloat(amount)
        }
      });

      // Create payment record
      await prisma.payment.create({
        data: {
          customerId: parseInt(id),
          amount: parseFloat(amount),
          paymentMethod,
          reference,
          date: new Date()
        }
      });
    });

    res.redirect(`/customers/${id}?success=Payment of PKR ${parseFloat(amount).toLocaleString()} received successfully`);
  } catch (error) {
    console.error('Error receiving payment:', error);
    res.redirect(`/customers/${req.params.id}?error=Failed to process payment`);
  }
});

// Print customer ledger
router.get('/:id/ledger', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get customer details with all transactions
    const customer = await prisma.customer.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        sales: {
          select: {
            id: true,
            date: true,
            totalAmount: true,
            worker: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            date: 'asc'
          }
        },
        customerReturns: {
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
    
    if (!customer) {
      return res.redirect('/customers?error=Customer not found');
    }
    
    // Get shop settings
    const settings = await prisma.settings.findFirst();
    
    // Combine all transactions and sort by date
    const transactions = [
      ...customer.sales.map(s => ({
        ...s,
        type: 'sale',
        amount: s.totalAmount
      })),
      ...customer.customerReturns.map(r => ({
        ...r,
        type: 'return',
        amount: r.totalAmount
      })),
      ...customer.payments.map(p => ({
        ...p,
        type: 'payment'
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    res.render('invoices/customer-ledger', {
      customer,
      transactions,
      settings
    });
  } catch (error) {
    console.error('Error generating customer ledger:', error);
    res.redirect(`/customers/${req.params.id}?error=Failed to generate ledger`);
  }
});

module.exports = router; 