const express = require('express');
const router = express.Router();
const prisma = require('../utils/db');

// Get sales invoice
router.get('/sales/:id/:type', async (req, res) => {
  try {
    const { id, type } = req.params;
    
    // Get sale with items, customer, and worker
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
      return res.status(404).render('error', { 
        user: req.user,
        error: 'Sale not found',
        activePage: 'sales'
      });
    }
    
    // Get shop settings
    const settings = await prisma.settings.findFirst();
    
    if (type === 'thermal') {
      // Render thermal template
      return res.render('invoices/sales-thermal', {
        user: req.user,
        sale,
        settings,
        activePage: 'sales'
      });
    } else if (type === 'normal') {
      // Render normal template
      return res.render('invoices/sales-normal', {
        user: req.user,
        sale,
        settings,
        activePage: 'sales'
      });
    }
    
    // If no valid type specified, use the reusable invoice template as fallback
    const leftDetails = sale.customer ? [
      { label: 'Name', value: sale.customer.name },
      { label: 'Address', value: sale.customer.address },
      { label: 'Phone', value: sale.customer.number },
      { label: 'Balance', value: `$${sale.customer.balance.toFixed(2)}` }
    ] : [];
    
    const rightDetails = [
      { label: 'Date', value: new Date(sale.date).toLocaleDateString() },
      { label: 'Invoice #', value: sale.invoiceNo || sale.id },
      { label: 'Served By', value: sale.worker ? sale.worker.name : 'N/A' },
      { label: 'Notes', value: sale.notes }
    ];
    
    const columns = [
      { label: 'Item', key: 'name', format: 'nested', path: 'inventory.name' },
      { label: 'Urdu Name', key: 'urduName', format: 'nested', path: 'inventory.urduName', default: '-' },
      { label: 'Quantity', key: 'quantity', align: 'end' },
      { label: 'Unit Price', key: 'unitPrice', align: 'end', format: 'currency' },
      { label: 'Total', key: 'totalPrice', align: 'end', format: 'currency' }
    ];
    
    const totals = [
      { label: 'Subtotal', value: sale.totalAmount },
      { label: 'Discount', value: sale.discount },
      { label: 'Net Amount', value: sale.netAmount },
      { label: 'Amount Paid', value: sale.amountPaid },
      { label: 'Balance Due', value: sale.netAmount - sale.amountPaid }
    ];
    
    res.render('invoices/invoice-template', {
      user: req.user,
      title: `Sales Invoice #${sale.invoiceNo || sale.id}`,
      invoiceTitle: 'SALES INVOICE',
      invoiceNumber: sale.invoiceNo || sale.id,
      primaryColor: '#0d6efd', // Bootstrap primary blue
      leftDetailsTitle: 'Bill To',
      leftDetailsDefault: 'Walk-in Customer',
      leftDetails,
      rightDetails,
      columns,
      items: sale.items,
      totals,
      qrData: `Invoice:${sale.invoiceNo || sale.id}`,
      signatureLeft: 'Customer Signature',
      signatureRight: 'Authorized Signature',
      backUrl: '/sales',
      settings,
      activePage: 'sales'
    });
  } catch (error) {
    console.error('Sales invoice error:', error);
    res.status(500).render('error', { 
      user: req.user,
      error: 'Error generating invoice',
      activePage: 'sales'
    });
  }
});

// Get purchase invoice
router.get('/purchases/:id/:type', async (req, res) => {
  try {
    const { id, type } = req.params;
    
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
    
    // Get shop settings
    const settings = await prisma.settings.findFirst();
    
    if (type === 'thermal') {
      // Render thermal template
      return res.render('invoices/purchases-thermal', {
        user: req.user,
        purchase,
        settings,
        activePage: 'purchases'
      });
    } else if (type === 'normal') {
      // Render normal template
      return res.render('invoices/purchases-normal', {
        user: req.user,
        purchase,
        settings,
        activePage: 'purchases'
      });
    }
    
    // For fallback template, use the reusable invoice template
    const leftDetails = purchase.supplier ? [
      { label: 'Name', value: purchase.supplier.name },
      { label: 'Address', value: purchase.supplier.address },
      { label: 'Phone', value: purchase.supplier.number },
      { label: 'Balance', value: `$${purchase.supplier.balance.toFixed(2)}` }
    ] : [];
    
    const rightDetails = [
      { label: 'Date', value: new Date(purchase.date).toLocaleDateString() },
      { label: 'Invoice #', value: purchase.id },
      { label: 'Notes', value: purchase.notes }
    ];
    
    const columns = [
      { label: 'Item', key: 'name', format: 'nested', path: 'inventory.name' },
      { label: 'Urdu Name', key: 'urduName', format: 'nested', path: 'inventory.urduName', default: '-' },
      { label: 'Quantity', key: 'quantity', align: 'end' },
      { label: 'Unit Price', key: 'price', align: 'end', format: 'currency' },
      { label: 'Total', key: 'total', align: 'end', format: 'currency', compute: (item) => item.quantity * item.price }
    ];
    
    // Add computed total property to each item
    const itemsWithTotal = purchase.items.map(item => ({
      ...item,
      total: item.quantity * item.price
    }));
    
    const totals = [
      { label: 'Total Amount', value: purchase.totalAmount },
      { label: 'Amount Paid', value: purchase.amountPaid },
      { label: 'Balance Due', value: purchase.totalAmount - purchase.amountPaid }
    ];
    
    res.render('invoices/invoice-template', {
      user: req.user,
      title: `Purchase Invoice #${purchase.id}`,
      invoiceTitle: 'PURCHASE INVOICE',
      invoiceNumber: purchase.id,
      primaryColor: '#198754', // Bootstrap success green
      leftDetailsTitle: 'Supplier',
      leftDetailsDefault: 'One-time Supplier',
      leftDetails,
      rightDetails,
      columns,
      items: itemsWithTotal,
      totals,
      qrData: `Purchase:${purchase.id}`,
      signatureLeft: 'Supplier Signature',
      signatureRight: 'Authorized Signature',
      backUrl: '/purchases',
      settings,
      activePage: 'purchases'
    });
  } catch (error) {
    console.error('Purchase invoice error:', error);
    res.status(500).render('error', { 
      user: req.user,
      error: 'Error generating invoice',
      activePage: 'purchases'
    });
  }
});

// Get customer return invoice
router.get('/returns/customer/:id/:type', async (req, res) => {
  try {
    const { id, type } = req.params;
    
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
    
    // Get shop settings
    const settings = await prisma.settings.findFirst();
    
    if (type === 'thermal') {
      // Render thermal template
      return res.render('invoices/customer-return-thermal', {
        user: req.user,
        returnData,
        settings,
        activePage: 'returns'
      });
    }
    
    // For normal template, use the reusable invoice template
    const leftDetails = returnData.customer ? [
      { label: 'Name', value: returnData.customer.name },
      { label: 'Address', value: returnData.customer.address },
      { label: 'Phone', value: returnData.customer.number },
      { label: 'Balance', value: `$${returnData.customer.balance.toFixed(2)}` }
    ] : [];
    
    const rightDetails = [
      { label: 'Date', value: new Date(returnData.date).toLocaleDateString() },
      { label: 'Return #', value: returnData.id },
      { label: 'Reason', value: returnData.reason }
    ];
    
    const columns = [
      { label: 'Item', key: 'name', format: 'nested', path: 'inventory.name' },
      { label: 'Urdu Name', key: 'urduName', format: 'nested', path: 'inventory.urduName', default: '-' },
      { label: 'Quantity', key: 'quantity', align: 'end' },
      { label: 'Unit Price', key: 'price', align: 'end', format: 'currency' },
      { label: 'Total', key: 'total', align: 'end', format: 'currency', compute: (item) => item.quantity * item.price }
    ];
    
    // Add computed total property to each item
    const itemsWithTotal = returnData.items.map(item => ({
      ...item,
      total: item.quantity * item.price
    }));
    
    const totals = [
      { label: 'Total Amount', value: returnData.totalAmount },
      { label: 'Refund Amount', value: returnData.refundAmount }
    ];
    
    res.render('invoices/invoice-template', {
      user: req.user,
      title: `Customer Return #${returnData.id}`,
      invoiceTitle: 'CUSTOMER RETURN',
      invoiceNumber: returnData.id,
      primaryColor: '#dc3545', // Bootstrap danger red
      leftDetailsTitle: 'Customer',
      leftDetailsDefault: 'Walk-in Customer',
      leftDetails,
      rightDetails,
      columns,
      items: itemsWithTotal,
      totals,
      qrData: `CustomerReturn:${returnData.id}`,
      signatureLeft: 'Customer Signature',
      signatureRight: 'Authorized Signature',
      backUrl: '/returns',
      settings,
      activePage: 'returns'
    });
  } catch (error) {
    console.error('Customer return invoice error:', error);
    res.status(500).render('error', { 
      user: req.user,
      error: 'Error generating invoice',
      activePage: 'returns'
    });
  }
});

// Get supplier return invoice
router.get('/returns/supplier/:id/:type', async (req, res) => {
  try {
    const { id, type } = req.params;
    
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
    
    // Get shop settings
    const settings = await prisma.settings.findFirst();
    
    if (type === 'thermal') {
      // Render thermal template
      return res.render('invoices/supplier-return-thermal', {
        user: req.user,
        returnData,
        settings,
        activePage: 'returns'
      });
    }
    
    // For normal template, use the reusable invoice template
    const leftDetails = returnData.supplier ? [
      { label: 'Name', value: returnData.supplier.name },
      { label: 'Address', value: returnData.supplier.address },
      { label: 'Phone', value: returnData.supplier.number },
      { label: 'Balance', value: `$${returnData.supplier.balance.toFixed(2)}` }
    ] : [];
    
    const rightDetails = [
      { label: 'Date', value: new Date(returnData.date).toLocaleDateString() },
      { label: 'Return #', value: returnData.id },
      { label: 'Reason', value: returnData.reason }
    ];
    
    const columns = [
      { label: 'Item', key: 'name', format: 'nested', path: 'inventory.name' },
      { label: 'Urdu Name', key: 'urduName', format: 'nested', path: 'inventory.urduName', default: '-' },
      { label: 'Quantity', key: 'quantity', align: 'end' },
      { label: 'Unit Price', key: 'price', align: 'end', format: 'currency' },
      { label: 'Total', key: 'total', align: 'end', format: 'currency', compute: (item) => item.quantity * item.price }
    ];
    
    // Add computed total property to each item
    const itemsWithTotal = returnData.items.map(item => ({
      ...item,
      total: item.quantity * item.price
    }));
    
    const totals = [
      { label: 'Total Amount', value: returnData.totalAmount },
      { label: 'Refund Amount', value: returnData.refundAmount }
    ];
    
    res.render('invoices/invoice-template', {
      user: req.user,
      title: `Supplier Return #${returnData.id}`,
      invoiceTitle: 'SUPPLIER RETURN',
      invoiceNumber: returnData.id,
      primaryColor: '#fd7e14', // Bootstrap warning orange
      leftDetailsTitle: 'Supplier',
      leftDetailsDefault: 'One-time Supplier',
      leftDetails,
      rightDetails,
      columns,
      items: itemsWithTotal,
      totals,
      qrData: `SupplierReturn:${returnData.id}`,
      signatureLeft: 'Supplier Signature',
      signatureRight: 'Authorized Signature',
      backUrl: '/returns',
      settings,
      activePage: 'returns'
    });
  } catch (error) {
    console.error('Supplier return invoice error:', error);
    res.status(500).render('error', { 
      user: req.user,
      error: 'Error generating invoice',
      activePage: 'returns'
    });
  }
});

module.exports = router; 