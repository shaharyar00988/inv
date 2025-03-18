const express = require('express');
const router = express.Router();
const prisma = require('../utils/db');

// Main reports dashboard
router.get('/', async (req, res) => {
  try {
    // Get summary counts for dashboard
    const totalSales = await prisma.sales.count();
    const totalPurchases = await prisma.purchase.count();
    const totalCustomers = await prisma.customer.count();
    const totalSuppliers = await prisma.supplier.count();
    const totalWorkers = await prisma.worker.count();
    
    // Get total balances with proper number handling
    const customers = await prisma.customer.findMany();
    const suppliers = await prisma.supplier.findMany();
    
    const totalCustomerBalance = customers.reduce((sum, c) => {
      const balance = typeof c.balance === 'string' ? parseFloat(c.balance) : (c.balance || 0);
      return sum + balance;
    }, 0);
    
    const totalSupplierBalance = suppliers.reduce((sum, s) => {
      const balance = typeof s.balance === 'string' ? parseFloat(s.balance) : (s.balance || 0);
      return sum + balance;
    }, 0);

    res.render('reports/index', {
      user: req.user,
      activePage: 'reports',
      totalSales,
      totalPurchases,
      totalCustomers,
      totalSuppliers,
      totalWorkers,
      totalCustomerBalance: parseFloat(totalCustomerBalance.toFixed(2)),
      totalSupplierBalance: parseFloat(totalSupplierBalance.toFixed(2))
    });
  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).send('Error loading reports');
  }
});

// Sales report
router.get('/sales', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    let end = endDate ? new Date(endDate) : new Date();
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999);
    
    const sales = await prisma.sales.findMany({
      where: {
        date: {
          gte: start,
          lte: end
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
      },
      orderBy: {
        date: 'desc'
      }
    });
    
    console.log('Raw sales data:', JSON.stringify(sales, null, 2)); // Debug log
    
    // Calculate totals with proper number handling
    const totalSales = sales.length;
    
    // Calculate total amount
    const totalAmount = sales.reduce((sum, sale) => {
      const amount = Number(sale.totalAmount) || 0;
      console.log(`Sale ${sale.id} totalAmount:`, amount); // Debug log
      return sum + amount;
    }, 0);
    
    // Calculate total discount
    const totalDiscount = sales.reduce((sum, sale) => {
      const discount = Number(sale.discount) || 0;
      console.log(`Sale ${sale.id} discount:`, discount); // Debug log
      return sum + discount;
    }, 0);
    
    // Calculate total net amount
    const totalNetAmount = sales.reduce((sum, sale) => {
      const netAmount = Number(sale.netAmount) || Number(sale.totalAmount) || 0;
      console.log(`Sale ${sale.id} netAmount:`, netAmount); // Debug log
      return sum + netAmount;
    }, 0);
    
    // Calculate total amount paid
    const totalAmountPaid = sales.reduce((sum, sale) => {
      const amountPaid = Number(sale.amountPaid) || 0;
      console.log(`Sale ${sale.id} amountPaid:`, amountPaid); // Debug log
      return sum + amountPaid;
    }, 0);
    
    const totalBalanceDue = totalNetAmount - totalAmountPaid;
    
    console.log('Final totals:', {
      totalSales,
      totalAmount,
      totalDiscount,
      totalNetAmount,
      totalAmountPaid,
      totalBalanceDue
    }); // Debug log

    // Process sales data for display
    const processedSales = sales.map(sale => ({
      ...sale,
      totalAmount: Number(sale.totalAmount) || 0,
      discount: Number(sale.discount) || 0,
      netAmount: Number(sale.netAmount) || Number(sale.totalAmount) || 0,
      amountPaid: Number(sale.amountPaid) || 0,
      balanceDue: (Number(sale.netAmount) || Number(sale.totalAmount) || 0) - (Number(sale.amountPaid) || 0)
    }));
    
    res.render('reports/sales', {
      user: req.user,
      activePage: 'reports',
      sales: processedSales,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      totalSales,
      totalAmount: Number(totalAmount.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      totalNetAmount: Number(totalNetAmount.toFixed(2)),
      totalAmountPaid: Number(totalAmountPaid.toFixed(2)),
      totalBalanceDue: Number(totalBalanceDue.toFixed(2))
    });
  } catch (error) {
    console.error('Sales report error:', error);
    console.error(error.stack); // Log full error stack
    res.status(500).send('Error generating sales report');
  }
});

// Purchases report
router.get('/purchases', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    let end = endDate ? new Date(endDate) : new Date();
    
    // Set end date to end of day
    end.setHours(23, 59, 59, 999);
    
    const purchases = await prisma.purchase.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        supplier: true,
        items: {
          include: {
            inventory: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });
    
    // Calculate totals
    const totalPurchases = purchases.length;
    const totalAmount = purchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
    const totalAmountPaid = purchases.reduce((sum, purchase) => sum + purchase.amountPaid, 0);
    const totalBalanceDue = totalAmount - totalAmountPaid;
    
    res.render('reports/purchases', {
      user: req.user,
      activePage: 'reports',
      purchases,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      totalPurchases,
      totalAmount,
      totalAmountPaid,
      totalBalanceDue
    });
  } catch (error) {
    console.error('Purchases report error:', error);
    res.status(500).send('Error generating purchases report');
  }
});

// Inventory report
router.get('/inventory', async (req, res) => {
  try {
    // Get inventory with all related data
    const inventory = await prisma.inventory.findMany({
      include: {
        salesItems: {
          include: {
            sales: true
          }
        },
        purchaseItems: {
          include: {
            purchase: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log('Raw inventory data:', JSON.stringify(inventory, null, 2)); // Debug log

    // Calculate inventory metrics with proper calculations
    const inventoryAnalysis = inventory.map(item => {
      try {
        console.log('Processing item:', item.name); // Debug log
        console.log('Raw item data:', JSON.stringify(item, null, 2)); // Log complete item data
        
        // Convert fields using the correct field names
        const quantity = typeof item.stock === 'object' && item.stock !== null ? 
          parseFloat(item.stock.toString()) : 
          (typeof item.stock === 'string' ? parseFloat(item.stock) : 
          (typeof item.stock === 'number' ? item.stock : 0));
          
        const costPrice = typeof item.purchasePrice === 'object' && item.purchasePrice !== null ? 
          parseFloat(item.purchasePrice.toString()) : 
          (typeof item.purchasePrice === 'string' ? parseFloat(item.purchasePrice) : 
          (typeof item.purchasePrice === 'number' ? item.purchasePrice : 0));
          
        const salePrice = typeof item.retailPrice === 'object' && item.retailPrice !== null ? 
          parseFloat(item.retailPrice.toString()) : 
          (typeof item.retailPrice === 'string' ? parseFloat(item.retailPrice) : 
          (typeof item.retailPrice === 'number' ? item.retailPrice : 0));
        
        console.log('Raw values:', {
          rawQuantity: item.stock,
          rawCostPrice: item.purchasePrice,
          rawSalePrice: item.retailPrice,
          typeQuantity: typeof item.stock,
          typeCostPrice: typeof item.purchasePrice,
          typeSalePrice: typeof item.retailPrice
        });
        
        console.log('Parsed values:', { quantity, costPrice, salePrice }); // Debug log
        
        // Calculate total value (current stock value)
        const totalValue = quantity * costPrice;
        
        // Calculate potential revenue (if all current stock is sold)
        const potentialRevenue = quantity * salePrice;
        
        // Calculate potential profit
        const potentialProfit = potentialRevenue - totalValue;
        
        console.log('Calculated values:', { totalValue, potentialRevenue, potentialProfit }); // Debug log
        
        // Calculate total quantities sold and purchased with detailed logging
        let totalQuantitySold = 0;
        let actualSalesValue = 0;
        
        if (item.salesItems && item.salesItems.length > 0) {
          item.salesItems.forEach(saleItem => {
            console.log('Raw sale item:', JSON.stringify(saleItem, null, 2));
            
            const itemQuantity = typeof saleItem.quantity === 'object' && saleItem.quantity !== null ? 
              parseFloat(saleItem.quantity.toString()) : 
              (typeof saleItem.quantity === 'string' ? parseFloat(saleItem.quantity) : 
              (typeof saleItem.quantity === 'number' ? saleItem.quantity : 0));
              
            const itemPrice = typeof saleItem.price === 'object' && saleItem.price !== null ? 
              parseFloat(saleItem.price.toString()) : 
              (typeof saleItem.price === 'string' ? parseFloat(saleItem.price) : 
              (typeof saleItem.price === 'number' ? saleItem.price : 0));
            
            console.log('Sale item:', {
              rawQuantity: saleItem.quantity,
              rawPrice: saleItem.price,
              typeQuantity: typeof saleItem.quantity,
              typePrice: typeof saleItem.price,
              parsedQuantity: itemQuantity,
              parsedPrice: itemPrice
            });
            
            totalQuantitySold += itemQuantity;
            actualSalesValue += (itemQuantity * itemPrice);
          });
        }
        
        let totalQuantityPurchased = 0;
        let actualPurchaseValue = 0;
        
        if (item.purchaseItems && item.purchaseItems.length > 0) {
          item.purchaseItems.forEach(purchaseItem => {
            console.log('Raw purchase item:', JSON.stringify(purchaseItem, null, 2));
            
            const itemQuantity = typeof purchaseItem.quantity === 'object' && purchaseItem.quantity !== null ? 
              parseFloat(purchaseItem.quantity.toString()) : 
              (typeof purchaseItem.quantity === 'string' ? parseFloat(purchaseItem.quantity) : 
              (typeof purchaseItem.quantity === 'number' ? purchaseItem.quantity : 0));
              
            const itemPrice = typeof purchaseItem.price === 'object' && purchaseItem.price !== null ? 
              parseFloat(purchaseItem.price.toString()) : 
              (typeof purchaseItem.price === 'string' ? parseFloat(purchaseItem.price) : 
              (typeof purchaseItem.price === 'number' ? purchaseItem.price : 0));
            
            console.log('Purchase item:', {
              rawQuantity: purchaseItem.quantity,
              rawPrice: purchaseItem.price,
              typeQuantity: typeof purchaseItem.quantity,
              typePrice: typeof purchaseItem.price,
              parsedQuantity: itemQuantity,
              parsedPrice: itemPrice
            });
            
            totalQuantityPurchased += itemQuantity;
            actualPurchaseValue += (itemQuantity * itemPrice);
          });
        }
        
        console.log('Transaction values:', {
          totalQuantitySold,
          totalQuantityPurchased,
          actualSalesValue,
          actualPurchaseValue
        }); // Debug log
        
        // Calculate sales and purchase counts
        const salesCount = (item.salesItems || []).length;
        const purchaseCount = (item.purchaseItems || []).length;
        
        // Calculate turnover rate (sales quantity / purchase quantity)
        const turnoverRate = totalQuantityPurchased > 0 ? 
          (totalQuantitySold / totalQuantityPurchased) : 0;

        const result = {
          id: item.id,
          name: item.name,
          quantity: parseFloat(quantity.toFixed(2)),
          costPrice: parseFloat(costPrice.toFixed(2)),
          salePrice: parseFloat(salePrice.toFixed(2)),
          totalValue: parseFloat(totalValue.toFixed(2)),
          potentialRevenue: parseFloat(potentialRevenue.toFixed(2)),
          potentialProfit: parseFloat(potentialProfit.toFixed(2)),
          actualSalesValue: parseFloat(actualSalesValue.toFixed(2)),
          actualPurchaseValue: parseFloat(actualPurchaseValue.toFixed(2)),
          turnoverRate: parseFloat(turnoverRate.toFixed(2)),
          salesCount,
          purchaseCount,
          totalQuantitySold: parseFloat(totalQuantitySold.toFixed(2)),
          totalQuantityPurchased: parseFloat(totalQuantityPurchased.toFixed(2))
        };
        
        console.log('Final result for item:', result); // Debug log
        return result;
      } catch (itemError) {
        console.error('Error processing inventory item:', item.name, itemError);
        console.error('Raw item data:', JSON.stringify(item, null, 2));
        throw itemError; // Re-throw to see the full error
      }
    });

    // Sort by total value in descending order
    inventoryAnalysis.sort((a, b) => b.totalValue - a.totalValue);

    // Calculate totals with proper rounding
    const totalInventoryValue = parseFloat(inventoryAnalysis.reduce((sum, item) => sum + item.totalValue, 0).toFixed(2));
    const totalPotentialRevenue = parseFloat(inventoryAnalysis.reduce((sum, item) => sum + item.potentialRevenue, 0).toFixed(2));
    const totalPotentialProfit = parseFloat(inventoryAnalysis.reduce((sum, item) => sum + item.potentialProfit, 0).toFixed(2));
    const totalActualSalesValue = parseFloat(inventoryAnalysis.reduce((sum, item) => sum + item.actualSalesValue, 0).toFixed(2));
    const totalActualPurchaseValue = parseFloat(inventoryAnalysis.reduce((sum, item) => sum + item.actualPurchaseValue, 0).toFixed(2));
    
    // Calculate average turnover rate only for items with purchases
    const itemsWithPurchases = inventoryAnalysis.filter(item => item.totalQuantityPurchased > 0);
    const averageTurnoverRate = itemsWithPurchases.length > 0 
      ? parseFloat((itemsWithPurchases.reduce((sum, item) => sum + item.turnoverRate, 0) / itemsWithPurchases.length).toFixed(2))
      : 0;

    console.log('Final totals:', {
      totalInventoryValue,
      totalPotentialRevenue,
      totalPotentialProfit,
      totalActualSalesValue,
      totalActualPurchaseValue,
      averageTurnoverRate
    }); // Debug log
    
    res.render('reports/inventory', {
      user: req.user,
      activePage: 'reports',
      inventoryAnalysis,
      totalInventoryValue,
      totalPotentialRevenue,
      totalPotentialProfit,
      totalActualSalesValue,
      totalActualPurchaseValue,
      averageTurnoverRate
    });
  } catch (error) {
    console.error('Inventory analysis report error:', error);
    console.error(error.stack); // Log full error stack
    res.status(500).send('Error generating inventory analysis report');
  }
});

// Customer balances report
router.get('/customer-balances', async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    // Calculate totals
    const totalCustomers = customers.length;
    const totalBalance = customers.reduce((sum, customer) => sum + customer.balance, 0);
    const customersWithBalance = customers.filter(customer => customer.balance > 0).length;
    
    res.render('reports/customer-balances', {
      user: req.user,
      activePage: 'reports',
      customers,
      totalCustomers,
      totalBalance,
      customersWithBalance
    });
  } catch (error) {
    console.error('Customer balances report error:', error);
    res.status(500).send('Error generating customer balances report');
  }
});

// Supplier balances report
router.get('/supplier-balances', async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    // Calculate totals
    const totalSuppliers = suppliers.length;
    const totalBalance = suppliers.reduce((sum, supplier) => sum + supplier.balance, 0);
    const suppliersWithBalance = suppliers.filter(supplier => supplier.balance > 0).length;
    
    res.render('reports/supplier-balances', {
      user: req.user,
      activePage: 'reports',
      suppliers,
      totalSuppliers,
      totalBalance,
      suppliersWithBalance
    });
  } catch (error) {
    console.error('Supplier balances report error:', error);
    res.status(500).send('Error generating supplier balances report');
  }
});

// Profit Analysis Report
router.get('/profit', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    let end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Get all sales with their items and costs
    const sales = await prisma.sales.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        items: {
          include: {
            inventory: true
          }
        }
      }
    });

    console.log('Raw sales data:', JSON.stringify(sales, null, 2)); // Debug log

    // Calculate profits
    const profitData = sales.map(sale => {
      try {
        // Ensure netAmount and totalAmount have default values with proper Decimal handling
        const netAmount = typeof sale.netAmount === 'object' && sale.netAmount !== null ? 
          parseFloat(sale.netAmount.toString()) :
          (typeof sale.netAmount === 'string' ? parseFloat(sale.netAmount) : 
          (typeof sale.netAmount === 'number' ? sale.netAmount : 0));

        const totalAmount = typeof sale.totalAmount === 'object' && sale.totalAmount !== null ? 
          parseFloat(sale.totalAmount.toString()) :
          (typeof sale.totalAmount === 'string' ? parseFloat(sale.totalAmount) : 
          (typeof sale.totalAmount === 'number' ? sale.totalAmount : 0));
        
        // Calculate total cost with proper Decimal handling for purchasePrice
        const totalCost = sale.items.reduce((sum, item) => {
          const quantity = typeof item.quantity === 'object' && item.quantity !== null ? 
            parseFloat(item.quantity.toString()) :
            (typeof item.quantity === 'string' ? parseFloat(item.quantity) : 
            (typeof item.quantity === 'number' ? item.quantity : 0));

          const purchasePrice = item.inventory && typeof item.inventory.purchasePrice === 'object' && item.inventory.purchasePrice !== null ? 
            parseFloat(item.inventory.purchasePrice.toString()) :
            (item.inventory && typeof item.inventory.purchasePrice === 'string' ? parseFloat(item.inventory.purchasePrice) : 
            (item.inventory && typeof item.inventory.purchasePrice === 'number' ? item.inventory.purchasePrice : 0));

          const itemCost = quantity * purchasePrice;
          
          console.log('Item cost calculation:', {
            itemName: item.inventory?.name,
            quantity,
            purchasePrice,
            itemCost
          });
          
          return sum + itemCost;
        }, 0);
        
        const profit = netAmount - totalCost;
        // Prevent division by zero
        const profitMargin = netAmount > 0 ? ((profit / netAmount) * 100).toFixed(2) : '0.00';

        const result = {
          id: sale.id,
          date: sale.date,
          invoiceNumber: sale.invoiceNumber || `INV-${sale.id}`,
          totalAmount: parseFloat(totalAmount.toFixed(2)),
          netAmount: parseFloat(netAmount.toFixed(2)),
          totalCost: parseFloat(totalCost.toFixed(2)),
          profit: parseFloat(profit.toFixed(2)),
          profitMargin
        };

        console.log('Sale profit calculation:', result);
        return result;
      } catch (error) {
        console.error('Error processing sale:', sale.id, error);
        // Return a safe default object if there's an error
        return {
          id: sale.id,
          date: sale.date,
          invoiceNumber: sale.invoiceNumber || `INV-${sale.id}`,
          totalAmount: 0,
          netAmount: 0,
          totalCost: 0,
          profit: 0,
          profitMargin: '0.00'
        };
      }
    });

    // Calculate summary with proper handling
    const totalSales = parseFloat(profitData.reduce((sum, sale) => sum + sale.netAmount, 0).toFixed(2));
    const totalCost = parseFloat(profitData.reduce((sum, sale) => sum + sale.totalCost, 0).toFixed(2));
    const totalProfit = parseFloat(profitData.reduce((sum, sale) => sum + sale.profit, 0).toFixed(2));
    // Prevent division by zero in average calculation
    const averageProfitMargin = totalSales > 0 ? ((totalProfit / totalSales) * 100).toFixed(2) : '0.00';

    console.log('Final totals:', {
      totalSales,
      totalCost,
      totalProfit,
      averageProfitMargin
    });

    res.render('reports/profit', {
      user: req.user,
      activePage: 'reports',
      profitData,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      totalSales,
      totalCost,
      totalProfit,
      averageProfitMargin
    });
  } catch (error) {
    console.error('Profit report error:', error);
    console.error(error.stack); // Log full error stack
    res.status(500).send('Error generating profit report');
  }
});

// Worker Performance Report
router.get('/worker-performance', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    let end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Get all workers
    const workers = await prisma.worker.findMany({
      include: {
        sales: {
          where: {
            date: {
              gte: start,
              lte: end
            }
          }
        }
      }
    });

    // Calculate performance metrics
    const workerPerformance = workers.map(worker => {
      const totalSales = worker.sales.length;
      const totalAmount = worker.sales.reduce((sum, sale) => sum + sale.netAmount, 0);
      const averageSaleValue = totalSales > 0 ? totalAmount / totalSales : 0;

      return {
        id: worker.id,
        name: worker.name,
        totalSales,
        totalAmount,
        averageSaleValue
      };
    });

    // Sort by total amount in descending order
    workerPerformance.sort((a, b) => b.totalAmount - a.totalAmount);

    res.render('reports/worker-performance', {
      user: req.user,
      activePage: 'reports',
      workerPerformance,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Worker performance report error:', error);
    res.status(500).send('Error generating worker performance report');
  }
});

// Balance Summary Report
router.get('/balance-summary', async (req, res) => {
  try {
    // Get customers with their total sales and payments
    const customers = await prisma.customer.findMany({
      include: {
        sales: true,
        payments: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Get suppliers with their total purchases and payments
    const suppliers = await prisma.supplier.findMany({
      include: {
        purchases: true,
        payments: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log('Raw customer data:', JSON.stringify(customers, null, 2)); // Debug log
    console.log('Raw supplier data:', JSON.stringify(suppliers, null, 2)); // Debug log

    // Calculate customer metrics with proper calculations
    const customerSummary = customers.map(customer => {
      // Calculate total sales safely with Decimal handling
      const totalSales = customer.sales.reduce((sum, sale) => {
        const netAmount = typeof sale.netAmount === 'object' && sale.netAmount !== null ? 
          parseFloat(sale.netAmount.toString()) :
          (typeof sale.netAmount === 'string' ? parseFloat(sale.netAmount) : 
          (typeof sale.netAmount === 'number' ? sale.netAmount : 0));

        const totalAmount = typeof sale.totalAmount === 'object' && sale.totalAmount !== null ? 
          parseFloat(sale.totalAmount.toString()) :
          (typeof sale.totalAmount === 'string' ? parseFloat(sale.totalAmount) : 
          (typeof sale.totalAmount === 'number' ? sale.totalAmount : 0));

        const amount = netAmount || totalAmount || 0;
        console.log(`Customer ${customer.name} sale:`, { netAmount, totalAmount, finalAmount: amount });
        return sum + amount;
      }, 0);
      
      // Calculate total payments safely with Decimal handling
      const totalPayments = customer.payments.reduce((sum, payment) => {
        const amount = typeof payment.amount === 'object' && payment.amount !== null ? 
          parseFloat(payment.amount.toString()) :
          (typeof payment.amount === 'string' ? parseFloat(payment.amount) : 
          (typeof payment.amount === 'number' ? payment.amount : 0));

        console.log(`Customer ${customer.name} payment:`, { amount });
        return sum + amount;
      }, 0);
      
      // Calculate balance safely with Decimal handling
      const balance = typeof customer.balance === 'object' && customer.balance !== null ? 
        parseFloat(customer.balance.toString()) :
        (typeof customer.balance === 'string' ? parseFloat(customer.balance) : 
        (typeof customer.balance === 'number' ? customer.balance : 0));
      
      // Calculate payment percentage
      const paymentPercentage = totalSales > 0 ? 
        ((totalPayments / totalSales) * 100).toFixed(2) : '0.00';

      const summary = {
        id: customer.id,
        name: customer.name,
        totalSales: parseFloat(totalSales.toFixed(2)),
        totalPayments: parseFloat(totalPayments.toFixed(2)),
        balance: parseFloat(balance.toFixed(2)),
        paymentPercentage
      };

      console.log('Customer summary:', summary);
      return summary;
    });

    // Calculate supplier metrics with proper calculations
    const supplierSummary = suppliers.map(supplier => {
      // Calculate total purchases safely with Decimal handling
      const totalPurchases = supplier.purchases.reduce((sum, purchase) => {
        const netAmount = typeof purchase.netAmount === 'object' && purchase.netAmount !== null ? 
          parseFloat(purchase.netAmount.toString()) :
          (typeof purchase.netAmount === 'string' ? parseFloat(purchase.netAmount) : 
          (typeof purchase.netAmount === 'number' ? purchase.netAmount : 0));

        const totalAmount = typeof purchase.totalAmount === 'object' && purchase.totalAmount !== null ? 
          parseFloat(purchase.totalAmount.toString()) :
          (typeof purchase.totalAmount === 'string' ? parseFloat(purchase.totalAmount) : 
          (typeof purchase.totalAmount === 'number' ? purchase.totalAmount : 0));

        const amount = netAmount || totalAmount || 0;
        console.log(`Supplier ${supplier.name} purchase:`, { netAmount, totalAmount, finalAmount: amount });
        return sum + amount;
      }, 0);
      
      // Calculate total payments safely with Decimal handling
      const totalPayments = supplier.payments.reduce((sum, payment) => {
        const amount = typeof payment.amount === 'object' && payment.amount !== null ? 
          parseFloat(payment.amount.toString()) :
          (typeof payment.amount === 'string' ? parseFloat(payment.amount) : 
          (typeof payment.amount === 'number' ? payment.amount : 0));

        console.log(`Supplier ${supplier.name} payment:`, { amount });
        return sum + amount;
      }, 0);
      
      // Calculate balance safely with Decimal handling
      const balance = typeof supplier.balance === 'object' && supplier.balance !== null ? 
        parseFloat(supplier.balance.toString()) :
        (typeof supplier.balance === 'string' ? parseFloat(supplier.balance) : 
        (typeof supplier.balance === 'number' ? supplier.balance : 0));
      
      // Calculate payment percentage
      const paymentPercentage = totalPurchases > 0 ? 
        ((totalPayments / totalPurchases) * 100).toFixed(2) : '0.00';

      const summary = {
        id: supplier.id,
        name: supplier.name,
        totalPurchases: parseFloat(totalPurchases.toFixed(2)),
        totalPayments: parseFloat(totalPayments.toFixed(2)),
        balance: parseFloat(balance.toFixed(2)),
        paymentPercentage
      };

      console.log('Supplier summary:', summary);
      return summary;
    });

    // Calculate summary totals with proper rounding
    const totalCustomerSales = parseFloat(customerSummary.reduce((sum, c) => sum + c.totalSales, 0).toFixed(2));
    const totalCustomerPayments = parseFloat(customerSummary.reduce((sum, c) => sum + c.totalPayments, 0).toFixed(2));
    const totalCustomerBalance = parseFloat(customerSummary.reduce((sum, c) => sum + c.balance, 0).toFixed(2));
    
    const totalSupplierPurchases = parseFloat(supplierSummary.reduce((sum, s) => sum + s.totalPurchases, 0).toFixed(2));
    const totalSupplierPayments = parseFloat(supplierSummary.reduce((sum, s) => sum + s.totalPayments, 0).toFixed(2));
    const totalSupplierBalance = parseFloat(supplierSummary.reduce((sum, s) => sum + s.balance, 0).toFixed(2));

    console.log('Final totals:', {
      totalCustomerSales,
      totalCustomerPayments,
      totalCustomerBalance,
      totalSupplierPurchases,
      totalSupplierPayments,
      totalSupplierBalance
    });

    res.render('reports/balance-summary', {
      user: req.user,
      activePage: 'reports',
      customerSummary,
      supplierSummary,
      totalCustomerSales,
      totalCustomerPayments,
      totalCustomerBalance,
      totalSupplierPurchases,
      totalSupplierPayments,
      totalSupplierBalance
    });
  } catch (error) {
    console.error('Balance summary report error:', error);
    console.error(error.stack); // Log full error stack
    res.status(500).send('Error generating balance summary report');
  }
});

// Cash Flow Report
router.get('/cash-flow', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
    let end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    console.log('Date range:', { start, end }); // Debug log

    // Get all transactions within date range
    const sales = await prisma.sales.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        customer: true
      }
    });

    const purchases = await prisma.purchase.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        supplier: true
      }
    });

    const customerPayments = await prisma.payment.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        customer: true
      }
    });

    const supplierPayments = await prisma.supplierPayment.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        supplier: true
      }
    });

    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      }
    });

    console.log('Raw transaction data:', {
      sales: JSON.stringify(sales, null, 2),
      purchases: JSON.stringify(purchases, null, 2),
      customerPayments: JSON.stringify(customerPayments, null, 2),
      supplierPayments: JSON.stringify(supplierPayments, null, 2),
      expenses: JSON.stringify(expenses, null, 2)
    }); // Debug log

    // Group transactions by date with proper decimal handling
    const cashFlow = {};
    
    // Process sales (inflow)
    sales.forEach(sale => {
      try {
        const date = sale.date.toISOString().split('T')[0];
        if (!cashFlow[date]) cashFlow[date] = { inflow: 0, outflow: 0 };
        
        // Handle Decimal objects properly for amountPaid
        const amountPaid = typeof sale.amountPaid === 'object' && sale.amountPaid !== null ? 
          parseFloat(sale.amountPaid.toString()) :
          (typeof sale.amountPaid === 'string' ? parseFloat(sale.amountPaid) : 
          (typeof sale.amountPaid === 'number' ? sale.amountPaid : 0));

        console.log('Sale:', {
          date,
          customer: sale.customer?.name,
          rawAmountPaid: sale.amountPaid,
          parsedAmountPaid: amountPaid
        }); // Debug log
        
        cashFlow[date].inflow += amountPaid;
      } catch (error) {
        console.error('Error processing sale:', error);
        console.error('Raw sale data:', JSON.stringify(sale, null, 2));
      }
    });

    // Process purchases (outflow)
    purchases.forEach(purchase => {
      try {
        const date = purchase.date.toISOString().split('T')[0];
        if (!cashFlow[date]) cashFlow[date] = { inflow: 0, outflow: 0 };
        
        // Handle Decimal objects properly for amountPaid
        const amountPaid = typeof purchase.amountPaid === 'object' && purchase.amountPaid !== null ? 
          parseFloat(purchase.amountPaid.toString()) :
          (typeof purchase.amountPaid === 'string' ? parseFloat(purchase.amountPaid) : 
          (typeof purchase.amountPaid === 'number' ? purchase.amountPaid : 0));

        console.log('Purchase:', {
          date,
          supplier: purchase.supplier?.name,
          rawAmountPaid: purchase.amountPaid,
          parsedAmountPaid: amountPaid
        }); // Debug log
        
        cashFlow[date].outflow += amountPaid;
      } catch (error) {
        console.error('Error processing purchase:', error);
        console.error('Raw purchase data:', JSON.stringify(purchase, null, 2));
      }
    });

    // Process customer payments (inflow)
    customerPayments.forEach(payment => {
      try {
        const date = payment.date.toISOString().split('T')[0];
        if (!cashFlow[date]) cashFlow[date] = { inflow: 0, outflow: 0 };
        
        // Handle Decimal objects properly
        const amount = typeof payment.amount === 'object' && payment.amount !== null ? 
          parseFloat(payment.amount.toString()) :
          (typeof payment.amount === 'string' ? parseFloat(payment.amount) : 
          (typeof payment.amount === 'number' ? payment.amount : 0));

        console.log('Customer payment:', {
          date,
          customer: payment.customer?.name,
          rawAmount: payment.amount,
          parsedAmount: amount
        }); // Debug log
        
        cashFlow[date].inflow += amount;
      } catch (error) {
        console.error('Error processing customer payment:', error);
        console.error('Raw payment data:', JSON.stringify(payment, null, 2));
      }
    });

    // Process supplier payments (outflow)
    supplierPayments.forEach(payment => {
      try {
        const date = payment.date.toISOString().split('T')[0];
        if (!cashFlow[date]) cashFlow[date] = { inflow: 0, outflow: 0 };
        
        // Handle Decimal objects properly
        const amount = typeof payment.amount === 'object' && payment.amount !== null ? 
          parseFloat(payment.amount.toString()) :
          (typeof payment.amount === 'string' ? parseFloat(payment.amount) : 
          (typeof payment.amount === 'number' ? payment.amount : 0));

        console.log('Supplier payment:', {
          date,
          supplier: payment.supplier?.name,
          rawAmount: payment.amount,
          parsedAmount: amount
        }); // Debug log
        
        cashFlow[date].outflow += amount;
      } catch (error) {
        console.error('Error processing supplier payment:', error);
        console.error('Raw payment data:', JSON.stringify(payment, null, 2));
      }
    });

    // Process expenses (outflow)
    expenses.forEach(expense => {
      try {
        const date = expense.date.toISOString().split('T')[0];
        if (!cashFlow[date]) cashFlow[date] = { inflow: 0, outflow: 0 };
        
        // Handle Decimal objects properly
        const amount = typeof expense.amount === 'object' && expense.amount !== null ? 
          parseFloat(expense.amount.toString()) :
          (typeof expense.amount === 'string' ? parseFloat(expense.amount) : 
          (typeof expense.amount === 'number' ? expense.amount : 0));

        console.log('Expense:', {
          date,
          description: expense.description,
          rawAmount: expense.amount,
          parsedAmount: amount
        }); // Debug log
        
        cashFlow[date].outflow += amount;
      } catch (error) {
        console.error('Error processing expense:', error);
        console.error('Raw expense data:', JSON.stringify(expense, null, 2));
      }
    });

    // Convert to array and sort by date with proper decimal handling
    const cashFlowData = Object.entries(cashFlow).map(([date, data]) => {
      const inflow = parseFloat(data.inflow.toFixed(2));
      const outflow = parseFloat(data.outflow.toFixed(2));
      const netFlow = parseFloat((inflow - outflow).toFixed(2));
      
      console.log('Daily cash flow:', {
        date,
        inflow,
        outflow,
        netFlow
      }); // Debug log
      
      return {
        date,
        inflow,
        outflow,
        netFlow
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate totals with proper rounding
    const totalInflow = parseFloat(cashFlowData.reduce((sum, day) => sum + day.inflow, 0).toFixed(2));
    const totalOutflow = parseFloat(cashFlowData.reduce((sum, day) => sum + day.outflow, 0).toFixed(2));
    const netFlow = parseFloat((totalInflow - totalOutflow).toFixed(2));

    console.log('Final totals:', {
      totalInflow,
      totalOutflow,
      netFlow
    }); // Debug log

    res.render('reports/cash-flow', {
      user: req.user,
      activePage: 'reports',
      cashFlowData,
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      totalInflow,
      totalOutflow,
      netFlow
    });
  } catch (error) {
    console.error('Cash flow report error:', error);
    console.error(error.stack); // Log full error stack
    res.status(500).send('Error generating cash flow report');
  }
});

module.exports = router; 