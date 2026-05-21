-- CreateTable
CREATE TABLE "_AdditionalRoles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AdditionalRoles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AdditionalRoles_B_index" ON "_AdditionalRoles"("B");

-- AddForeignKey
ALTER TABLE "_AdditionalRoles" ADD CONSTRAINT "_AdditionalRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdditionalRoles" ADD CONSTRAINT "_AdditionalRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
