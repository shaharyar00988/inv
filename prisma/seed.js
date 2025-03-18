const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

// Helper function to hash passwords
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

async function main() {
  console.log('Seeding database with minimal sample data...');

  // Create default admin user
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashPassword('admin123')
    }
  });
  console.log('Created default admin user (username: admin, password: admin123)');

  // Create sample shop settings
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      shopName: 'Auto Parts & Service Shop',
      address: '123 Main Street, City',
      phone: '0300-1234567',
      email: 'contact@autoparts.com'
    }
  });
  console.log('Created shop settings');

  // Create sample inventory items (car parts)
  const carParts = [
    {
      name: 'Oil Filter',
      urduName: 'آئل فلٹر',
      type: 'part',
      purchasePrice: 250,
      retailPrice: 350,
      stock: 25
    },
    {
      name: 'Air Filter',
      urduName: 'ایئر فلٹر',
      type: 'part',
      purchasePrice: 300,
      retailPrice: 450,
      stock: 20
    },
    {
      name: 'Brake Pads',
      urduName: 'بریک پیڈز',
      type: 'part',
      purchasePrice: 800,
      retailPrice: 1200,
      stock: 15
    },
    {
      name: 'Engine Oil (1L)',
      urduName: 'انجن آئل',
      type: 'part',
      purchasePrice: 500,
      retailPrice: 700,
      stock: 30
    }
  ];

  // Create sample inventory items (motorcycle parts)
  const motorcycleParts = [
    {
      name: 'Motorcycle Chain',
      urduName: 'موٹرسائیکل چین',
      type: 'part',
      purchasePrice: 350,
      retailPrice: 500,
      stock: 15
    },
    {
      name: 'Motorcycle Spark Plug',
      urduName: 'موٹرسائیکل سپارک پلگ',
      type: 'part',
      purchasePrice: 120,
      retailPrice: 200,
      stock: 30
    },
    {
      name: 'Motorcycle Brake Shoes',
      urduName: 'موٹرسائیکل بریک شوز',
      type: 'part',
      purchasePrice: 250,
      retailPrice: 400,
      stock: 20
    },
    {
      name: 'Motorcycle Clutch Plates',
      urduName: 'موٹرسائیکل کلچ پلیٹس',
      type: 'part',
      purchasePrice: 450,
      retailPrice: 700,
      stock: 10
    },
    {
      name: 'Motorcycle Air Filter',
      urduName: 'موٹرسائیکل ایئر فلٹر',
      type: 'part',
      purchasePrice: 180,
      retailPrice: 300,
      stock: 25
    }
  ];

  // Create sample services
  const services = [
    {
      name: 'Oil Change Service',
      urduName: 'آئل چینج سروس',
      type: 'service',
      purchasePrice: 300,
      retailPrice: 500,
      stock: 999
    },
    {
      name: 'Brake Service',
      urduName: 'بریک سروس',
      type: 'service',
      purchasePrice: 500,
      retailPrice: 800,
      stock: 999
    },
    {
      name: 'Motorcycle Tune-up',
      urduName: 'موٹرسائیکل ٹیون اپ',
      type: 'service',
      purchasePrice: 400,
      retailPrice: 600,
      stock: 999
    },
    {
      name: 'Motorcycle Chain Adjustment',
      urduName: 'موٹرسائیکل چین ایڈجسٹمنٹ',
      type: 'service',
      purchasePrice: 150,
      retailPrice: 250,
      stock: 999
    },
    {
      name: 'Tire Replacement',
      urduName: 'ٹائر تبدیلی',
      type: 'service',
      purchasePrice: 200,
      retailPrice: 350,
      stock: 999
    }
  ];

  // Add all inventory items
  const allItems = [...carParts, ...motorcycleParts, ...services];
  
  for (let i = 0; i < allItems.length; i++) {
    await prisma.inventory.upsert({
      where: { id: i + 1 },
      update: {},
      create: allItems[i]
    });
  }
  
  console.log(`Created ${allItems.length} inventory items (car parts, motorcycle parts, and services)`);

  // Create one sample customer
  const customer = await prisma.customer.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Ahmed Khan',
      address: '123 Main Street, Islamabad',
      number: '0300-1234567',
      balance: 0
    }
  });
  console.log('Created sample customer');

  // Create one sample supplier
  const supplier = await prisma.supplier.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Auto Parts Wholesale',
      address: '123 Industrial Area, Islamabad',
      number: '051-1234567',
      balance: 0
    }
  });
  console.log('Created sample supplier');

  // Create one sample worker
  const worker = await prisma.worker.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Ali Raza',
      address: '123 Worker Colony, Islamabad',
      number: '0300-7778888'
    }
  });
  console.log('Created sample worker');

  // Create one sample purchase
  const purchase = await prisma.purchase.create({
    data: {
      date: new Date(),
      totalAmount: 2500,
      amountPaid: 2500,
      notes: 'Initial stock purchase',
      supplierId: supplier.id,
      items: {
        create: [
          {
            quantity: 10,
            price: 250,
            inventoryId: 1 // Oil Filter
          }
        ]
      }
    }
  });
  console.log('Created sample purchase');

  // Create one sample sale
  const sale = await prisma.sales.create({
    data: {
      invoiceNo: 'INV-001',
      date: new Date(),
      totalAmount: 850,
      discount: 0,
      netAmount: 850,
      amountPaid: 850,
      notes: 'Regular maintenance',
      customerId: customer.id,
      workerId: worker.id,
      items: {
        create: [
          {
            quantity: 1,
            unitPrice: 350,
            totalPrice: 350,
            inventoryId: 1 // Oil Filter
          },
          {
            quantity: 1,
            unitPrice: 500,
            totalPrice: 500,
            inventoryId: 6 // Oil Change Service
          }
        ]
      }
    }
  });
  console.log('Created sample sale');

  // Create one sample customer return
  const customerReturn = await prisma.customerReturn.create({
    data: {
      date: new Date(),
      totalAmount: 350,
      reason: 'Wrong part',
      customerId: customer.id,
      items: {
        create: [
          {
            quantity: 1,
            price: 350,
            inventoryId: 1 // Oil Filter
          }
        ]
      }
    }
  });
  console.log('Created sample customer return');

  // Create one sample supplier return
  const supplierReturn = await prisma.supplierReturn.create({
    data: {
      date: new Date(),
      totalAmount: 250,
      reason: 'Defective part',
      supplierId: supplier.id,
      items: {
        create: [
          {
            quantity: 1,
            price: 250,
            inventoryId: 1 // Oil Filter
          }
        ]
      }
    }
  });
  console.log('Created sample supplier return');

  // Create one sample expense
  const expense = await prisma.expense.create({
    data: {
      date: new Date(),
      amount: 5000,
      category: 'Rent',
      description: 'Monthly shop rent'
    }
  });
  console.log('Created sample expense');

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 