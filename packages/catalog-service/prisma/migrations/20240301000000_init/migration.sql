-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_amount" INTEGER NOT NULL,
    "price_currency" TEXT NOT NULL DEFAULT 'BRL',
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);
