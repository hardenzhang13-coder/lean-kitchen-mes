/* E2E 采购入库段：修正传参（receiptDate=YYYY-MM-DD、items 带 spec） */
const B = "http://localhost:3001";
let cookie = "";
async function api(path, opts = {}) {
  const res = await fetch(B + path, {
    ...opts,
    headers: { "Content-Type": "application/json; charset=utf-8", cookie },
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  return res.json();
}
const log = (k, v) => console.log(k, typeof v === "object" ? JSON.stringify(v) : v);

await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username: "admin", password: "admin123" }) });

const c = await api("/api/ingredients", { method: "POST", body: JSON.stringify({ name: "E2E平包菜", l2Code: "VEG-LEF", purchaseSpec: "5斤/袋", purchaseUnit: "袋", stockUnit: "斤", latestRefPrice: 18.5 }) });
const ingId = c.data?.id;
log("ingredient:", ingId, "pricePerJin:", c.data?.pricePerJin);

// 采购 3 袋 × 5斤/袋 → 入库 15 斤
const receipt = await api("/api/purchase-receipts", {
  method: "POST",
  body: JSON.stringify({
    receiptDate: new Date().toISOString().slice(0, 10),
    summary: "E2E采购规格验证",
    totalAmount: 55.5,
    purchasingUnit: "切配中心",
    items: [{ ingredientId: ingId, itemName: "E2E平包菜", spec: "5斤/袋", qty: 3, purchaseUnit: "袋", unitPrice: 18.5, amount: 55.5, stockUnit: "斤", stockInQty: 15, storage: "常温" }],
  }),
});
log("receipt:", receipt.success, "id:", receipt.data?.id ?? receipt.error);
const receiptId = receipt.data?.id;

const inv = (await api(`/api/inventory?q=E2E`)).data || [];
log("inventory:", JSON.stringify(inv.map((i) => ({ name: i.ingredient?.name ?? i.name, qty: Number(i.currentQty), unit: i.unit }))));

const ledger = (await api(`/api/inventory/ledger?q=E2E`)).data || [];
log("ledger rows:", ledger.length);

const del = await api(`/api/purchase-receipts/${receiptId}`, { method: "DELETE" });
log("void receipt:", del.success ?? del.error);
const invAfter = (await api(`/api/inventory?q=E2E`)).data || [];
log("inventory after void:", JSON.stringify(invAfter.map((i) => ({ qty: Number(i.currentQty), unit: i.unit }))));
await api(`/api/ingredients/${ingId}`, { method: "DELETE" });
log("cleaned");
