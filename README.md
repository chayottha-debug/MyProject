# SIWAKIT Quote Studio

ระบบออกใบเสนอราคาแบบ modern minimal พร้อมฐานข้อมูลลูกค้า สินค้า ประวัติเอกสาร และลายเซ็นผู้อนุมัติ

## Stack

- Frontend: HTML, CSS, JavaScript
- Database: Supabase
- Serverless: Netlify Functions (Python)
- Backend for Render: Flask + Gunicorn
- Hosting: Netlify or Render

## Features

- สร้างใบเสนอราคาและคำนวณยอดรวมอัตโนมัติ
- ฐานข้อมูลลูกค้า
- ฐานข้อมูลสินค้า
- ประวัติใบเสนอราคา
- ลายเซ็นผู้จัดทำฝังในหน้าเอกสาร
- อัปโหลดลายเซ็นผู้อนุมัติรายเอกสาร
- ดีไซน์ responsive พร้อมโหมดพิมพ์ / export PDF ผ่าน browser print

## โครงสร้างไฟล์

- `index.html` หน้าเว็บหลัก
- `assets/app.js` logic ทั้งระบบ
- `assets/styles.css` งานออกแบบ UI
- `app.py` Flask app สำหรับ Render
- `requirements.txt` dependency สำหรับ Render
- `render.yaml` service definition สำหรับ Render
- `netlify/functions/quote_summary.py` ฟังก์ชัน Python สำหรับคำนวณยอดรวมและแปลงยอดเป็นข้อความเงินบาท
- `supabase/schema.sql` โครงสร้างฐานข้อมูล

## วิธีตั้งค่า Supabase

1. สร้างโปรเจกต์ใน Supabase
2. เปิด SQL Editor
3. รันไฟล์ `supabase/schema.sql`
4. คัดลอก `Project URL` และ `anon public key`
5. เปิดเว็บ แล้วกดปุ่ม `ตั้งค่า Supabase`
6. วางค่า URL และ Anon Key แล้วบันทึก

หมายเหตุ:
- เวอร์ชันนี้ใช้ `anon key` ฝั่งเว็บโดยตรง เพื่อให้ deploy บน Netlify ได้ง่าย
- ถ้าจะใช้จริงในหลายผู้ใช้ ควรเพิ่มระบบ auth และจำกัด policy ให้รัดกุมกว่านี้

## Deploy บน GitHub + Netlify

1. สร้าง repository ใหม่บน GitHub
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น repo
3. ไปที่ Netlify แล้วเลือก `Add new site` > `Import an existing project`
4. เลือก repository นี้
5. ตั้งค่า build ดังนี้
   - Build command: เว้นว่าง
   - Publish directory: `.`
6. Deploy

Netlify จะอ่านค่า `netlify.toml` อัตโนมัติและเปิดใช้ Python Function ที่อยู่ใน `netlify/functions`

## Deploy บน Render

อ้างอิงจาก Render Docs:
- Python web service ใช้ `pip install -r requirements.txt` เป็น build command และ `gunicorn app:app` เป็น start command
- Render web service ต้องเปิดพอร์ตสาธารณะและเหมาะกับแอป dynamic มากกว่าการใช้ static site เมื่อต้องมี backend route

วิธี deploy แบบสร้าง service ใหม่โดยไม่ทับของเดิม:
1. ไปที่ Render Dashboard
2. กด `New +` > `Web Service`
3. เลือก repo `chayottha-debug/MyProject`
4. ตั้งค่าดังนี้
   - Name: `siwakit-quote-studio-render` หรือชื่อใหม่ที่คุณต้องการ
   - Runtime: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app`
5. กด Deploy

ถ้าคุณใช้ Blueprint บน Render ได้:
- ใน repo นี้มี `render.yaml` ให้แล้ว
- คุณสามารถให้ Render สร้าง service ใหม่จากไฟล์นี้ได้เลย

## การพัฒนาต่อ

- เพิ่มระบบ login ด้วย Supabase Auth
- เพิ่มการสร้าง PDF แบบเซิร์ฟเวอร์จริง
- เพิ่ม bucket สำหรับเก็บไฟล์ลายเซ็นแทนการเก็บ data URL
- เพิ่มเลขภาษี / ข้อมูลบริษัท / เทมเพลตหลายแบบ
