import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!serviceAccountBase64) {
    console.error("FIREBASE_SERVICE_ACCOUNT_BASE64 is missing");
    process.exit(1);
}
const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString('ascii'));

if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
const COL = {
    STOCK: "stock",
    PURCHASES: "purchases",
    INVENTORY_MOVEMENTS: "inventory_movements",
};

async function backfill() {
    try {
        console.log("Starting backfill for INVENTORY_MOVEMENTS...");

        // 1. Get all stock items
        const stockSnapshot = await db.collection(COL.STOCK).get();
        const stockItems = stockSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. Get all existing movements to prevent duplicates
        const movementsSnapshot = await db.collection(COL.INVENTORY_MOVEMENTS).get();
        const existingMovements = movementsSnapshot.docs.map(doc => doc.data());

        let addedCount = 0;

        // 3. Backfill initial stock
        for (const item of stockItems) {
            const hasInitial = existingMovements.some(m => m.itemId === item.id && m.type === "INICIAL");
            if (!hasInitial && (item as any).quantity > 0) {
                const moveDocRef = db.collection(COL.INVENTORY_MOVEMENTS).doc();
                await moveDocRef.set({
                    id: moveDocRef.id,
                    itemId: item.id,
                    date: (item as any).last_updated || new Date().toISOString(), // Fallback to now
                    type: "INICIAL",
                    quantity: (item as any).quantity,
                    documentId: item.id,
                    operator: "Sistema (Migración)"
                });
                addedCount++;
                console.log(`Added INICIAL movement for item ${item.id} with quantity ${(item as any).quantity}`);
            }
        }

        // 4. Backfill purchases
        const purchasesSnapshot = await db.collection(COL.PURCHASES).get();
        const purchases = purchasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        for (const purchase of purchases) {
            const items = (purchase as any).items || [];
            for (const pItem of items) {
                const hasPurchaseMove = existingMovements.some(m => 
                    m.type === "COMPRA" && 
                    m.documentId === purchase.id &&
                    m.itemId === pItem.stock_item_id
                );

                if (!hasPurchaseMove && pItem.quantity > 0) {
                    const moveDocRef = db.collection(COL.INVENTORY_MOVEMENTS).doc();
                    await moveDocRef.set({
                        id: moveDocRef.id,
                        itemId: pItem.stock_item_id,
                        date: (purchase as any).date || (purchase as any).fecha || new Date().toISOString(),
                        type: "COMPRA",
                        quantity: Number(pItem.quantity),
                        documentId: purchase.id,
                        operator: "Sistema (Migración)"
                    });
                    addedCount++;
                    console.log(`Added COMPRA movement for item ${pItem.stock_item_id} from purchase ${purchase.id}`);
                }
            }
        }

        console.log(`Backfill complete. Added ${addedCount} missing movements.`);
    } catch (e: any) {
        console.error("Backfill failed:", e);
    }
}

backfill();
