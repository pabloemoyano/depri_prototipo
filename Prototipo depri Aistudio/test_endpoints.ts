import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3000";
const SECRET_HEADER = "supersecret-validation-bypass";

async function makeRequest(method: string, endpoint: string, body?: any) {
  const url = `${BASE_URL}${endpoint}`;
  const options: any = {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-bypass-auth": SECRET_HEADER
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const status = res.status;
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // maybe text or empty
  }
  return { status, data };
}

function readDb() {
  const dbPath = path.join(process.cwd(), "db.json");
  if (!fs.existsSync(dbPath)) return null;
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

async function runTests() {
  console.log("=== STARTING FALLBACK ENDPOINT CRUD TESTS ===");

  const auditLogs: any[] = [];

  const logAudit = (step: string, request: any, response: any, dbSnapshot: any) => {
    auditLogs.push({
      step,
      timestamp: new Date().toISOString(),
      request,
      response,
      dbSnapshot
    });
    console.log(`[step] ${step} - Response Status: ${response.status}`);
  };

  // --- 1. PRODUCTS ---
  // Create Product
  const newProductPayload = {
    name: "Refresco Maracuyá Fest",
    category: "refrescos",
    quantity: 120,
    min_quantity: 15,
    purchase_price: 0.60,
    selling_price: 2.10,
    sku: "SKU-MARA-01"
  };
  const prodCreateRes = await makeRequest("POST", "/api/stock", newProductPayload);
  let createdProdId = prodCreateRes.data?.id;
  logAudit("PRODUCT_CREATE", { method: "POST", endpoint: "/api/stock", body: newProductPayload }, prodCreateRes, readDb());

  // Edit Product
  let prodEditRes = { status: 0, data: null };
  if (createdProdId) {
    const editPayload = { name: "Refresco Maracuyá Imperial", selling_price: 2.80 };
    prodEditRes = await makeRequest("PUT", `/api/stock/${createdProdId}`, editPayload);
    logAudit("PRODUCT_EDIT", { method: "PUT", endpoint: `/api/stock/${createdProdId}`, body: editPayload }, prodEditRes, readDb());
  }

  // Delete Product
  let prodDeleteRes = { status: 0, data: null };
  if (createdProdId) {
    prodDeleteRes = await makeRequest("DELETE", `/api/stock/${createdProdId}`);
    logAudit("PRODUCT_DELETE", { method: "DELETE", endpoint: `/api/stock/${createdProdId}` }, prodDeleteRes, readDb());
  }


  // --- 2. CUSTOMERS ---
  // Create Customer
  const newCustomerPayload = {
    name: "Juan Román Val",
    email: "juan@boca.com",
    phone: "654321098"
  };
  const custCreateRes = await makeRequest("POST", "/api/customers", newCustomerPayload);
  let createdCustId = custCreateRes.data?.id;
  logAudit("CUSTOMER_CREATE", { method: "POST", endpoint: "/api/customers", body: newCustomerPayload }, custCreateRes, readDb());

  // Edit Customer
  let custEditRes = { status: 0, data: null };
  if (createdCustId) {
    const editPayload = { phone: "999999999", loyaltyPoints: 150 };
    custEditRes = await makeRequest("PUT", `/api/customers/${createdCustId}`, editPayload);
    logAudit("CUSTOMER_EDIT", { method: "PUT", endpoint: `/api/customers/${createdCustId}`, body: editPayload }, custEditRes, readDb());
  }

  // Delete Customer
  let custDeleteRes = { status: 0, data: null };
  if (createdCustId) {
    custDeleteRes = await makeRequest("DELETE", `/api/customers/${createdCustId}`);
    logAudit("CUSTOMER_DELETE", { method: "DELETE", endpoint: `/api/customers/${createdCustId}` }, custDeleteRes, readDb());
  }


  // --- 3. PROVIDERS ---
  // Create Provider
  const newProviderPayload = {
    name: "Distribuciones Gallegas S.A.",
    contactName: "García-Pérez",
    phone: "981223344",
    is_active: true
  };
  const provCreateRes = await makeRequest("POST", "/api/providers", newProviderPayload);
  let createdProvId = provCreateRes.data?.id;
  logAudit("PROVIDER_CREATE", { method: "POST", endpoint: "/api/providers", body: newProviderPayload }, provCreateRes, readDb());

  // Edit Provider
  let provEditRes = { status: 0, data: null };
  if (createdProvId) {
    const editPayload = { contactName: "Manuel García-Pérez", phone: "981111111" };
    provEditRes = await makeRequest("PUT", `/api/providers/${createdProvId}`, editPayload);
    logAudit("PROVIDER_EDIT", { method: "PUT", endpoint: `/api/providers/${createdProvId}`, body: editPayload }, provEditRes, readDb());
  }

  // Delete Provider
  let provDeleteRes = { status: 0, data: null };
  if (createdProvId) {
    provDeleteRes = await makeRequest("DELETE", `/api/providers/${createdProvId}`);
    logAudit("PROVIDER_DELETE", { method: "DELETE", endpoint: `/api/providers/${createdProvId}` }, provDeleteRes, readDb());
  }


  // --- 4. CLEAR OPERATION ("Eliminar todos los datos") ---
  console.log("Testing complete database clearing...");
  const clearRes = await makeRequest("POST", "/api/db/clear");
  logAudit("DB_CLEAR", { method: "POST", endpoint: "/api/db/clear" }, clearRes, readDb());


  // --- 5. SEED SELECTION ("Cargar datos de prueba") ---
  console.log("Testing demonstration data seeding...");
  const seedRes = await makeRequest("POST", "/api/db/seed");
  logAudit("DB_SEED", { method: "POST", endpoint: "/api/db/seed" }, seedRes, readDb());

  // Dual-seed test to prevent duplicates
  console.log("Testing duplicate seed prevention...");
  const secondSeedRes = await makeRequest("POST", "/api/db/seed");
  logAudit("DB_SEED_BLOCK_DUPLICATES", { method: "POST", endpoint: "/api/db/seed" }, secondSeedRes, readDb());


  // Write audit trail
  fs.writeFileSync(path.join(process.cwd(), "fallback_crud_test_audit_trail.json"), JSON.stringify(auditLogs, null, 2));
  console.log("=== TESTS COMPLETE! AUDIT TRAIL LOGGED ===");
}

runTests().catch(console.error);
