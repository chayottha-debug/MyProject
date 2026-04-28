-- Migration: เพิ่มคอลัมน์ที่จำเป็นในตาราง quotes
-- รัน script นี้ใน Supabase Dashboard > SQL Editor

-- เพิ่มคอลัมน์ delivery_term (กำหนดส่ง)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS delivery_term text NOT NULL DEFAULT 'ภายใน 7-15 วัน';

-- เพิ่มคอลัมน์ validity_term (ยืนราคา)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS validity_term text NOT NULL DEFAULT '30 วัน';

-- เพิ่มคอลัมน์ include_vat (รวม VAT หรือไม่)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS include_vat boolean NOT NULL DEFAULT true;
