import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

// Define same constants as server
const COL = {
  STOCK: "stock",
  SALES: "sales",
  CUSTOMERS: "customers",
  PROVIDERS: "providers",
  EVENTS: "events",
  TABLES: "tables",
  PURCHASES: "purchases",
  INVENTORY_MOVEMENTS: "inventory_movements",
  PRESENTATIONS: "presentations",
  CAJA_ACTIVE: "caja_active",
  CAJA_HISTORY: "caja_history",
  CAJA_TARIFAS: "caja_tarifas",
  AUDITS: "audits"
};

async function main() {
  console.log("Analyzing Database for audits on 2026-06-15...");
  const report: any = {
    mode: "unknown",
    auditsFound: [],
    movementsFound: [],
    removedStockSimulated: {}
  };

  let db: any = null;
  let usingFirestore = false;

  // Initialize Admin
  try {
    if (firebaseConfig.projectId) {
      process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
      process.env.GCLOUD_PROJECT = firebaseConfig.projectId;
    }

    let credential: any = admin.credential.applicationDefault();

    const saKeyEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    let explicitProjectId: string | null = null;
    if (saKeyEnv) {
      const saKeyJson = JSON.parse(saKeyEnv);
      credential = admin.credential.cert(saKeyJson);
      explicitProjectId = saKeyJson.project_id;
    }

    const app = admin.initializeApp({
      projectId: explicitProjectId || firebaseConfig.projectId,
      credential
    }, "diagnostic_app");

    const databaseIdToUse = explicitProjectId ? "(default)" : firebaseConfig.firestoreDatabaseId;
    const testDb = getFirestore(app, databaseIdToUse);
    // Test connectivity
    await testDb.collection(COL.STOCK).limit(1).get();
    db = testDb;
    usingFirestore = true;
    report.mode = "firestore";
    console.log("Connected to live Firestore. Querying collections...");
  } catch (err: any) {
    console.log("Firestore fallback triggered, inspecting db.json... Reason:", err.message);
    report.mode = "local_db_json";
  }

  // Define helpers to fetch all records
  let allAudits: any[] = [];
  let allMovements: any[] = [];
  let allStock: any[] = [];

  if (usingFirestore) {
    const auditsSnap = await db.collection(COL.AUDITS).get();
    allAudits = auditsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    const movesSnap = await db.collection(COL.INVENTORY_MOVEMENTS).get();
    allMovements = movesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    const stockSnap = await db.collection(COL.STOCK).get();
    allStock = stockSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  } else {
    // Read from local db.json
    const dbPath = path.join(process.cwd(), "db.json");
    if (fs.existsSync(dbPath)) {
      const fileData = JSON.parse(fs.readFileSync(dbPath, "utf8"));
      allAudits = fileData.audits || [];
      allMovements = fileData.inventory_movements || [];
      allStock = fileData.stock || [];
    }
  }

  console.log(`Total audits in database: ${allAudits.length}`);
  console.log(`Total movements in database: ${allMovements.length}`);
  console.log(`Total items in stock: ${allStock.length}`);

  // June 15, 2026 Audits search
  // Target date string starting with 2026-06-15 (or contains 15/06/2026 / 15-06-2026)
  const isTargetDate = (dateStr: string) => {
    if (!dateStr) return false;
    return dateStr.startsWith("2026-06-15") || dateStr.includes("2026-06-15") || dateStr.includes("15/06/2026") || dateStr.includes("15-06-2026");
  };

  const targetAudits = allAudits.filter((aud: any) => isTargetDate(aud.date));
  targetAudits.sort((a, b) => b.date.localeCompare(a.date)); // Sort newest first

  report.auditsFound = targetAudits.map((aud: any) => {
    // Number of items adjusted inside the audits
    const adjustedCount = aud.items ? aud.items.length : 0;
    return {
      id: aud.id,
      date: aud.date,
      responsible: aud.responsible,
      adjustedCount,
      adjustmentCost: aud.adjustmentCost || 0,
      adjustmentSales: aud.adjustmentSales || 0,
      note: aud.note || aud.reason || ""
    };
  });

  // Collect audits IDs
  const targetAuditIds = new Set(targetAudits.map((aud: any) => aud.id));

  // Find all movements associated
  const targetMovements = allMovements.filter((mov: any) => {
    // Checks if direct auditId match
    if (mov.auditId && targetAuditIds.has(mov.auditId)) {
      return true;
    }
    // Also, as fallback from server code: documentId could be `Auditoría ${auditId}`
    if (mov.documentId && mov.documentId.startsWith("Auditoría ")) {
      const matchId = mov.documentId.replace("Auditoría ", "").trim();
      if (targetAuditIds.has(matchId)) {
        return true;
      }
    }
    // Check if movement was created today, has type "AJUSTE", and references one of the audit IDs in description/doc ID
    if (isTargetDate(mov.date || mov.created_at) && mov.type === "AJUSTE") {
      // Just in case
      return true;
    }
    return false;
  });

  report.movementsFound = targetMovements.map((mov: any) => ({
    id: mov.id,
    auditId: mov.auditId || (mov.documentId && mov.documentId.startsWith("Auditoría ") ? mov.documentId.replace("Auditoría ", "").trim() : "unknown"),
    itemId: mov.itemId || mov.stock_item_id || mov.productId,
    quantity: mov.quantity || mov.qty || 0, // This is the difference adjusted (e.g. diff = real - theoretical)
    type: mov.type,
    documentId: mov.documentId,
    operator: mov.operator || mov.responsible,
    date: mov.date || mov.created_at
  }));

  // Group movements helper
  const itemMap = new Map<string, string>(); // itemId -> itemName
  allStock.forEach((st: any) => {
    itemMap.set(st.id, st.name || st.nombre || "Unknown Product");
  });

  // Simulation: We calculate current stock map and mock how stock changes when these movements are reverted.
  // When an audit adjustment is done, stock is set to Real Stock.
  // Reverting/deleting an audit means we reverse the stock adjustment.
  // If an adjustment added +5 to stock (Real was 15, Theoretical was 10), reverting the adjustment means subtracting +5 (back to 10).
  // So: Reverted Stock = Current Stock - Movement.quantity
  const stockSim: any = {};
  allStock.forEach((st: any) => {
    stockSim[st.id] = {
      name: st.name || "Unknown Product",
      currentStock: st.quantity !== undefined ? st.quantity : (st.stock !== undefined ? st.stock : 0),
      simulatedChange: 0,
      finalStock: 0
    };
  });

  targetMovements.forEach((mov: any) => {
    const itemId = mov.itemId || mov.stock_item_id;
    if (itemId && stockSim[itemId]) {
      // If movement adjusted by `qty` (e.g. real - theoretical), that `qty` was added to the stock.
      // E.g. diff is +2, stock went up by 2. To revert, we must subtract +2.
      // So Simulated Reversion Change = -qty
      stockSim[itemId].simulatedChange -= (mov.quantity || 0);
    }
  });

  Object.keys(stockSim).forEach((key) => {
    stockSim[key].finalStock = stockSim[key].currentStock + stockSim[key].simulatedChange;
  });

  // Filter out products with 0 simulated change for cleaner simulation report
  const affectedProductsSim: any = {};
  Object.keys(stockSim).forEach((key) => {
    if (stockSim[key].simulatedChange !== 0) {
      affectedProductsSim[key] = stockSim[key];
    }
  });

  report.removedStockSimulated = affectedProductsSim;

  // Save report to disk
  fs.writeFileSync(path.join(process.cwd(), "db_diagnostic_output.json"), JSON.stringify(report, null, 2));
  console.log("Diagnostic report successfully generated and saved to db_diagnostic_output.json.");
}

main().catch((err) => {
  console.error("FATAL in test_db.ts:", err);
  process.exit(1);
});
