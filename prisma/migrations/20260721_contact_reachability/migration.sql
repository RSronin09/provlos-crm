-- Contact reachability: deliverability status for emails, direct-vs-main-line for phones
ALTER TABLE "Contact" ADD COLUMN "emailStatus" TEXT;
ALTER TABLE "Contact" ADD COLUMN "phoneType" TEXT;
