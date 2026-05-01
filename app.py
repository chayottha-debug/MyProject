from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
import os
from flask import Flask, jsonify, request, send_from_directory, send_file
import io
from fpdf import FPDF


ROOT = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=str(ROOT / "assets"), static_url_path="/assets")


def _to_decimal(value):
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal("0")


def _read_number(number):
    digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"]
    positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"]
    num = int(number)
    if num == 0:
        return ""

    text = ""
    num_str = str(num)
    for index, char in enumerate(num_str):
        digit = int(char)
        pos = len(num_str) - index - 1
        if digit == 0:
            continue
        if pos == 0 and digit == 1 and len(num_str) > 1:
            text += "เอ็ด"
        elif pos == 1 and digit == 2:
            text += "ยี่"
        elif pos == 1 and digit == 1:
            text += ""
        else:
            text += digits[digit]
        text += positions[pos] if pos < len(positions) else ""
    return text


def baht_text(amount):
    amount = _to_decimal(amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    integer_part = int(amount)
    satang = int((amount - Decimal(integer_part)) * 100)
    if integer_part == 0 and satang == 0:
        return "ศูนย์บาทถ้วน"

    chunks = []
    remaining = integer_part
    while remaining > 0:
        chunks.insert(0, remaining % 1000000)
        remaining //= 1000000

    baht = ""
    for index, chunk in enumerate(chunks):
        if chunk == 0:
            continue
        baht += _read_number(chunk)
        if index < len(chunks) - 1:
            baht += "ล้าน"

    result = f"{baht or 'ศูนย์'}บาท"
    if satang == 0:
        return f"{result}ถ้วน"
    return f"{result}{_read_number(satang)}สตางค์"


def _build_pdf(payload):
    """สร้าง FPDF object จาก payload และคืนค่า bytes"""
    pdf = FPDF(unit='mm', format='A4')
    pdf.set_margins(15, 15, 15)
    pdf.set_auto_page_break(auto=False)

    font_path = ROOT / "assets" / "THSarabunNew.ttf"
    font_bold_path = ROOT / "assets" / "THSarabunNew Bold.ttf" # เพิ่มตัวแปรหาไฟล์ตัวหนา

    if font_path.exists():
        # โหลดตัวธรรมดา
        pdf.add_font('THSarabun', '', str(font_path), uni=True)
        
        # เช็คว่ามีไฟล์ตัวหนาไหม ถ้ามีให้โหลดจับคู่กับสไตล์ 'b'
        if font_bold_path.exists():
            pdf.add_font('THSarabun', 'b', str(font_bold_path), uni=True)
            
        use_f = 'THSarabun'
    else:
        use_f = 'Arial'

    pdf.add_page()

    # HEADER - Center Logo and Remove Company Info
    logo_path = ROOT / "assets" / "LogoNew.png"
    if logo_path.exists():
        # Center logo: A4 width is 210mm. Logo width 25mm.
        # x = (210 - 25) / 2 = 92.5mm
        pdf.image(str(logo_path), x=92.5, y=10, w=25)
    
    # TITLE - Move down to avoid logo overlap
    pdf.set_y(40)
    pdf.set_font(use_f, 'b', 22)
    pdf.cell(0, 10, "ใบเสนอราคา (QUOTATION)", 0, 1, 'C')

    # CUSTOMER INFO BOX (Left)
    pdf.set_xy(15, 55)
    pdf.set_font(use_f, 'b', 13)
    # Draw a box for customer info (Height 30mm)
    pdf.cell(105, 30, "", 1, 0)
    pdf.set_xy(17, 57)
    pdf.cell(0, 7, f"หมู่บ้าน/สถานที่: {payload.get('customer_name', '-')}", 0, 1)
    pdf.set_x(17)
    pdf.cell(0, 7, f"ผู้ติดต่อ: {payload.get('customer_contact', '-')}", 0, 1)
    pdf.set_x(17)
    pdf.multi_cell(100, 5, f"ที่อยู่: {payload.get('customer_address', '-')}\nโทร: {payload.get('customer_phone', '-')}", 0, 'L')

    # DOCUMENT INFO BOX (Right)
    delivery_term = payload.get('delivery_term', 'ภายใน 7-15 วัน')
    validity_term = payload.get('validity_term', '30 วัน')
    pdf.set_xy(125, 55)
    # Draw a box for document info (Height 30mm)
    pdf.cell(70, 30, "", 1, 0)
    pdf.set_xy(127, 57)
    pdf.cell(0, 6, f"เลขที่: {payload.get('quote_no', '-')}", 0, 1, 'L')
    pdf.set_x(127)
    pdf.cell(0, 6, f"วันที่: {payload.get('quote_date', '-')}", 0, 1, 'L')
    pdf.set_x(127)
    pdf.multi_cell(65, 5,
        f"กำหนดส่ง: {delivery_term}\nยืนราคา: {validity_term}\nครบกำหนด: {payload.get('due_date', '-')}",
        0, 'L')

    # TABLE HEADER - Move down to avoid box overlap
    pdf.set_y(95)
    cols_w = [12, 83, 15, 15, 25, 30]
    headers = ["ลำดับ", "รายการสินค้า", "จำนวน", "หน่วย", "ราคา/หน่วย", "จำนวนเงิน"]
    pdf.set_fill_color(240, 240, 240)
    pdf.set_font(use_f, 'b', 13)
    for i, h in enumerate(headers):
        pdf.cell(cols_w[i], 9, h, 1, 0, 'C', True)
    pdf.ln()

    # ITEMS — ใช้ multi_cell สำหรับคอลัมน์รายการสินค้า เพื่อตัดบรรทัดอัตโนมัติ
    items = payload.get('items', [])
    ROW_H = 8  # ความสูงต่อบรรทัด

    for idx, item in enumerate(items):
        qty = float(item.get('qty', 0))
        price = float(item.get('unit_price', 0))
        line_total = qty * price
        desc = item.get('description', '')

        # คำนวณความสูงของ cell รายการสินค้า (คอลัมน์ที่ 2)
        # ใช้ get_string_width เพื่อประมาณจำนวนบรรทัด
        pdf.set_font(use_f, '', 13)
        desc_width = cols_w[1]
        # นับจำนวนบรรทัดที่ต้องการ
        words = desc
        lines_needed = max(1, int(pdf.get_string_width(words) / (desc_width - 2)) + 1)
        row_height = ROW_H * lines_needed

        y_start = pdf.get_y()

        # ตรวจสอบว่าต้องขึ้นหน้าใหม่หรือไม่
        if y_start + row_height > 250:
            pdf.add_page()
            # วาด header ซ้ำ
            pdf.set_y(20)
            pdf.set_fill_color(240, 240, 240)
            for i, h in enumerate(headers):
                pdf.cell(cols_w[i], 9, h, 1, 0, 'C', True)
            pdf.ln()
            y_start = pdf.get_y()

        x_start = 15

        # วาดเส้นกรอบของแต่ละ cell ก่อน แล้วค่อยใส่ข้อความ
        # คอลัมน์ 0: ลำดับ
        pdf.set_xy(x_start, y_start)
        pdf.cell(cols_w[0], row_height, str(idx + 1), 1, 0, 'C')
        x_start += cols_w[0]

        # คอลัมน์ 1: รายการสินค้า — ใช้ multi_cell พร้อม vertical center
        pdf.set_xy(x_start, y_start)
        # วาดกรอบก่อน
        pdf.rect(x_start, y_start, cols_w[1], row_height)
        # คำนวณ offset แนวตั้งเพื่อให้ข้อความอยู่กึ่งกลาง
        text_block_h = ROW_H * lines_needed
        v_offset = max(0, (row_height - text_block_h) / 2)
        pdf.set_xy(x_start + 1, y_start + v_offset)
        pdf.multi_cell(cols_w[1] - 2, ROW_H, desc, 0, 'L')
        x_start += cols_w[1]

        # คอลัมน์ 2-5: จำนวน, หน่วย, ราคา/หน่วย, จำนวนเงิน
        other_vals = [
            (f"{qty:,.2f}", 'R'),
            (item.get('unit', ''), 'C'),
            (f"{price:,.2f}", 'R'),
            (f"{line_total:,.2f}", 'R'),
        ]
        for j, (txt, align) in enumerate(other_vals):
            pdf.set_xy(x_start, y_start)
            pdf.cell(cols_w[j + 2], row_height, txt, 1, 0, align)
            x_start += cols_w[j + 2]

        pdf.set_y(y_start + row_height)

    # SUMMARY
    summary = payload.get('summary', {})
    current_y = pdf.get_y() + 4
    pdf.set_xy(15, current_y)
    pdf.set_font(use_f, 'b', 13)
    pdf.cell(0, 7, "หมายเหตุ / Remarks:", 0, 1)
    remark = payload.get('remark', '')
    pdf.multi_cell(90, 5, remark, 0, 'L')

    sum_y = current_y
    vat_rate_val = float(payload.get('vat_rate', 7))
    include_vat = payload.get('include_vat', True)
    vat_label = f"ภาษีมูลค่าเพิ่ม {vat_rate_val:g}%:"
    rows = [
        ("รวมเงินสินค้า:", summary.get('gross', 0)),
        ("หักส่วนลด:", summary.get('discount', 0)),
        ("ยอดหลังหักส่วนลด:", summary.get('afterDiscount', 0)),
    ]
    if include_vat:
        rows.append((vat_label, summary.get('vat', 0)))
    for label, val in rows:
        pdf.set_xy(130, sum_y)
        pdf.cell(40, 6, label, 0, 0, 'R')
        pdf.set_xy(170, sum_y)
        pdf.cell(25, 6, f"{float(val):,.2f}", 0, 1, 'R')
        sum_y += 6

    grand = float(summary.get('grandTotal', 0))
    pdf.set_xy(15, sum_y)
    pdf.cell(115, 6, f"({baht_text(grand)})", 0, 0, 'C')
    pdf.set_xy(130, sum_y)
    pdf.cell(40, 6, "ยอดรวมสุทธิ:", 0, 0, 'R')
    pdf.set_xy(170, sum_y)
    pdf.cell(25, 6, f"{grand:,.2f}", 0, 1, 'R')

    # SIGNATURE
    pdf.set_font(use_f, '', 13)

    # ผู้จัดทำ
    y_sig1 = pdf.h - 40
    sig_path = ROOT / "assets" / "signature.png"
    if sig_path.exists():
        pdf.image(str(sig_path), x=42, y=y_sig1 - 12, w=35, h=14.5)
    pdf.set_xy(40, y_sig1)
    pdf.cell(40, 6, "........................................", 0, 1, 'C')
    pdf.set_xy(40, y_sig1 + 6)
    pdf.cell(40, 6, "ผู้จัดทำ", 0, 1, 'C')
    pdf.set_xy(40, y_sig1 + 12)
    pdf.cell(40, 6, "(........................................)", 0, 1, 'C')
    pdf.set_xy(40, y_sig1 + 18)
    pdf.cell(40, 6, "วันที่ ...../...../..........", 0, 1, 'C')

    # ผู้อนุมัติ
    y_sig2 = pdf.h - 40
    pdf.set_xy(130, y_sig2)
    pdf.cell(40, 6, "........................................", 0, 1, 'C')
    pdf.set_xy(130, y_sig2 + 6)
    pdf.cell(40, 6, "ผู้อนุมัติ", 0, 1, 'C')
    pdf.set_xy(130, y_sig2 + 12)
    pdf.cell(40, 6, "(........................................)", 0, 1, 'C')
    pdf.set_xy(130, y_sig2 + 18)
    pdf.cell(40, 6, "วันที่ ...../...../..........", 0, 1, 'C')

    return bytes(pdf.output())


@app.get("/api/config")
def get_config():
    return jsonify({
        "supabaseUrl": os.environ.get("SUPABASE_URL", ""),
        "supabaseAnonKey": os.environ.get("SUPABASE_ANON_KEY", "")
    })


@app.post("/api/quote-summary")
def quote_summary():
    payload = request.get_json(silent=True) or {}
    items = payload.get("items", [])
    extra_discount = _to_decimal(payload.get("extra_discount", 0))
    vat_rate = _to_decimal(payload.get("vat_rate", 7))

    gross = Decimal("0")
    discount = extra_discount

    for item in items:
        qty = _to_decimal(item.get("qty", 0))
        unit_price = _to_decimal(item.get("unit_price", 0))
        item_discount = 0 # Individual item discount removed
        gross += qty * unit_price
        discount += item_discount

    subtotal = gross - discount
    if subtotal < 0:
        subtotal = Decimal("0")
    vat = (subtotal * vat_rate / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    grand_total = (subtotal + vat).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return jsonify(
        {
            "gross": float(gross.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "discount": float(discount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "vat": float(vat),
            "grand_total": float(grand_total),
            "baht_text": baht_text(grand_total),
        }
    )


@app.post("/api/export-pdf")
def export_pdf():
    payload = request.get_json(silent=True) or {}
    pdf_bytes = _build_pdf(payload)
    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=True,
        download_name=f"QT-{payload.get('quote_no', 'export')}.pdf"
    )


@app.post("/api/preview-pdf")
def preview_pdf():
    """คืน PDF เพื่อแสดงใน browser (inline) ไม่ใช่ download"""
    payload = request.get_json(silent=True) or {}
    pdf_bytes = _build_pdf(payload)
    response = send_file(
        io.BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=False,
        download_name=f"preview-{payload.get('quote_no', 'preview')}.pdf"
    )
    response.headers['Content-Disposition'] = 'inline'
    return response


@app.get("/healthz")
def healthz():
    return jsonify({"status": "ok"})


@app.get("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.get("/<path:path>")
def root_files(path):
    return send_from_directory(ROOT, path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000, debug=True)
