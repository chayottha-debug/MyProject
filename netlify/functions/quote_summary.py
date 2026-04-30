import json
from decimal import Decimal, ROUND_HALF_UP


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


def handler(event, context):
    if event.get("httpMethod") != "POST":
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"message": "quote_summary is ready"})
        }

    try:
        payload = json.loads(event.get("body") or "{}")
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

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({
                "gross": float(gross.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                "discount": float(discount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
                "vat": float(vat),
                "grand_total": float(grand_total),
                "baht_text": baht_text(grand_total)
            }, ensure_ascii=False)
        }
    except Exception as exc:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": str(exc)}, ensure_ascii=False)
        }
