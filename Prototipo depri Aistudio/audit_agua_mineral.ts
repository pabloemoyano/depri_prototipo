import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));

async function main() {
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
    }, "audit-agua-app");

    const db = getFirestore(app, "(default)");

    // 1. Find product "Agua Mineral 2L" in the stock collection
    const stockSnapshot = await db.collection("stock").get();
    const items = stockSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
    
    const targetItem = items.find(item => 
      item.name && item.name.toLowerCase().includes("agua mineral 2l")
    );

    if (!targetItem) {
      console.log(JSON.stringify({ error: "Product 'Agua Mineral 2L' not found in stock" }, null, 2));
      await app.delete();
      return;
    }

    // 2. Fetch all movements for this item
    const movementsSnapshot = await db.collection("inventory_movements")
      .where("itemId", "==", targetItem.id)
      .get();
    
    const movements = movementsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    // Reconstruct history
    const inicial = movements.filter(m => m.type === "INICIAL");
    const compras = movements.filter(m => m.type === "COMPRA");
    const ventas = movements.filter(m => m.type === "VENTA");
    const consumos = movements.filter(m => m.type === "CONSUMO");
    const ajustes = movements.filter(m => m.type === "AJUSTE");

    // Print detailed individual items first
    console.log("=== AUDITING PRODUCT ===");
    console.log("ID:", targetItem.id);
    console.log("Nombre:", targetItem.name);
    console.log("Stock actual en colección 'stock':", targetItem.quantity);
    console.log("");

    console.log("=== MOVIMIENTO INICIAL ===");
    inicial.forEach(m => {
      console.log(`Document ID: ${m.id} | Cantidad: ${m.quantity} | Fecha: ${m.date}`);
    });
    console.log("");

    console.log("=== COMPRAS ===");
    compras.forEach(m => {
      console.log(`Document ID: ${m.id} | Cantidad: ${m.quantity} | Fecha: ${m.date} | Costo Unitario: ${m.costPrice || m.price}`);
    });
    console.log(`Total compras: ${compras.reduce((acc, m) => acc + (Number(m.quantity) || 0), 0)}`);
    console.log("");

    console.log("=== VENTAS ===");
    ventas.forEach(m => {
      console.log(`Document ID: ${m.id} | Cantidad: ${m.quantity} | Fecha: ${m.date} | Venta ID: ${m.saleId || m.reference}`);
    });
    console.log(`Total ventas: ${ventas.reduce((acc, m) => acc + (Number(m.quantity) || 0), 0)}`);
    console.log("");

    console.log("=== CONSUMOS ===");
    consumos.forEach(m => {
      console.log(`Document ID: ${m.id} | Cantidad: ${m.quantity} | Fecha: ${m.date}`);
    });
    console.log(`Total consumos: ${consumos.reduce((acc, m) => acc + (Number(m.quantity) || 0), 0)}`);
    console.log("");

    console.log("=== AJUSTES ===");
    ajustes.forEach(m => {
      console.log(`Document ID: ${m.id} | Cantidad: ${m.quantity} | Fecha: ${m.date}`);
    });
    console.log(`Total ajustes: ${ajustes.reduce((acc, m) => acc + (Number(m.quantity) || 0), 0)}`);
    console.log("");

    await app.delete();
  } catch (err: any) {
    console.error("Error executing individual audit:", err.message);
  }
}

main();
