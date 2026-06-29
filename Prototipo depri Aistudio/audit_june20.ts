import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json";

async function main() {
  if (firebaseConfig.projectId) {
    process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
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
  }, "audit_brahma_details_app");

  const databaseIdToUse = explicitProjectId ? "(default)" : firebaseConfig.firestoreDatabaseId;
  const db = getFirestore(app, databaseIdToUse);

  console.log("Auditing June 20, 2026 movements for Brahma 1L...");
  const movesSnap = await db.collection("inventory_movements").where("itemId", "==", "tNMhIQ90MWC9TF1h4cVK").get();
  
  const moves = movesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Filter for movements on June 20
  const june20Moves = moves.filter((m: any) => m.date && m.date.includes("2026-06-20"));
  
  console.log("June 20 Movements:");
  console.log(JSON.stringify(june20Moves, null, 2));

  // Let's also check if there is a sale doc matching the VENTA of -9 units
  // Find docId: "CnQFiJszS6HKl8sEnl7T" in sales
  const saleDoc = await db.collection("sales").doc("CnQFiJszS6HKl8sEnl7T").get();
  if (saleDoc.exists) {
    console.log("\nMatching Sale Document 'CnQFiJszS6HKl8sEnl7T':");
    console.log(JSON.stringify(saleDoc.data(), null, 2));
  } else {
    console.log("\nSale Document 'CnQFiJszS6HKl8sEnl7T' not found in sales collection.");
  }
}

main().catch(console.error);
