const express = require('express');
const router = express.Router();
const prisma = require('../utils/db');

// Delete customer payment
router.post('/customer/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the payment with customer details
    const payment = await prisma.payment.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        customer: true
      }
    });

    if (!payment) {
      return res.redirect('/customers?error=Payment not found');
    }

    // Start a transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      // 1. Update customer balance (add back the payment amount)
      await tx.customer.update({
        where: {
          id: payment.customerId
        },
        data: {
          balance: {
            increment: payment.amount
          }
        }
      });

      // 2. Delete the payment record
      await tx.payment.delete({
        where: {
          id: parseInt(id)
        }
      });
    });

    res.redirect('/customers?success=Payment deleted successfully');
  } catch (error) {
    console.error('Error deleting customer payment:', error);
    res.redirect(`/customers?error=Failed to delete payment: ${error.message}`);
  }
});

// Delete supplier payment
router.post('/supplier/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the payment with supplier details
    const payment = await prisma.supplierPayment.findUnique({
      where: {
        id: parseInt(id)
      },
      include: {
        supplier: true
      }
    });

    if (!payment) {
      return res.redirect('/suppliers?error=Payment not found');
    }

    // Start a transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      // 1. Update supplier balance (add back the payment amount)
      await tx.supplier.update({
        where: {
          id: payment.supplierId
        },
        data: {
          balance: {
            increment: payment.amount
          }
        }
      });

      // 2. Delete the payment record
      await tx.supplierPayment.delete({
        where: {
          id: parseInt(id)
        }
      });
    });

    res.redirect('/suppliers?success=Payment deleted successfully');
  } catch (error) {
    console.error('Error deleting supplier payment:', error);
    res.redirect(`/suppliers?error=Failed to delete payment: ${error.message}`);
  }
});

module.exports = router; 