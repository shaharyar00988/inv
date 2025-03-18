-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SalesItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "totalPrice" REAL NOT NULL,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "customItemName" TEXT,
    "salesId" INTEGER NOT NULL,
    "inventoryId" INTEGER,
    CONSTRAINT "SalesItem_salesId_fkey" FOREIGN KEY ("salesId") REFERENCES "Sales" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SalesItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_SalesItem" ("id", "inventoryId", "quantity", "salesId", "totalPrice", "unitPrice") SELECT "id", "inventoryId", "quantity", "salesId", "totalPrice", "unitPrice" FROM "SalesItem";
DROP TABLE "SalesItem";
ALTER TABLE "new_SalesItem" RENAME TO "SalesItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
