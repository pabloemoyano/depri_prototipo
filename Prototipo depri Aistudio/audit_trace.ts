import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import firebaseConfig from "./firebase-applet-config.json";

dotenv.config();

const COL = {
  STOCK: "stock",
  INVENTORY_MOVEMENTS: "inventory_movements",
  AUDITS: "audits"
};

async function main() {
  let db: any = null;
  let useFirestore = false;

  // Initialize Admin
  try {
    const saKeyEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    let explicitProjectId: string | null = null;
    let credential: any = admin.credential.applicationDefault();
    if (saKeyEnv) {
      const saKeyJson = JSON.parse(saKeyEnv);
      credential = admin.credential.cert(saKeyJson);
      explicitProjectId = saKeyJson.project_id;
    }
    const app = admin.initializeApp({
      projectId: explicitProjectId || firebaseConfig.projectId,
      credential
    }, "trace_app");

    const databaseIdToUse = explicitProjectId ? "(default)" : firebaseConfig.firestoreDatabaseId;
    db = getFirestore(app, databaseIdToUse);
    // test
    await db.collection(COL.STOCK).limit(1).get();
    useFirestore = true;
  } catch (err: any) {
    // db.json will be used
  }

  let audits: any[] = [];
  let movements: any[] = [];
  let stock: any[] = [];

  if (useFirestore) {
    const audSnap = await db.collection(COL.AUDITS).get();
    audits = audSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    const movSnap = await db.collection(COL.INVENTORY_MOVEMENTS).get();
    movements = movSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    const stSnap = await db.collection(COL.STOCK).get();
    stock = stSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
  } else {
    const dbPath = path.join(process.cwd(), "db.json");
    const data = JSON.parse(fs.readFileSync(dbPath, "utf8"));
    audits = data.audits || [];
    movements = data.inventory_movements || [];
    stock = data.stock || [];
  }

  // Get item name mapping
  const itemMap: any = {};
  stock.forEach(item => {
    itemMap[item.id] = {
      name: item.name || item.nombre || "Unknown Product",
      currentStock: item.quantity !== undefined ? item.quantity : (item.stock !== undefined ? item.stock : 0)
    };
  });

  const isToday = (dateStr: string) => {
    if (!dateStr) return false;
    return dateStr.startsWith("2026-06-15") || dateStr.includes("2026-06-15") || dateStr.includes("15/06/2026") || dateStr.includes("15-06-2026");
  };

  const todayAudits = audits.filter(a => isToday(a.date));
  todayAudits.sort((a,b) => a.date.localeCompare(b.date));

  const result: any = {
    audits: []
  };

  todayAudits.forEach(aud => {
    // find matching movements
    const matchingMoves = movements.filter(m => {
      if (m.auditId === aud.id) return true;
      if (m.documentId === `Auditoría ${aud.id}`) return true;
      return false;
    });

    const productsAffected: any = [];
    let sumUnitsAdjusted = 0;

    matchingMoves.forEach(m => {
      const itemId = m.itemId || m.stock_item_id;
      const prodInfo = itemMap[itemId] || { name: `ID: ${itemId}`, currentStock: 0 };
      const qty = m.quantity || m.qty || 0;
      sumUnitsAdjusted += qty;

      productsAffected.push({
        movementId: m.id,
        itemId,
        name: prodInfo.name,
        qtyAdjusted: qty
      });
    });

    result.audits.push({
      auditId: aud.id,
      date: aud.date,
      responsible: aud.responsible,
      adjustedCount: aud.items ? aud.items.length : 0,
      impactCost: aud.adjustmentCost || 0,
      impactSales: aud.adjustmentSales || 0,
      matchingMovementsCount: matchingMoves.length,
      sumUnitsAdjusted,
      productsAffected
    });
  });

  // Check for orphan movements
  // An audit movement is orphan if its date is today, type is "AJUSTE", but its auditId does not match any audit from today
  const todayAuditIds = new Set(todayAudits.map(a => a.id));
  const orphans = movements.filter(m => {
    if (!isToday(m.date || m.created_at)) return false;
    if (m.type !== "AJUSTE") return false;
    
    const aid = m.auditId || (m.documentId && m.documentId.startsWith("Auditoría ") ? m.documentId.replace("Auditoría ", "").trim() : "unknown");
    if (aid === "unknown") return true; 
    if (!todayAuditIds.has(aid)) return true;
    return false;
  });

  result.orphans = orphans.map(o => {
    const itemId = o.itemId || o.stock_item_id;
    return {
      id: o.id,
      auditId: o.auditId || "unknown",
      documentId: o.documentId,
      date: o.date,
      itemId,
      name: (itemMap[itemId] || {}).name || "Unknown",
      quantity: o.quantity || 0,
      type: o.type,
      operator: o.operator || "Sistema"
    };
  });

  // Stock Simulation logic:
  // Reverting each audit movement. If movement is positive (added stock), we subtract it. If movement is negative (subtracted stock), we add it.
  const stockSim: any = {};
  Object.keys(itemMap).forEach(id => {
    stockSim[id] = {
      name: itemMap[id].name,
      currentStock: itemMap[id].currentStock,
      netChange: 0,
      simulatedRevertChange: 0,
      finalStock: itemMap[id].currentStock
    };
  });

  // Calculate net audit adjustments
  todayAudits.forEach(aud => {
    const matchingMoves = movements.filter(m => m.auditId === aud.id || m.documentId === `Auditoría ${aud.id}`);
    matchingMoves.forEach(m => {
      const itemId = m.itemId || m.stock_item_id;
      if (stockSim[itemId]) {
        stockSim[itemId].netChange += (m.quantity || 0);
      }
    });
  });

  const affectedStocks: any = [];
  Object.keys(stockSim).forEach(id => {
    const s = stockSim[id];
    if (s.netChange !== 0) {
      s.simulatedRevertChange = -s.netChange;
      s.finalStock = s.currentStock + s.simulatedRevertChange;
      affectedStocks.push({
        itemId: id,
        name: s.name,
        currentStock: s.currentStock,
        adjustmentApplied: s.netChange,
        simulatedUnappliedChange: s.simulatedRevertChange,
        finalStockPostRevert: s.finalStock
      });
    }
  });

  result.simulatedStockEffects = affectedStocks;

  fs.writeFileSync(path.join(process.cwd(), "audit_fernet_output.json"), JSON.stringify(result, null, 2));
  console.log("Trace output written successfully!");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
