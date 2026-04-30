const { createClient } = window.supabase;

const state = {
  supabase: null,
  customers: [],
  products: [],
  quotes: [],
  currentQuoteId: null,
  isSavingQuote: false,
  approverSignatureDataUrl: "",
  quoteSummary: {
    gross: 0,
    discount: 0,
    vat: 0,
    grandTotal: 0,
    bahtText: "ศูนย์บาทถ้วน"
  }
};

const dom = {
  tabs: document.querySelectorAll(".tab"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  connectionStatus: document.getElementById("connectionStatus"),
  toast: document.getElementById("toast"),
  settingsModal: document.getElementById("settingsModal"),
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  supabaseUrlInput: document.getElementById("supabaseUrlInput"),
  supabaseAnonKeyInput: document.getElementById("supabaseAnonKeyInput"),
  customerSelect: document.getElementById("customerSelect"),
  itemsContainer: document.getElementById("itemsContainer"),
  approverSignatureInput: document.getElementById("approverSignatureInput"),
  approverSignaturePreviewWrap: document.getElementById("approverSignaturePreviewWrap"),
  previewPreparedBy: document.getElementById("previewPreparedBy"),
  previewApprovedBy: document.getElementById("previewApprovedBy"),
  previewQuoteNo: document.getElementById("previewQuoteNo"),
  previewQuoteDate: document.getElementById("previewQuoteDate"),
  previewDueDate: document.getElementById("previewDueDate"),
  previewCustomerName: document.getElementById("previewCustomerName"),
  previewCustomerContact: document.getElementById("previewCustomerContact"),
  previewCustomerAddress: document.getElementById("previewCustomerAddress"),
  previewCustomerPhone: document.getElementById("previewCustomerPhone"),
  previewItemsBody: document.getElementById("previewItemsBody"),
  previewSubtotal: document.getElementById("previewSubtotal"),
  previewDiscount: document.getElementById("previewDiscount"),
  previewAfterDiscount: document.getElementById("previewAfterDiscount"),
  previewVat: document.getElementById("previewVat"),
  previewGrandTotal: document.getElementById("previewGrandTotal"),
  previewBahtText: document.getElementById("previewBahtText"),
  previewRemark: document.getElementById("previewRemark"),
  metricQuotes: document.getElementById("metricQuotes"),
  metricCustomers: document.getElementById("metricCustomers"),
  metricProducts: document.getElementById("metricProducts"),
  customersTableBody: document.getElementById("customersTableBody"),
  productsTableBody: document.getElementById("productsTableBody"),
  historyCards: document.getElementById("historyCards"),
  customerSearchInput: document.getElementById("customerSearchInput"),
  productSearchInput: document.getElementById("productSearchInput"),
  historySearchInput: document.getElementById("historySearchInput"),
  pdfPreviewModal: document.getElementById("pdfPreviewModal"),
  pdfPreviewFrame: document.getElementById("pdfPreviewFrame"),
  closePdfPreviewBtn: document.getElementById("closePdfPreviewBtn"),
  confirmExportBtn: document.getElementById("confirmExportBtn")
};

const formIds = [
  "quoteNo",
  "quoteDate",
  "dueDate",
  "quoteStatus",
  "customerName",
  "customerContact",
  "customerAddress",
  "customerPhone",
  "customerEmail",
  "preparedBy",
  "approvedBy",
  "quoteRemark",
  "extraDiscount",
  "vatRate",
  "deliveryTerm",
  "validityTerm"
];

const form = Object.fromEntries(formIds.map((id) => [id, document.getElementById(id)]));

const dbCustomerForm = {
  id: document.getElementById("customerId"),
  code: document.getElementById("dbCustomerCode"),
  name: document.getElementById("dbCustomerName"),
  contact: document.getElementById("dbCustomerContact"),
  phone: document.getElementById("dbCustomerPhone"),
  email: document.getElementById("dbCustomerEmail"),
  address: document.getElementById("dbCustomerAddress")
};

const dbProductForm = {
  id: document.getElementById("productId"),
  code: document.getElementById("dbProductCode"),
  name: document.getElementById("dbProductName"),
  description: document.getElementById("dbProductDescription"),
  unit: document.getElementById("dbProductUnit"),
  price: document.getElementById("dbProductPrice")
};

const currency = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const DEFAULT_QUOTE_REMARK = "1.\u0E41\u0E1A\u0E48\u0E07\u0E0A\u0E33\u0E23\u0E30";

function todayValue() {
  // ใช้ timezone ไทย (Asia/Bangkok, UTC+7)
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
}

function addDays(value, days) {
  // parse value เป็น local date แล้วบวกวัน
  const base = value ? new Date(value + 'T00:00:00') : new Date();
  base.setDate(base.getDate() + days);
  return base.toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
}

function showToast(message, isError = false) {
  dom.toast.textContent = message;
  dom.toast.classList.remove("hidden");
  dom.toast.style.background = isError ? "#a61b1b" : "#172033";
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => dom.toast.classList.add("hidden"), 2600);
}

function setConnectionStatus(connected, message) {
  dom.connectionStatus.textContent = message;
  dom.connectionStatus.classList.toggle("connected", connected);
}

function isQuoteNoDuplicateError(error) {
  if (!error) return false;
  return error.code === "23505"
    || String(error.message || "").includes("quotes_quote_no_key")
    || String(error.details || "").includes("quotes_quote_no_key");
}

function getStoredConfig() {
  const config = window.APP_CONFIG || {};
  return {
    supabaseUrl: localStorage.getItem("supabaseUrl") || config.supabaseUrl || "",
    supabaseAnonKey: localStorage.getItem("supabaseAnonKey") || config.supabaseAnonKey || ""
  };
}

function openSettingsModal() {
  const config = getStoredConfig();
  dom.supabaseUrlInput.value = config.supabaseUrl;
  dom.supabaseAnonKeyInput.value = config.supabaseAnonKey;
  dom.settingsModal.classList.remove("hidden");
}

function closeSettingsModal() {
  dom.settingsModal.classList.add("hidden");
}

function renderCustomerSelect() {
  const selectedValue = dom.customerSelect.value;
  const options = ['<option value="">เลือกลูกค้า</option>']
    .concat(
      state.customers.map((customer) => (
        `<option value="${customer.id}">${escapeHtml(customer.company_name)}${customer.customer_code ? ` (${escapeHtml(customer.customer_code)})` : ""}</option>`
      ))
    );
  dom.customerSelect.innerHTML = options.join("");
  if (selectedValue) {
    dom.customerSelect.value = selectedValue;
  }
}

function renderItemRow(item = {}) {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <select class="item-product">
      <option value="">เลือกสินค้า</option>
      ${state.products.map((product) => `<option value="${product.id}">${escapeHtml(product.product_name)}</option>`).join("")}
    </select>
    <textarea class="item-description" rows="1" placeholder="รายละเอียดสินค้า">${escapeHtml(item.description || "")}</textarea>
    <input class="item-qty" type="number" min="0" step="0.01" value="${item.qty ?? 1}">
    <input class="item-unit" type="text" value="${escapeHtml(item.unit || "")}" placeholder="หน่วย">
    <input class="item-price" type="number" min="0" step="0.01" value="${item.unit_price ?? 0}">
    <input class="item-total" type="text" readonly value="${currency.format(item.line_total ?? 0)}">
    <button type="button" class="icon-button item-remove">×</button>
  `;

  const productSelect = row.querySelector(".item-product");
  const descriptionInput = row.querySelector(".item-description");
  const qtyInput = row.querySelector(".item-qty");
  const unitInput = row.querySelector(".item-unit");
  const priceInput = row.querySelector(".item-price");
  const totalInput = row.querySelector(".item-total");

  if (item.product_id) {
    productSelect.value = item.product_id;
  }

  productSelect.addEventListener("change", () => {
    const product = state.products.find((entry) => String(entry.id) === productSelect.value);
    if (!product) return;
    descriptionInput.value = product.description || product.product_name || "";
    unitInput.value = product.unit || "";
    priceInput.value = Number(product.unit_price || 0);
    updatePreview();
  });

  [descriptionInput, qtyInput, unitInput, priceInput].forEach((input) => {
    input.addEventListener("input", () => {
      const qty = Number(qtyInput.value || 0);
      const price = Number(priceInput.value || 0);
      totalInput.value = currency.format(qty * price);
      updatePreview();
    });
  });

  row.querySelector(".item-remove").addEventListener("click", () => {
    row.remove();
    if (!dom.itemsContainer.children.length) {
      addItemRow();
    }
    updatePreview();
  });

  dom.itemsContainer.appendChild(row);
}

function addItemRow(item) {
  renderItemRow(item);
  updatePreview();
}

function refreshItemRows() {
  const currentItems = getItems();
  dom.itemsContainer.innerHTML = "";
  if (!currentItems.length) {
    addItemRow();
    return;
  }
  currentItems.forEach((item) => renderItemRow(item));
  updatePreview();
}

function getItems() {
  return Array.from(dom.itemsContainer.querySelectorAll(".item-row")).map((row) => {
    const productId = row.querySelector(".item-product").value || null;
    const description = row.querySelector(".item-description").value.trim();
    const qty = Number(row.querySelector(".item-qty").value || 0);
    const unit = row.querySelector(".item-unit").value.trim();
    const unitPrice = Number(row.querySelector(".item-price").value || 0);
    const discount = 0; // Individual item discount removed
    return {
      product_id: productId,
      description,
      qty,
      unit,
      unit_price: unitPrice,
      discount,
      line_total: qty * unitPrice
    };
  }).filter((item) => item.description || item.qty || item.unit_price);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toBahtTextLocal(number) {
  if (!Number.isFinite(number) || number <= 0) {
    return "ศูนย์บาทถ้วน";
  }

  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

  const readNumber = (num) => {
    if (num === 0) return "";
    let text = "";
    const numString = String(num);
    for (let index = 0; index < numString.length; index += 1) {
      const digit = Number(numString[index]);
      const pos = numString.length - index - 1;
      if (digit === 0) continue;
      if (pos === 0 && digit === 1 && numString.length > 1) {
        text += "เอ็ด";
      } else if (pos === 1 && digit === 2) {
        text += "ยี่";
      } else if (pos === 1 && digit === 1) {
        text += "";
      } else {
        text += digits[digit];
      }
      text += positions[pos] || "";
    }
    return text;
  };

  const integerPart = Math.floor(number);
  const satang = Math.round((number - integerPart) * 100);
  let bahtText = "";
  const millions = [];
  let remaining = integerPart;
  while (remaining > 0) {
    millions.unshift(remaining % 1000000);
    remaining = Math.floor(remaining / 1000000);
  }

  millions.forEach((chunk, index) => {
    if (chunk === 0) return;
    bahtText += readNumber(chunk);
    if (index < millions.length - 1) {
      bahtText += "ล้าน";
    }
  });

  bahtText = `${bahtText || "ศูนย์"}บาท`;
  if (satang === 0) {
    return `${bahtText}ถ้วน`;
  }
  return `${bahtText}${readNumber(satang)}สตางค์`;
}

async function calculateSummary(items, extraDiscount, vatRate) {
  const fallback = (() => {
    const gross = items.reduce((sum, item) => sum + (item.qty * item.unit_price), 0);
    const lineDiscount = items.reduce((sum, item) => sum + item.discount, 0);
    const discount = lineDiscount + extraDiscount;
    const subtotal = Math.max(gross - discount, 0);
    const vat = subtotal * (vatRate / 100);
    const grandTotal = subtotal + vat;
    return {
      gross,
      discount,
      vat,
      grandTotal,
      bahtText: toBahtTextLocal(grandTotal)
    };
  })();

  const endpoints = ["/api/quote-summary", "/.netlify/functions/quote_summary"];

  try {
    for (const endpoint of endpoints) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, extra_discount: extraDiscount, vat_rate: vatRate })
      });

      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      return {
        gross: Number(payload.gross || 0),
        discount: Number(payload.discount || 0),
        vat: Number(payload.vat || 0),
        grandTotal: Number(payload.grand_total || 0),
        bahtText: payload.baht_text || fallback.bahtText
      };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

async function updatePreview() {
  const items = getItems();
  const extraDiscount = Number(form.extraDiscount.value || 0);
  const includeVatChecked = document.getElementById('includeVat').checked;
  const vatRate = includeVatChecked ? Number(form.vatRate.value || 0) : 0;
  state.quoteSummary = await calculateSummary(items, extraDiscount, vatRate);

  dom.previewQuoteNo.textContent = form.quoteNo.value || "-";
  dom.previewQuoteDate.textContent = form.quoteDate.value || "-";
  dom.previewDueDate.textContent = form.dueDate.value || "-";
  document.getElementById("previewDeliveryTerm").textContent = form.deliveryTerm.value || "-";
  document.getElementById("previewValidityTerm").textContent = form.validityTerm.value || "-";
  dom.previewCustomerName.textContent = form.customerName.value || "-";
  dom.previewCustomerContact.textContent = form.customerContact.value || "-";
  dom.previewCustomerAddress.textContent = form.customerAddress.value || "-";
  dom.previewCustomerPhone.textContent = form.customerPhone.value || "-";
  dom.previewPreparedBy.textContent = form.preparedBy.value || "ผู้จัดทำเอกสาร";
  dom.previewApprovedBy.textContent = form.approvedBy.value || "-";

  dom.previewItemsBody.innerHTML = items.length
    ? items.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>${currency.format(item.qty)}</td>
        <td>${escapeHtml(item.unit || "-")}</td>
        <td>${currency.format(item.unit_price)}</td>
        <td>${currency.format(item.line_total)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="6" class="muted">ยังไม่มีรายการสินค้า</td></tr>`;

  const afterDiscount = Math.max(state.quoteSummary.gross - state.quoteSummary.discount, 0);
  dom.previewSubtotal.textContent = currency.format(state.quoteSummary.gross);
  dom.previewDiscount.textContent = currency.format(state.quoteSummary.discount);
  dom.previewAfterDiscount.textContent = currency.format(afterDiscount);
  const vatRow = document.getElementById('previewVatRow');
  const vatLabelEl = document.getElementById('previewVatLabel');
  if (vatRow) vatRow.style.display = includeVatChecked ? '' : 'none';
  if (vatLabelEl) vatLabelEl.textContent = `ภาษีมูลค่าเพิ่ม ${Number(form.vatRate.value || 0)}%:`;
  dom.previewVat.textContent = currency.format(state.quoteSummary.vat);
  dom.previewGrandTotal.textContent = currency.format(state.quoteSummary.grandTotal);
  dom.previewBahtText.textContent = state.quoteSummary.bahtText;

  const remarkText = form.quoteRemark.value.trim();
  if (remarkText) {
    const remarkLines = remarkText.split("\n").map((line) => line.trim()).filter(Boolean);
    dom.previewRemark.innerHTML = `<ol>${remarkLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ol>`;
  } else {
    dom.previewRemark.innerHTML = "";
  }
}

let _generatingQuoteNo = false;
async function generateQuoteNo() {
  // ป้องกัน race condition เมื่อเรียกซ้ำอย่างรวดเร็ว
  while (_generatingQuoteNo) {
    await new Promise(r => setTimeout(r, 50));
  }
  _generatingQuoteNo = true;
  try {
    const prefix = `QT-${todayValue().replaceAll("-", "")}`;
    if (!state.supabase) {
      return `${prefix}-001`;
    }
    const { data, error } = await state.supabase
      .from("quotes")
      .select("quote_no")
      .ilike("quote_no", `${prefix}%`)
      .order("quote_no", { ascending: false })
      .limit(1);
    if (error || !data?.length) {
      return `${prefix}-001`;
    }
    const lastQuoteNo = data[0].quote_no;
    const lastIndex = Number(lastQuoteNo.split("-").pop() || 0);
    return `${prefix}-${String(lastIndex + 1).padStart(3, "0")}`;
  } finally {
    _generatingQuoteNo = false;
  }
}

function fillCustomerForm(customer) {
  form.customerName.value = customer.company_name || "";
  form.customerContact.value = customer.contact_name || "";
  form.customerAddress.value = customer.address || "";
  form.customerPhone.value = customer.phone || "";
  form.customerEmail.value = customer.email || "";
  updatePreview();
}

function populateCustomerDbForm(customer) {
  dbCustomerForm.id.value = customer.id;
  dbCustomerForm.code.value = customer.customer_code || "";
  dbCustomerForm.name.value = customer.company_name || "";
  dbCustomerForm.contact.value = customer.contact_name || "";
  dbCustomerForm.phone.value = customer.phone || "";
  dbCustomerForm.email.value = customer.email || "";
  dbCustomerForm.address.value = customer.address || "";
}

function populateProductDbForm(product) {
  dbProductForm.id.value = product.id;
  dbProductForm.code.value = product.product_code || "";
  dbProductForm.name.value = product.product_name || "";
  dbProductForm.description.value = product.description || "";
  dbProductForm.unit.value = product.unit || "";
  dbProductForm.price.value = product.unit_price || "";
}

function clearCustomerDbForm() {
  Object.values(dbCustomerForm).forEach((input) => { input.value = ""; });
}

function clearProductDbForm() {
  Object.values(dbProductForm).forEach((input) => { input.value = ""; });
}

function renderCustomersTable() {
  const keyword = dom.customerSearchInput.value.trim().toLowerCase();
  const records = state.customers.filter((customer) => {
    const haystack = `${customer.customer_code || ""} ${customer.company_name || ""} ${customer.contact_name || ""} ${customer.phone || ""}`.toLowerCase();
    return haystack.includes(keyword);
  });

  dom.customersTableBody.innerHTML = records.length
    ? records.map((customer) => `
      <tr>
        <td>${escapeHtml(customer.customer_code || "-")}</td>
        <td>${escapeHtml(customer.company_name || "-")}</td>
        <td>${escapeHtml(customer.contact_name || "-")}</td>
        <td>${escapeHtml(customer.phone || "-")}</td>
        <td>${escapeHtml(customer.email || "-")}</td>
        <td>
          <div class="table-toolbar">
            <button class="ghost-button" type="button" data-action="edit-customer" data-id="${customer.id}">แก้ไข</button>
            <button class="ghost-button" type="button" data-action="delete-customer" data-id="${customer.id}">ลบ</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="6" class="muted">ยังไม่มีข้อมูลลูกค้า</td></tr>`;
}

function renderProductsTable() {
  const keyword = dom.productSearchInput.value.trim().toLowerCase();
  const records = state.products.filter((product) => {
    const haystack = `${product.product_code || ""} ${product.product_name || ""} ${product.description || ""} ${product.unit || ""}`.toLowerCase();
    return haystack.includes(keyword);
  });

  dom.productsTableBody.innerHTML = records.length
    ? records.map((product) => `
      <tr>
        <td>${escapeHtml(product.product_code || "-")}</td>
        <td>${escapeHtml(product.product_name || "-")}</td>
        <td>${escapeHtml(product.unit || "-")}</td>
        <td>${currency.format(Number(product.unit_price || 0))}</td>
        <td>
          <div class="table-toolbar">
            <button class="ghost-button" type="button" data-action="edit-product" data-id="${product.id}">แก้ไข</button>
            <button class="ghost-button" type="button" data-action="delete-product" data-id="${product.id}">ลบ</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="5" class="muted">ยังไม่มีข้อมูลสินค้า</td></tr>`;
}

function renderHistory() {
  const keyword = dom.historySearchInput.value.trim().toLowerCase();
  const records = state.quotes.filter((quote) => {
    const haystack = `${quote.quote_no || ""} ${quote.customer_snapshot?.company_name || ""}`.toLowerCase();
    return haystack.includes(keyword);
  });

  dom.historyCards.innerHTML = records.length
    ? records.map((quote) => `
      <article class="history-card">
        <p class="eyebrow accent">${escapeHtml(quote.status || "draft")}</p>
        <h4>${escapeHtml(quote.quote_no || "-")}</h4>
        <p>${escapeHtml(quote.customer_snapshot?.company_name || "-")}</p>
        <p>วันที่: ${escapeHtml(quote.quote_date || "-")}</p>
        <p>ยอดรวม: ${currency.format(Number(quote.grand_total || 0))} บาท</p>
        <div class="history-actions">
          <button class="ghost-button" type="button" data-action="load-quote" data-id="${quote.id}">เปิด</button>
          <button class="ghost-button" type="button" data-action="delete-quote" data-id="${quote.id}">ลบ</button>
        </div>
      </article>
    `).join("")
    : `<p class="muted">ยังไม่มีประวัติใบเสนอราคา</p>`;
}

function refreshMetrics() {
  dom.metricQuotes.textContent = state.quotes.length;
  dom.metricCustomers.textContent = state.customers.length;
  dom.metricProducts.textContent = state.products.length;
}

async function loadAllData() {
  if (!state.supabase) return;

  const [{ data: customers, error: customerError }, { data: products, error: productError }, { data: quotes, error: quoteError }] = await Promise.all([
    state.supabase.from("customers").select("*").order("created_at", { ascending: false }),
    state.supabase.from("products").select("*").order("created_at", { ascending: false }),
    state.supabase.from("quotes").select("*").order("created_at", { ascending: false })
  ]);

  if (customerError || productError || quoteError) {
    showToast("โหลดข้อมูลจาก Supabase ไม่สำเร็จ", true);
    return;
  }

  state.customers = customers || [];
  state.products = products || [];
  state.quotes = quotes || [];

  renderCustomerSelect();
  refreshItemRows();
  renderCustomersTable();
  renderProductsTable();
  renderHistory();
  refreshMetrics();
}

async function initSupabase() {
  const config = getStoredConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    setConnectionStatus(false, "ยังไม่เชื่อมต่อ Supabase");
    openSettingsModal();
    return;
  }

  try {
    state.supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { error } = await state.supabase.from("customers").select("id").limit(1);
    if (error) throw error;
    setConnectionStatus(true, "เชื่อมต่อ Supabase สำเร็จ");
    await loadAllData();
    // generate เลขที่เอกสารใหม่เสมอหลัง Supabase พร้อม (ป้องกันเลขซ้ำหลัง refresh)
    form.quoteNo.value = await generateQuoteNo();
    updatePreview();
  } catch (error) {
    console.error(error);
    state.supabase = null;
    setConnectionStatus(false, "เชื่อมต่อไม่สำเร็จ กรุณาตรวจสอบค่า");
    showToast("Supabase URL หรือ Anon Key ไม่ถูกต้อง", true);
    openSettingsModal();
  }
}

async function saveQuote() {
  if (state.isSavingQuote) {
    showToast("ระบบกำลังบันทึกใบเสนอราคา กรุณารอสักครู่");
    return;
  }

  if (!state.supabase) {
    showToast("กรุณาตั้งค่า Supabase ก่อนบันทึกข้อมูล", true);
    return;
  }

  const items = getItems();
  if (!form.customerName.value.trim()) {
    showToast("กรุณาระบุชื่อลูกค้า", true);
    return;
  }
  if (!items.length) {
    showToast("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ", true);
    return;
  }

  if (!state.currentQuoteId) {
    form.quoteNo.value = await generateQuoteNo();
    dom.previewQuoteNo.textContent = form.quoteNo.value;
  }

  const payload = {
    quote_no: form.quoteNo.value,
    quote_date: form.quoteDate.value,
    due_date: form.dueDate.value,
    status: form.quoteStatus.value,
    customer_id: dom.customerSelect.value || null,
    customer_snapshot: {
      company_name: form.customerName.value.trim(),
      contact_name: form.customerContact.value.trim(),
      address: form.customerAddress.value.trim(),
      phone: form.customerPhone.value.trim(),
      email: form.customerEmail.value.trim()
    },
    items,
    remark: form.quoteRemark.value.trim(),
    delivery_term: form.deliveryTerm.value.trim(),
    validity_term: form.validityTerm.value.trim(),
    prepared_by: form.preparedBy.value.trim(),
    approved_by: form.approvedBy.value.trim(),
    approver_signature_data_url: state.approverSignatureDataUrl || null,
    subtotal: state.quoteSummary.gross,
    discount_total: state.quoteSummary.discount,
    vat_total: state.quoteSummary.vat,
    grand_total: state.quoteSummary.grandTotal,
    vat_rate: Number(form.vatRate.value || 0),
    extra_discount: Number(form.extraDiscount.value || 0),
    updated_at: new Date().toISOString()
  };

  state.isSavingQuote = true;
  let response;
  if (state.currentQuoteId) {
    response = await state.supabase.from("quotes").update(payload).eq("id", state.currentQuoteId).select().single();
  } else {
    response = await state.supabase.from("quotes").insert(payload).select().single();
  }

  if (response.error) {
    state.isSavingQuote = false;
    if (!state.currentQuoteId && isQuoteNoDuplicateError(response.error)) {
      form.quoteNo.value = await generateQuoteNo();
      dom.previewQuoteNo.textContent = form.quoteNo.value;
      showToast("เลขที่เอกสารถูกใช้งานไปแล้ว ระบบสร้างเลขใหม่ให้แล้ว กรุณากดบันทึกอีกครั้ง", true);
      return;
    }
    showToast(`บันทึกใบเสนอราคาไม่สำเร็จ: ${response.error.message}`, true);
    return;
  }

  state.currentQuoteId = response.data.id;
  state.isSavingQuote = false;
  showToast("บันทึกใบเสนอราคาเรียบร้อย");
  await loadAllData();
}

async function saveCustomer() {
  if (!state.supabase) {
    showToast("กรุณาตั้งค่า Supabase ก่อน", true);
    return;
  }
  if (!dbCustomerForm.name.value.trim()) {
    showToast("กรุณากรอกชื่อบริษัท", true);
    return;
  }

  const payload = {
    customer_code: dbCustomerForm.code.value.trim(),
    company_name: dbCustomerForm.name.value.trim(),
    contact_name: dbCustomerForm.contact.value.trim(),
    phone: dbCustomerForm.phone.value.trim(),
    email: dbCustomerForm.email.value.trim(),
    address: dbCustomerForm.address.value.trim()
  };

  const query = dbCustomerForm.id.value
    ? state.supabase.from("customers").update(payload).eq("id", dbCustomerForm.id.value)
    : state.supabase.from("customers").insert(payload);

  const { error } = await query;
  if (error) {
    showToast(`บันทึกลูกค้าไม่สำเร็จ: ${error.message}`, true);
    return;
  }

  clearCustomerDbForm();
  await loadAllData();
  showToast("บันทึกลูกค้าเรียบร้อย");
}

async function saveProduct() {
  if (!state.supabase) {
    showToast("กรุณาตั้งค่า Supabase ก่อน", true);
    return;
  }
  if (!dbProductForm.name.value.trim()) {
    showToast("กรุณากรอกชื่อสินค้า", true);
    return;
  }

  const payload = {
    product_code: dbProductForm.code.value.trim(),
    product_name: dbProductForm.name.value.trim(),
    description: dbProductForm.description.value.trim(),
    unit: dbProductForm.unit.value.trim(),
    unit_price: Number(dbProductForm.price.value || 0)
  };

  const query = dbProductForm.id.value
    ? state.supabase.from("products").update(payload).eq("id", dbProductForm.id.value)
    : state.supabase.from("products").insert(payload);

  const { error } = await query;
  if (error) {
    showToast(`บันทึกสินค้าไม่สำเร็จ: ${error.message}`, true);
    return;
  }

  clearProductDbForm();
  await loadAllData();
  dom.itemsContainer.innerHTML = "";
  addItemRow();
  showToast("บันทึกสินค้าเรียบร้อย");
}

function hydrateQuote(quote) {
  state.currentQuoteId = quote.id;
  form.quoteNo.value = quote.quote_no || "";
  form.quoteDate.value = quote.quote_date || todayValue();
  form.dueDate.value = quote.due_date || addDays(todayValue(), 7);
  form.quoteStatus.value = quote.status || "draft";
  form.customerName.value = quote.customer_snapshot?.company_name || "";
  form.customerContact.value = quote.customer_snapshot?.contact_name || "";
  form.customerAddress.value = quote.customer_snapshot?.address || "";
  form.customerPhone.value = quote.customer_snapshot?.phone || "";
  form.customerEmail.value = quote.customer_snapshot?.email || "";
  form.preparedBy.value = quote.prepared_by || "ผู้จัดทำเอกสาร";
  form.approvedBy.value = quote.approved_by || "";
  form.quoteRemark.value = quote.remark || DEFAULT_QUOTE_REMARK;
  form.extraDiscount.value = quote.extra_discount || 0;
  form.vatRate.value = quote.vat_rate || 7;
  form.deliveryTerm.value = quote.delivery_term ?? "ภายใน 7-15 วัน";
  form.validityTerm.value = quote.validity_term ?? "30 วัน";
  state.approverSignatureDataUrl = quote.approver_signature_data_url || "";

  dom.customerSelect.value = quote.customer_id || "";
  dom.itemsContainer.innerHTML = "";
  (quote.items || []).forEach((item) => addItemRow(item));
  if (!quote.items?.length) addItemRow();
  renderApproverSignature();
  updatePreview();
}

function renderApproverSignature() {
  if (state.approverSignatureDataUrl) {
    dom.approverSignaturePreviewWrap.innerHTML = `<img src="${state.approverSignatureDataUrl}" alt="ลายเซ็นผู้อนุมัติ">`;
  } else {
    dom.approverSignaturePreviewWrap.innerHTML = `<span class="signature-placeholder">รออัปโหลดลายเซ็นผู้อนุมัติ</span>`;
  }
}

async function handleTableActions(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const { action, id } = button.dataset;
  if (action === "edit-customer") {
    const customer = state.customers.find((entry) => String(entry.id) === id);
    if (customer) populateCustomerDbForm(customer);
  }
  if (action === "delete-customer" && state.supabase && window.confirm("ลบลูกค้ารายการนี้หรือไม่")) {
    await state.supabase.from("customers").delete().eq("id", id);
    await loadAllData();
  }
  if (action === "edit-product") {
    const product = state.products.find((entry) => String(entry.id) === id);
    if (product) populateProductDbForm(product);
  }
  if (action === "delete-product" && state.supabase && window.confirm("ลบสินค้ารายการนี้หรือไม่")) {
    await state.supabase.from("products").delete().eq("id", id);
    await loadAllData();
  }
  if (action === "load-quote") {
    const quote = state.quotes.find((entry) => String(entry.id) === id);
    if (quote) {
      hydrateQuote(quote);
      activateTab("quotes");
      showToast(`เปิดเอกสาร ${quote.quote_no}`);
    }
  }
  if (action === "delete-quote" && state.supabase && window.confirm("ลบใบเสนอราคานี้หรือไม่")) {
    await state.supabase.from("quotes").delete().eq("id", id);
    await loadAllData();
    showToast("ลบเอกสารเรียบร้อย");
  }
}

function activateTab(name) {
  dom.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  dom.tabPanels.forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${name}`));
}

async function resetQuoteForm() {
  state.currentQuoteId = null;
  state.approverSignatureDataUrl = "";
  dom.customerSelect.value = "";
  form.quoteNo.value = await generateQuoteNo();
  form.quoteDate.value = todayValue();
  form.dueDate.value = addDays(todayValue(), 7);
  form.quoteStatus.value = "draft";
  form.customerName.value = "";
  form.customerContact.value = "";
  form.customerAddress.value = "";
  form.customerPhone.value = "";
  form.customerEmail.value = "";
  form.preparedBy.value = "ผู้จัดทำเอกสาร";
  form.approvedBy.value = "";
  form.quoteRemark.value = DEFAULT_QUOTE_REMARK;
  form.extraDiscount.value = 0;
  form.vatRate.value = 7;
  form.deliveryTerm.value = "ภายใน 7-15 วัน";
  form.validityTerm.value = "30 วัน";
  dom.itemsContainer.innerHTML = "";
  addItemRow();
  renderApproverSignature();
  updatePreview();
}

async function duplicateQuote() {
  state.currentQuoteId = null;
  form.quoteNo.value = await generateQuoteNo();
  form.quoteStatus.value = "draft";
  showToast("สร้างสำเนาเอกสารแล้ว");
  updatePreview();
}

function bindEvents() {
  dom.tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.dataset.tab));
  });

  dom.openSettingsBtn.addEventListener("click", openSettingsModal);
  dom.closeSettingsBtn.addEventListener("click", closeSettingsModal);
  dom.saveSettingsBtn.addEventListener("click", async () => {
    localStorage.setItem("supabaseUrl", dom.supabaseUrlInput.value.trim());
    localStorage.setItem("supabaseAnonKey", dom.supabaseAnonKeyInput.value.trim());
    closeSettingsModal();
    await initSupabase();
  });

  document.getElementById("addItemBtn").addEventListener("click", () => addItemRow());
  document.getElementById("saveQuoteBtn").addEventListener("click", saveQuote);
  document.getElementById("saveCustomerBtn").addEventListener("click", saveCustomer);
  document.getElementById("saveProductBtn").addEventListener("click", saveProduct);
  document.getElementById("newQuoteBtn").addEventListener("click", resetQuoteForm);
  document.getElementById("duplicateQuoteBtn").addEventListener("click", duplicateQuote);
  document.getElementById("printQuoteBtn").addEventListener("click", async () => {
    await exportPDF();
  });
  document.getElementById("previewPdfBtn").addEventListener("click", async () => {
    await openPdfPreview();
  });
  dom.closePdfPreviewBtn.addEventListener("click", () => {
    dom.pdfPreviewModal.classList.add('hidden');
    if (state._previewBlobUrl) {
      URL.revokeObjectURL(state._previewBlobUrl);
      state._previewBlobUrl = null;
    }
    dom.pdfPreviewFrame.src = '';
  });
  dom.confirmExportBtn.addEventListener("click", async () => {
    dom.pdfPreviewModal.classList.add('hidden');
    if (state._previewBlobUrl) {
      URL.revokeObjectURL(state._previewBlobUrl);
      state._previewBlobUrl = null;
    }
    dom.pdfPreviewFrame.src = '';
    await exportPDF();
  });
  document.getElementById("clearCustomerFormBtn").addEventListener("click", clearCustomerDbForm);
  document.getElementById("clearProductFormBtn").addEventListener("click", clearProductDbForm);

  dom.customerSelect.addEventListener("change", () => {
    const customer = state.customers.find((entry) => String(entry.id) === dom.customerSelect.value);
    if (customer) fillCustomerForm(customer);
  });

  dom.approverSignatureInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    state.approverSignatureDataUrl = await fileToDataUrl(file);
    renderApproverSignature();
    updatePreview();
  });

  [
    form.quoteDate,
    form.dueDate,
    form.customerName,
    form.customerContact,
    form.customerAddress,
    form.customerPhone,
    form.customerEmail,
    form.preparedBy,
    form.approvedBy,
    form.quoteRemark,
    form.extraDiscount,
    form.vatRate,
    form.deliveryTerm,
    form.validityTerm
  ].forEach((element) => element.addEventListener("input", updatePreview));
  document.getElementById('includeVat').addEventListener('change', updatePreview);

  dom.customersTableBody.addEventListener("click", handleTableActions);
  dom.productsTableBody.addEventListener("click", handleTableActions);
  dom.historyCards.addEventListener("click", handleTableActions);

  dom.customerSearchInput.addEventListener("input", renderCustomersTable);
  dom.productSearchInput.addEventListener("input", renderProductsTable);
  dom.historySearchInput.addEventListener("input", renderHistory);
}

function buildPdfPayload() {
  const items = getItems();
  const quoteNo = form.quoteNo.value || 'export';
  return {
    quote_no: quoteNo,
    quote_date: form.quoteDate.value,
    due_date: form.dueDate.value,
    customer_name: form.customerName.value,
    customer_contact: form.customerContact.value,
    customer_address: form.customerAddress.value,
    customer_phone: form.customerPhone.value,
    remark: form.quoteRemark.value,
    delivery_term: form.deliveryTerm.value,
    validity_term: form.validityTerm.value,
    vat_rate: Number(form.vatRate.value || 0),
    include_vat: document.getElementById('includeVat').checked,
    items,
    summary: {
      gross: state.quoteSummary.gross,
      discount: state.quoteSummary.discount,
      afterDiscount: Math.max(state.quoteSummary.gross - state.quoteSummary.discount, 0),
      vat: state.quoteSummary.vat,
      grandTotal: state.quoteSummary.grandTotal,
    }
  };
}

async function exportPDF() {
  await updatePreview();
  const payload = buildPdfPayload();
  const quoteNo = payload.quote_no;

  try {
    showToast('กำลังสร้าง PDF...');
    const response = await fetch('/api/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Server error');

    const blob = await response.blob();
    const fileName = `QT-${quoteNo}.pdf`;

    // ใช้ showSaveFilePicker ถ้า browser รองรับ (เลือกโฟลเดอร์เองได้)
    if (window.showSaveFilePicker) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: 'PDF Document', accept: { 'application/pdf': ['.pdf'] } }]
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        showToast('บันทึก PDF เรียบร้อย');
        return;
      } catch (pickerErr) {
        if (pickerErr.name === 'AbortError') return;
        // ประเภทอื่นๆ ให้ fallback
      }
    }

    // Fallback: download ปกติ
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showToast('Export PDF ไม่สำเร็จ: ' + err.message, true);
  }
}

async function openPdfPreview() {
  await updatePreview();
  const payload = buildPdfPayload();

  try {
    showToast('กำลังโหลด PDF พรีวิว...');
    const response = await fetch('/api/preview-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Server error');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    dom.pdfPreviewFrame.src = url;
    dom.pdfPreviewModal.classList.remove('hidden');

    state._previewPayload = payload;
    state._previewBlobUrl = url;
  } catch (err) {
    showToast('โหลด PDF Preview ไม่สำเร็จ: ' + err.message, true);
  }
}


async function main() {
  bindEvents();
  // เตรียมฟอร์มเปล่าก่อน (ยังไม่ generate เลขที่เอกสาร)
  state.currentQuoteId = null;
  state.approverSignatureDataUrl = "";
  dom.customerSelect.value = "";
  form.quoteDate.value = todayValue();
  form.dueDate.value = addDays(todayValue(), 7);
  form.quoteStatus.value = "draft";
  form.customerName.value = "";
  form.customerContact.value = "";
  form.customerAddress.value = "";
  form.customerPhone.value = "";
  form.customerEmail.value = "";
  form.preparedBy.value = "ผู้จัดทำเอกสาร";
  form.approvedBy.value = "";
  form.quoteRemark.value = DEFAULT_QUOTE_REMARK;
  form.extraDiscount.value = 0;
  form.vatRate.value = 7;
  form.deliveryTerm.value = "ภายใน 7-15 วัน";
  form.validityTerm.value = "30 วัน";
  dom.itemsContainer.innerHTML = "";
  addItemRow();
  renderApproverSignature();
  // initSupabase จะ generate เลขที่เอกสารหลัง Supabase เชื่อมต่อสำเร็จ
  await initSupabase();
}

if (window.APP_CONFIG && (window.APP_CONFIG.supabaseUrl || localStorage.getItem('supabaseUrl'))) {
  main();
} else {
  window.addEventListener('appConfigReady', () => main(), { once: true });
}
