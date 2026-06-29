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
  console.log("Starting data correction for Audit AUD-3098 (Backdating from 2026-06-23 to 2026-06-20)...");
  
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
    }, "correction_app");

    const databaseIdToUse = explicitProjectId ? "(default)" : firebaseConfig.firestoreDatabaseId;
    db = getFirestore(app, databaseIdToUse);
    // Test connectivity
    await db.collection(COL.STOCK).limit(1).get();
    usingFirestore = true;
    console.log("Connected to Firestore successfully.");
  } catch (err: any) {
    console.log("Firestore fallback triggered, modifying local db.json if exists... Reason:", err.message);
  }

  const targetAuditId = "AUD-3098";
  const correctedDate = "2026-06-20T21:22:00.000Z";

  if (usingFirestore) {
    // 1. Correct Audit document
    const auditSnap = await db.collection(COL.AUDITS).where("id", "==", targetAuditId).get();
    if (auditSnap.empty) {
      console.log(`Audit ${targetAuditId} not found in Firestore.`);
    } else {
      const auditDoc = auditSnap.docs[0];
      await auditDoc.ref.update({ date: correctedDate });
      console.log(`Updated Audit document ${auditDoc.id} (ID: ${targetAuditId}) date to ${correctedDate}`);
    }

    // 2. Correct Movements
    const movesSnap = await db.collection(COL.INVENTORY_MOVEMENTS).get();
    let updatedMovesCount = 0;
    for (const doc of movesSnap.docs) {
      const data = doc.data();
      const matchId = data.auditId || (data.documentId && data.documentId.startsWith("Auditoría ") ? data.documentId.replace("Auditoría ", "").trim() : "");
      if (matchId === targetAuditId || data.documentId === `Auditoría ${targetAuditId}`) {
        await doc.ref.update({ date: correctedDate });
        updatedMovesCount++;
      }
    }
    console.log(`Successfully updated ${updatedMovesCount} inventory movements matching ${targetAuditId} to date ${correctedDate}`);
  } else {
    // Update local db.json
    const dbPath = path.join(process.cwd(), "db.json");
    if (fs.existsSync(dbPath)) {
      const data = JSON.parse(fs.readFileSync(dbPath, "utf8"));
      
      let auditUpdated = false;
      if (data.audits) {
        data.audits = data.audits.map((a: any) => {
          if (a.id === targetAuditId) {
            auditUpdated = true;
            return { ...a, date: correctedDate };
          }
          return a;
        });
      }

      let updatedMovesCount = 0;
      if (data.inventory_movements) {
        data.inventory_movements = data.inventory_movements.map((m: any) => {
          const matchId = m.auditId || (m.documentId && m.documentId.startsWith("Auditoría ") ? m.documentId.replace("Auditoría ", "").trim() : "");
          if (matchId === targetAuditId || m.documentId === `Auditoría ${targetAuditId}`) {
            updatedMovesCount++;
            return { ...m, date: correctedDate };
          }
          return m;
        });
      }

      if (auditUpdated || updatedMovesCount > 0) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        console.log(`Local db.json updated: Audit ${targetAuditId} set to ${correctedDate}, ${updatedMovesCount} movements updated.`);
      } else {
        console.log("No matching audits or movements found in local db.json");
      }
    } else {
      console.log("db.json not found.");
    }
  }

  console.log("Correction complete!");
}

main().catch(err => {
  console.error("Error in correction script:", err);
  process.exit(1);
});
