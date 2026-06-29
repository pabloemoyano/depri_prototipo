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
  }, "audit_brahma_app");

  const databaseIdToUse = explicitProjectId ? "(default)" : firebaseConfig.firestoreDatabaseId;
  const db = getFirestore(app, databaseIdToUse);

  console.log("Searching for Brahma items in stock...");
  const stockSnap = await db.collection("stock").get();
  const brahmaItems = stockSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((item: any) => item.name && item.name.toLowerCase().includes("brahma"));

  console.log(`Found ${brahmaItems.length} Brahma items:`);
  console.log(JSON.stringify(brahmaItems, null, 2));

  for (const item of brahmaItems as any[]) {
    console.log(`\nFetching movements for ${item.name} (${item.id})...`);
    const movesSnap = await db.collection("inventory_movements").where("itemId", "==", item.id).get();
    const movements = movesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort movements by date
    movements.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    console.log(`Total movements: ${movements.length}`);
    movements.forEach((m: any) => {
      console.log(`- Date: ${m.date} | OpDate: ${m.operationDate} | Type: ${m.type} | Qty: ${m.quantity} | DocId: ${m.documentId} | Id: ${m.id}`);
    });
  }
}

main().catch(console.error);
