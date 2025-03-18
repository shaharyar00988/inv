-- CreateTable
CREATE TABLE "CustomerReturn" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "refundAmount" REAL NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "customerId" INTEGER,
    CONSTRAINT "CustomerReturn_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerReturnItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "customerReturnId" INTEGER NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    CONSTRAINT "CustomerReturnItem_customerReturnId_fkey" FOREIGN KEY ("customerReturnId") REFERENCES "CustomerReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CustomerReturnItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierReturn" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" REAL NOT NULL DEFAULT 0,
    "refundAmount" REAL NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "supplierId" INTEGER,
    CONSTRAINT "SupplierReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplierReturnItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quantity" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "supplierReturnId" INTEGER NOT NULL,
    "inventoryId" INTEGER NOT NULL,
    CONSTRAINT "SupplierReturnItem_supplierReturnId_fkey" FOREIGN KEY ("supplierReturnId") REFERENCES "SupplierReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplierReturnItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
