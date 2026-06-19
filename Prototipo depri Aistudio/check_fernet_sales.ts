import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json";

async function main() {
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
  }, "fernet_check_app");

  const databaseIdToUse = explicitProjectId ? "(default)" : firebaseConfig.firestoreDatabaseId;
  const db = getFirestore(app, databaseIdToUse);

  console.log("Connected. Querying all sales documents...");
  const snapshot = await db.collection("sales").get();
  const sales = snapshot.docs.map(doc => ({
    doc_id: doc.id,
    ...doc.data()
  }));

  console.log(`Found ${sales.length} documents in 'sales' collection.`);

  // Search for any sale containing Fernet
  const fernetSales = sales.filter((s: any) => {
    const itemsStr = JSON.stringify(s.items || "").toLowerCase();
    const notesStr = (s.notes || "").toLowerCase();
    const tableStr = (s.table_number || "").toLowerCase();
    return itemsStr.includes("fernet") || notesStr.includes("fernet") || tableStr.includes("fernet");
  });

  console.log("\nFernet Sales Found:");
  console.log(JSON.stringify(fernetSales, null, 2));
}

main().catch(console.error);
