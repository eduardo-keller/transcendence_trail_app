-- CreateIndex
CREATE INDEX "Trail_elevationGain_idx" ON "Trail"("elevationGain");

-- CreateIndex
CREATE INDEX "Trail_title_id_idx" ON "Trail"("title", "id");
