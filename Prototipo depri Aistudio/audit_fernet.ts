import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));

async function main() {
  const result: any = {
    timestamp: new Date().toISOString(),
    fernet_products: [],
    fernet_movements: {},
    ajuste_movements: [],
    recent_movements: []
  };

  try {
    let credential: any = admin.credential.applicationDefault();
    const saKeyEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (saKeyEnv) {
      try {
        const saKeyJson = JSON.parse(saKeyEnv);
        credential = admin.credential.cert(saKeyJson);
      } catch (err) {}
    }

    const app = admin.initializeApp({
      projectId: saKeyEnv ? JSON.parse(saKeyEnv).project_id : firebaseConfig.projectId,
      credential: credential
    }, "audit-fernet-app-2");

    const db = getFirestore(app, "(default)");

    // 1. Find all stock items matching "fernet"
    const stockSnapshot = await db.collection("stock").get();
    const items = stockSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
    
    const fernetItems = items.filter(item => 
      item.name && item.name.toLowerCase().includes("fernet")
    );
    result.fernet_products = fernetItems;

    // 2. Query movements for each Fernet item
    for (const item of fernetItems) {
      const movementsSnapshot = await db.collection("inventory_movements")
        .where("itemId", "==", item.id)
        .get();
      const movements = movementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      result.fernet_movements[item.id] = {
        name: item.name,
        movements: movements
      };
    }

    // 3. Query all AJUSTE movements
    const ajusteSnapshot = await db.collection("inventory_movements")
      .where("type", "==", "AJUSTE")
      .get();
    result.ajuste_movements = ajusteSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    // 4. Query any movements on June 12-15 2026
    const allMovementsSnap = await db.collection("inventory_movements").get();
    const allMovements = allMovementsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
    result.recent_movements = allMovements.filter(m => {
      const d = m.date || "";
      return d.includes("2026-06-12") || d.includes("2026-06-13") || d.includes("2026-06-14") || d.includes("2026-06-15");
    });

    await app.delete();
  } catch (err: any) {
    result.error = err.message;
  }

  fs.writeFileSync(path.join(process.cwd(), "audit_fernet_output.json"), JSON.stringify(result, null, 2));
  console.log("Audit complete! Output written to audit_fernet_output.json");
}

main();
