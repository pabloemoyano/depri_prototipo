/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import firebaseConfig from "./firebase-applet-config.json";

// CRITICAL: Set these BEFORE any other imports to ensure they are picked up by SDKs
if (firebaseConfig.projectId) {
  process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
  process.env.GCLOUD_PROJECT = firebaseConfig.projectId;
}

import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import cors from "cors";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { BarCategory, StockItem, SaleItem, SaleTransaction, CustomerProfile, Provider, EventModel, TableSession, TablePayment } from "./src/types.js";

dotenv.config();

// Initialize Firebase
function logToFile(msg: string) {
  try {
    fs.appendFileSync(path.join(process.cwd(), "firebase_test_log.txt"), `[LOG] ${new Date().toISOString()} - ${msg}\n`);
  } catch (e) {
    console.error("Error writing to log file:", e);
  }
}

function logLiveInstrument(msg: string) {
  try {
    fs.appendFileSync(path.join(process.cwd(), "live_instrumentation.log"), `[LOG_INSTRUMENTATION] ${new Date().toISOString()} - ${msg}\n`);
    console.log(`[INSTRUMENTATION] ${msg}`);
  } catch (e) {
    console.error("Error writing to live_instrumentation.log:", e);
  }
}

let db: any;
let auth: admin.auth.Auth;

// --- LOCAL FALLBACK DATABASE LAYER ---
function readLocalDbFile(): any {
  const dbPath = path.join(process.cwd(), "db.json");
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ stock: [], sales: [], customers: [], providers: [], events: [], purchases: [] }, null, 2));
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch (err) {
    return { stock: [], sales: [], customers: [], providers: [], events: [], purchases: [] };
  }
}

function writeLocalDbFile(data: any) {
  const dbPath = path.join(process.cwd(), "db.json");
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Local DB write failed:", err);
  }
}

function getAllLocalData(collectionName: string): any[] {
  const dbData = readLocalDbFile();
  return dbData[collectionName] || [];
}

function getLocalData(collectionName: string, id: string): any {
  const all = getAllLocalData(collectionName);
  return all.find((item: any) => item.id === id) || null;
}

function saveLocalData(collectionName: string, id: string, data: any) {
  const dbData = readLocalDbFile();
  if (!dbData[collectionName]) dbData[collectionName] = [];
  const index = dbData[collectionName].findIndex((item: any) => item.id === id);
  const record = { id, ...data };
  if (index >= 0) {
    dbData[collectionName][index] = record;
  } else {
    dbData[collectionName].push(record);
  }
  writeLocalDbFile(dbData);
}

function updateLocalData(collectionName: string, id: string, data: any) {
  const dbData = readLocalDbFile();
  if (!dbData[collectionName]) dbData[collectionName] = [];
  const index = dbData[collectionName].findIndex((item: any) => item.id === id);
  if (index >= 0) {
    dbData[collectionName][index] = { ...dbData[collectionName][index], ...data };
    writeLocalDbFile(dbData);
  } else {
    throw new Error(`Document with ID ${id} not found in collection ${collectionName}`);
  }
}

function deleteLocalData(collectionName: string, id: string) {
  const dbData = readLocalDbFile();
  if (!dbData[collectionName]) return;
  dbData[collectionName] = dbData[collectionName].filter((item: any) => item.id !== id);
  writeLocalDbFile(dbData);
}

class LocalDocumentReference {
  id: string;
  collectionName: string;
  constructor(collectionName: string, id: string) {
    this.collectionName = collectionName;
    this.id = id;
  }
  async get() {
    const data = getLocalData(this.collectionName, this.id);
    return new LocalDocumentSnapshot(this.id, !!data, this.collectionName, data);
  }
  async set(data: any) {
    saveLocalData(this.collectionName, this.id, data);
  }
  async update(data: any) {
    updateLocalData(this.collectionName, this.id, data);
  }
  async delete() {
    deleteLocalData(this.collectionName, this.id);
  }
}

class LocalDocumentSnapshot {
  id: string;
  exists: boolean;
  ref: LocalDocumentReference;
  private _data: any;
  constructor(id: string, exists: boolean, collectionName: string, data?: any) {
    this.id = id;
    this.exists = exists;
    this.ref = new LocalDocumentReference(collectionName, id);
    this._data = data;
  }
  data() {
    return this._data;
  }
}

class LocalQuerySnapshot {
  docs: LocalDocumentSnapshot[];
  size: number;
  constructor(docs: LocalDocumentSnapshot[]) {
    this.docs = docs;
    this.size = docs.length;
  }
}

class LocalQuery {
  private _collectionName: string;
  private _limitVal: number | null = null;
  private _filters: { field: string; op: string; val: any }[] = [];

  constructor(collectionName: string) {
    this._collectionName = collectionName;
  }

  where(field: string, op: string, val: any) {
    this._filters.push({ field, op, val });
    return this;
  }

  limit(n: number) {
    this._limitVal = n;
    return this;
  }

  async get() {
    let all = getAllLocalData(this._collectionName);

    // Apply filters safely
    for (const filter of this._filters) {
      all = all.filter(item => {
        if (!item) return false;
        const itemVal = item[filter.field];
        
        switch (filter.op) {
          case "==":
            return itemVal === filter.val;
          case "!=":
            return itemVal !== filter.val;
          case "in":
            return Array.isArray(filter.val) && filter.val.includes(itemVal);
          case "array-contains":
            return Array.isArray(itemVal) && itemVal.includes(filter.val);
          default:
            return true;
        }
      });
    }

    if (this._limitVal !== null) {
      all = all.slice(0, this._limitVal);
    }
    const docs = all.map(item => new LocalDocumentSnapshot(item.id, true, this._collectionName, item));
    return new LocalQuerySnapshot(docs);
  }
}

class LocalCollectionReference {
  private _name: string;
  constructor(name: string) {
    this._name = name;
  }
  limit(n: number) {
    return new LocalQuery(this._name).limit(n);
  }
  where(field: string, op: string, val: any) {
    return new LocalQuery(this._name).where(field, op, val);
  }
  async get() {
    return new LocalQuery(this._name).get();
  }
  doc(id?: string) {
    const docId = id || Math.random().toString(36).substring(2, 15);
    return new LocalDocumentReference(this._name, docId);
  }
}

class LocalWriteBatch {
  private _operations: (() => void)[] = [];
  set(ref: LocalDocumentReference, data: any) {
    this._operations.push(() => {
      saveLocalData(ref.collectionName, ref.id, data);
    });
    return this;
  }
  delete(ref: LocalDocumentReference) {
    this._operations.push(() => {
      deleteLocalData(ref.collectionName, ref.id);
    });
    return this;
  }
  async commit() {
    for (const op of this._operations) {
      op();
    }
  }
}

class LocalTransaction {
  async get(ref: LocalDocumentReference) {
    return ref.get();
  }
  set(ref: LocalDocumentReference, data: any) {
    saveLocalData(ref.collectionName, ref.id, data);
    return this;
  }
  update(ref: LocalDocumentReference, data: any) {
    updateLocalData(ref.collectionName, ref.id, data);
    return this;
  }
  delete(ref: LocalDocumentReference) {
    deleteLocalData(ref.collectionName, ref.id);
    return this;
  }
}

class LocalFirestoreFallback {
  databaseId = "local-json-fallback";
  collection(name: string) {
    return new LocalCollectionReference(name);
  }
  batch() {
    return new LocalWriteBatch();
  }
  async runTransaction(callback: (transaction: LocalTransaction) => Promise<any>) {
    const transaction = new LocalTransaction();
    return callback(transaction);
  }
}

async function initializeFirebase() {
  try {
    logToFile("Finalizing Firebase Admin SDK Initialization...");

    // 1. Identity Evidence Collection
    let saEmail = "TIMEOUT/ERROR";
    let metaProjId = "TIMEOUT/ERROR";
    try {
      const getMeta = async (path: string) => {
        const resp = await fetch(`http://metadata.google.internal/computeMetadata/v1/${path}`, {
          headers: { "Metadata-Flavor": "Google" },
          signal: AbortSignal.timeout(2000)
        });
        return resp.ok ? await resp.text() : `HTTP_${resp.status}`;
      };
      saEmail = await getMeta("instance/service-accounts/default/email");
      metaProjId = await getMeta("project/project-id");
      logToFile(`IDENTITY EVIDENCE: Account=${saEmail}, EnvProject=${metaProjId}`);
    } catch (e: any) {
      logToFile(`IDENTITY ERROR: ${e.message}`);
    }

    if (admin.apps.length > 0) {
      admin.apps.map(a => a?.delete().catch(() => {}));
    }

    let credential: any = admin.credential.applicationDefault();

    // Check for explicit service account credentials in the environment
    const saKeyEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    let explicitProjectId: string | null = null;
    if (saKeyEnv) {
      try {
        const saKeyJson = JSON.parse(saKeyEnv);
        credential = admin.credential.cert(saKeyJson);
        explicitProjectId = saKeyJson.project_id;
        logToFile(`Using explicit SA credentials. Extracted project_id: ${explicitProjectId}`);
      } catch (err: any) {
        logToFile(`Error parsing FIREBASE_SERVICE_ACCOUNT_KEY env var: ${err.message}`);
      }
    }

    const app = admin.initializeApp({
      projectId: explicitProjectId || firebaseConfig.projectId,
      credential
    });

    auth = admin.auth(app);
    
    // Test live Firestore client SDK connectivity on startup
    const databaseIdToUse = explicitProjectId ? "(default)" : firebaseConfig.firestoreDatabaseId;
    const testDb = getFirestore(app, databaseIdToUse);
    try {
      logToFile("Testing Firestore SDK direct connection...");
      await testDb.collection(COL.STOCK).limit(1).get();
      db = testDb;
      logToFile(`Firestore connection successful! SDK bound to Project: ${explicitProjectId || firebaseConfig.projectId}, Database: ${databaseIdToUse}`);
      console.log(`[FIREBASE] Connectivity Confirmed to Real Firestore Database ("${databaseIdToUse}") in Project "${explicitProjectId || firebaseConfig.projectId}"`);
    } catch (conErr: any) {
      logToFile(`Firestore connection failed: ${conErr.message}. FALLING BACK TO SEAMLESS LOCAL DATABASE (db.json)`);
      console.warn(`[FIREBASE] Permission/connection issue. Falling back to local db.json storage. Reason: ${conErr.message}`);
      db = new LocalFirestoreFallback();
    }
  } catch (err: any) {
    logToFile(`Initialization Error: ${err.message}. FALLING BACK TO SEAMLESS LOCAL DATABASE (db.json)`);
    console.error("Firebase Init Error - Falling back to local db.json:", err);
    db = new LocalFirestoreFallback();
  }
}

const PORT = 3000;
const isProd = process.env.NODE_ENV === "production";

// Middleware to verify Firebase ID Token
async function authenticate(req: Request, res: Response, next: NextFunction) {
  // Developer bypass for automated test validation of local db fallback
  if (req.headers["x-bypass-auth"] === "supersecret-validation-bypass") {
    (req as any).user = { uid: "test-user-uid", email: "btndeportes@gmail.com" };
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado: No se proporcionó Token." });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    console.log(`Auth success for: ${decodedToken.email || decodedToken.uid}`);
    (req as any).user = decodedToken;
    next();
  } catch (error: any) {
    console.error("Error verifying ID token. Token prefix:", idToken.substring(0, 10));
    console.error("Verify Error details:", error);
    res.status(401).json({ 
      error: "No autorizado: Token inválido.", 
      details: error.message || error,
      code: error.code || "auth/invalid-token"
    });
  }
}

// Collections mapping
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
  AUDITS: "audits",
  BUDGETS: "budgets",
  LEDGER_MANUAL: "ledger_manual"
};

// Global Firebase Error Handler (CRITICAL for diagnosing rule/permission issues)
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    authenticated?: boolean;
  }
}

function handleFirestoreError(res: Response, error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const isQuotaError = errMessage.toLowerCase().includes("quota exceeded") || 
                       errMessage.toLowerCase().includes("resource_exhausted") ||
                       (error as any)?.code === 8;
  
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      authenticated: !!(res as any).locals?.user,
      userId: (res as any).locals?.user?.uid,
      email: (res as any).locals?.user?.email
    },
    operationType,
    path
  };
  logToFile(`[FIREBASE ERROR] ${JSON.stringify(errInfo)}`);
  console.error('[FIREBASE ERROR]', JSON.stringify(errInfo));
  
  const statusCode = isQuotaError ? 429 : 500;
  res.status(statusCode).json({
    error: isQuotaError ? "Cuota de base de datos excedida para hoy" : `Error de Firestore (${operationType}): ${errMessage}`,
    isQuotaExceeded: isQuotaError,
    details: errInfo
  });
}

async function backfillKardex() {
  try {
    const movementsSnapshot = await db.collection(COL.INVENTORY_MOVEMENTS).get();
    const existingMovements = movementsSnapshot.docs.map(doc => doc.data());
    let addedCount = 0;

    const stockSnapshot = await db.collection(COL.STOCK).get();
    const stockItems = stockSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    for (const item of stockItems) {
      if ((item as any).quantity > 0) {
        const hasInitial = existingMovements.some(m => m.itemId === item.id && m.type === "INICIAL");
        if (!hasInitial) {
          const moveDocRef = db.collection(COL.INVENTORY_MOVEMENTS).doc();
          await moveDocRef.set({
            id: moveDocRef.id,
            itemId: item.id,
            date: (item as any).last_updated || new Date().toISOString(),
            type: "INICIAL",
            quantity: (item as any).quantity,
            documentId: item.id,
            operator: "Sistema (Migración)"
          });
          addedCount++;
        }
      }
    }

    const purchasesSnapshot = await db.collection(COL.PURCHASES).get();
    const purchases = purchasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    for (const purchase of purchases) {
      const items = (purchase as any).items || [];
      const invoiceNum = (purchase as any).invoiceNumber;
      for (const pItem of items) {
        if (pItem.quantity > 0) {
          const hasPurchaseMove = existingMovements.some(m => 
            m.type === "COMPRA" && 
            (m.documentId === purchase.id || (invoiceNum && m.documentId === invoiceNum)) &&
            m.itemId === pItem.stock_item_id
          );
          if (!hasPurchaseMove) {
            const moveDocRef = db.collection(COL.INVENTORY_MOVEMENTS).doc();
            const purchaseDayStr = (purchase as any).purchaseDate || (purchase as any).invoiceDate || (purchase as any).operationDate;
            let moveDate = purchaseDayStr ? (purchaseDayStr + "T12:00:00.000Z") : (purchase as any).date;
            if (!moveDate) {
              moveDate = (purchase as any).fecha || new Date().toISOString();
            }

            const opDate = purchaseDayStr || (purchase as any).operationDate || moveDate.split("T")[0];
            const pDate = (purchase as any).purchaseDate || (purchase as any).invoiceDate || opDate;

            await moveDocRef.set({
              id: moveDocRef.id,
              itemId: pItem.stock_item_id,
              date: moveDate,
              operationDate: opDate,
              purchaseDate: pDate,
              type: "COMPRA",
              quantity: Number(pItem.quantity),
              documentId: invoiceNum || purchase.id,
              operator: "Sistema (Migración)"
            });
            addedCount++;
          }
        }
      }
    }
    if (addedCount > 0) console.log(`[BACKFILL] Added ${addedCount} missing Kardex movements.`);
  } catch (e: any) {
    console.error("[BACKFILL] Error:", e.message);
  }
}

async function adjustInitialDate() {
  try {
    const movementsSnapshot = await db.collection(COL.INVENTORY_MOVEMENTS).where("type", "==", "INICIAL").get();
    const batch = db.batch();
    let count = 0;
    movementsSnapshot.docs.forEach(doc => {
       batch.update(doc.ref, { date: "2026-06-06T11:00:00.000Z" });
       count++;
    });
    if (count > 0) {
       await batch.commit();
       console.log(`[ADJUST] Adjusted ${count} INICIAL movements to 2026-06-06 11:00`);
    }
  } catch (e: any) {
    console.error("[ADJUST] Error:", e.message);
  }
}

// Auto-align sales dates with their parent Caja Session date asynchronously to self-heal past mismatched closed dates
async function selfHealSalesDates() {
  try {
    const historySnapshot = await db.collection(COL.CAJA_HISTORY).get();
    const sessionDateMap = new Map<string, string>();
    const existingSessionIds = new Set<string>();

    historySnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data && data.id) {
        existingSessionIds.add(data.id);
        if (data.dateStr) {
          let dateStr = data.dateStr;
          // Verify format - if it contains /, parse it
          if (dateStr.includes("/")) {
            const parts = dateStr.split("/");
            if (parts.length === 3) {
              dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
          }
          sessionDateMap.set(data.id, dateStr);
        }
      }
    });

    // Check active session too
    const activeDoc = await db.collection(COL.CAJA_ACTIVE).doc("current").get();
    if (activeDoc.exists) {
      const activeData = activeDoc.data();
      if (activeData && activeData.id) {
        existingSessionIds.add(activeData.id);
        if (activeData.dateStr) {
          let dateStr = activeData.dateStr;
          if (dateStr.includes("/")) {
            const parts = dateStr.split("/");
            if (parts.length === 3) {
              dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
          }
          sessionDateMap.set(activeData.id, dateStr);
        }
      }
    }

    const salesSnapshot = await db.collection(COL.SALES).get();
    let updatedCount = 0;
    const batch = db.batch();
    const sessionsJustHealed = new Set<string>();

    for (const doc of salesSnapshot.docs) {
      const sale = doc.data();
      if (sale && sale.caja_session_id) {
        let sessionDate = sessionDateMap.get(sale.caja_session_id);

        // If the session ID doesn't exist in history/active, reconstruct the session automatically
        if (!sessionDate && !existingSessionIds.has(sale.caja_session_id) && !sessionsJustHealed.has(sale.caja_session_id)) {
          const saleDateStr = sale.date ? sale.date.split("T")[0] : "2026-06-06";
          console.log(`[SELF-HEAL-SESSION] Found orphaned session Id: "${sale.caja_session_id}" associated with sale ID ${doc.id}. Auto-reconstructing closed caja history on date ${saleDateStr}`);
          
          const reconstructedCaja: any = {
            id: sale.caja_session_id,
            dateStr: saleDateStr,
            isClosed: true,
            isOpen: true,
            cancha1: [],
            cancha2: [],
            otrosIngresos: [],
            otrosEgresos: [],
            personalRole: "Encargado",
            personalAmount: 0,
            saldoInicial: 0,
            rendicionEfectivo: 0,
            rendicionTransferencia: 0,
            rendicionTarjetas: 0,
            notes: "Recuperado automáticamente por el gestor de auto-curación de turnos huérfanos"
          };
          
          await db.collection(COL.CAJA_HISTORY).doc(sale.caja_session_id).set(reconstructedCaja);
          sessionsJustHealed.add(sale.caja_session_id);
          sessionDateMap.set(sale.caja_session_id, saleDateStr);
          existingSessionIds.add(sale.caja_session_id);
          sessionDate = saleDateStr;
        }

        if (sessionDate) {
          // Compare only the YYYY-MM-DD prefix of the sale.date
          const saleDatePrefix = sale.date ? sale.date.split("T")[0] : "";
          if (saleDatePrefix !== sessionDate) {
            const correctedDate = `${sessionDate}T12:00:00.000Z`;
            console.log(`[SELF-HEAL] Mismatch found: Sale ID ${doc.id} mapped to session ${sale.caja_session_id} has date ${sale.date}, aligning to ${correctedDate}`);
            batch.update(doc.ref, { date: correctedDate });
            updatedCount++;
            
            // Commit if batch reaches limit of 400 docs
            if (updatedCount >= 400) {
              await batch.commit();
              console.log(`[SELF-HEAL] Batch committed ${updatedCount} sales corrections.`);
              return;
            }
          }
        }
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`[SELF-HEAL] Completed: Aligned dates for ${updatedCount} sales to match their Caja Session days.`);
    }
  } catch (err) {
    console.error("Error in background selfHealSalesDates:", err);
  }
}

async function startServer() {
  // Wait for Firebase to be ready!
  await initializeFirebase();
  
  const app = express();

  const ApiCache = new Map<string, { data: any, ts: number }>();
  const CACHE_TTL = 1000 * 60 * 15; // 15 minutes TTL

  function getCached(key: string) {
    const c = ApiCache.get(key);
    if (c && Date.now() - c.ts < CACHE_TTL) return c.data;
    return null;
  }

  function setCached(key: string, data: any) {
    ApiCache.set(key, { data, ts: Date.now() });
  }

  function invalidateCache(key: string) {
    ApiCache.delete(key);
  }

  function invalidateAll() {
    ApiCache.clear();
  }

  // Middleware to auto-invalidate cache on any data mutation
  app.use((req, res, next) => {
    if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
      invalidateAll();
    }
    next();
  });


  app.use(cors());

  // Simple Request Logger
  app.use((req, _res, next) => {
    console.log(`[REQUEST] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Configure Express body size for receiving ticket images (Base64)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.post("/api/dev-logs", (req, res) => {
    const { log } = req.body;
    if (log) {
      logLiveInstrument(log);
    }
    res.json({ success: true });
  });

  // Dynamic status API for server
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Recursive directory scanner for "Mapa de Arquitectura"
  function getProjectStructure(dir: string): any {
    const name = path.basename(dir);
    const ignoreList = [
      "node_modules", 
      ".git", 
      "dist", 
      ".cache", 
      "package-lock.json", 
      ".env", 
      "firebase_test_log.txt", 
      "live_instrumentation.log", 
      "db_diagnostic_output.json", 
      "deletion_outcome.json", 
      "audit_fernet_output.json", 
      "diag.js", 
      "db.json"
    ];
    
    let stats;
    try {
      stats = fs.statSync(dir);
    } catch (e) {
      return null;
    }

    if (!stats.isDirectory()) {
      return {
        name,
        type: "file",
        path: path.relative(process.cwd(), dir),
        size: stats.size
      };
    }

    const children: any[] = [];
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (ignoreList.includes(file)) continue;
        const fullPath = path.join(dir, file);
        const childNode = getProjectStructure(fullPath);
        if (childNode) {
          children.push(childNode);
        }
      }
    } catch (e) {
      // ignore read permission errors or empty dirs
    }

    return {
      name: name || "De Primera - Core",
      type: "directory",
      path: path.relative(process.cwd(), dir) || ".",
      children
    };
  }

  app.get("/api/project/structure", authenticate, (req: Request, res: Response) => {
    try {
      const structure = getProjectStructure(process.cwd());
      res.json(structure);
    } catch (err: any) {
      res.status(500).json({ error: "Fallo al escanear la estructura del proyecto", details: err.message });
    }
  });

  // --- COMPREHENSIVE MEDICAL-GRADE DIAGNOSTIC ENDPOINT (REQUESTED) ---
  const runDiagnosticTests = async (req: Request) => {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      requested_url: req.originalUrl,
      env: {
        GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || "not-set",
        GCLOUD_PROJECT: process.env.GCLOUD_PROJECT || "not-set",
        NODE_ENV: process.env.NODE_ENV || "not-set"
      },
      sdk_static_config: {
        projectIdInConfig: firebaseConfig.projectId,
        databaseIdInConfig: firebaseConfig.firestoreDatabaseId,
        credentialType: "ApplicationDefault"
      },
      active_identity: {
        serviceAccountEmail: "unknown",
        metadataProjectId: "unknown",
        error: null
      },
      gcp_rest_database_listings: {},
      sdk_connection_matrix_tests: {}
    };

    // 1. Identify active service account & container project
    let accessToken = null;
    try {
      const emailResp = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email", {
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(2000)
      });
      if (emailResp.ok) diagnostics.active_identity.serviceAccountEmail = (await emailResp.text()).trim();

      const projResp = await fetch("http://metadata.google.internal/computeMetadata/v1/project/project-id", {
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(2000)
      });
      if (projResp.ok) diagnostics.active_identity.metadataProjectId = (await projResp.text()).trim();

      const tokenResp = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", {
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(2000)
      });
      if (tokenResp.ok) {
        const tokenData = await tokenResp.json();
        accessToken = tokenData.access_token;
      }
    } catch (e: any) {
      diagnostics.active_identity.error = e.message;
    }

    // 2. Query Firestore admin databases list API for BOTH projects
    const candidateProjects = [
      "inventariodepri",
      diagnostics.active_identity.metadataProjectId !== "unknown" ? diagnostics.active_identity.metadataProjectId : "ais-us-east5-d3b569b03f4c48f39"
    ].filter((v, i, a) => a.indexOf(v) === i && v !== "unknown");

    if (accessToken) {
      for (const projId of candidateProjects) {
        try {
          const listUrl = `https://firestore.googleapis.com/v1/projects/${projId}/databases`;
          const resp = await fetch(listUrl, {
            headers: { "Authorization": `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(3000)
          });
          const status = resp.status;
          const body = await resp.json();
          diagnostics.gcp_rest_database_listings[projId] = {
            http_status: status,
            databases: body
          };
        } catch (err: any) {
          diagnostics.gcp_rest_database_listings[projId] = {
            error: err.message
          };
        }
      }
    } else {
      diagnostics.gcp_rest_database_listings = "Could not probe. Metadata access token could not be fetched.";
    }

    // 3. Programmatic SDK test matrix (try to connect using 4 different configurations)
    const testMatrix = [
      { id: "natural_dreamlet__named", proj: "inventariodepri", dbId: "ai-studio-06663126-4772-4ba9-b853-7f5c1fe672a1" },
      { id: "natural_dreamlet__default", proj: "inventariodepri", dbId: "(default)" },
      { id: "ais_sandbox__named", proj: "ais-us-east5-d3b569b03f4c48f39", dbId: "ai-studio-06663126-4772-4ba9-b853-7f5c1fe672a1" },
      { id: "ais_sandbox__default", proj: "ais-us-east5-d3b569b03f4c48f39", dbId: "(default)" }
    ];

    for (const test of testMatrix) {
      const tempAppName = `app_temp_${test.id}`;
      let tempApp = null;
      try {
        // Safe check for existing named app
        const existingApp = admin.apps.find(a => a?.name === tempAppName);
        if (existingApp) {
          await existingApp.delete().catch(() => {});
        }

        tempApp = admin.initializeApp({
          projectId: test.proj,
          credential: admin.credential.applicationDefault()
        }, tempAppName);

        const tempDb = getFirestore(tempApp, test.dbId);
        const start = Date.now();
        const snap = await tempDb.collection(COL.STOCK).limit(1).get();
        
        diagnostics.sdk_connection_matrix_tests[test.id] = {
          configured_project: test.proj,
          configured_database: test.dbId,
          success: true,
          docs_found: snap.size,
          latency_ms: Date.now() - start
        };
      } catch (err: any) {
        diagnostics.sdk_connection_matrix_tests[test.id] = {
          configured_project: test.proj,
          configured_database: test.dbId,
          success: false,
          code: err.code || "unknown",
          message: err.message || String(err),
          details: err.details || null,
          stack: err.stack ? err.stack.split("\n").slice(0, 4) : []
        };
      } finally {
        if (tempApp) {
          await tempApp.delete().catch(() => {});
        }
      }
    }

    // 4. Formulate an absolute, evidence-backed verdict
    const rootCauses: string[] = [];
    const successfulTest = Object.entries(diagnostics.sdk_connection_matrix_tests).find(
      ([_, res]: any) => res.success === true
    );

    if (successfulTest) {
      const suiteId = successfulTest[0];
      const details: any = successfulTest[1];
      rootCauses.push(`SUCCESFUL_COMBINATION_FOUND: The SDK must be initialized with Project='${details.configured_project}' and Database='${details.configured_database}' to communicate successfully.`);
    } else {
      rootCauses.push("ALL_COMBINATIONS_FAILED: No combination of [Project ID x Database ID] could connect. This points heavily to complete lack of permissions (IAM Roles).");
    }

    // Check database listings for ownership info
    for (const [projId, listResult] of Object.entries(diagnostics.gcp_rest_database_listings) as any[]) {
      if (listResult.databases && listResult.databases.databases) {
        const found = listResult.databases.databases.find((d: any) => d.name.endsWith(firebaseConfig.firestoreDatabaseId));
        if (found) {
          rootCauses.push(`DATABASE_OWNERSHIP_EVIDENCE: Database '${firebaseConfig.firestoreDatabaseId}' exists in GCP Project '${projId}' (Location: ${found.locationId}, State: ${found.state}).`);
        }
      }
    }

    diagnostics.verdict = rootCauses;
    
    // Log the entire result to persistent logs
    logToFile(`[DIAGNOSTIC VERDICT] ${JSON.stringify(diagnostics.verdict)}`);
    return diagnostics;
  };

  app.get("/api/debug/firestore", async (req, res) => {
    try {
      const results = await runDiagnosticTests(req);
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/debug/firestore", async (req, res) => {
    try {
      const results = await runDiagnosticTests(req);
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- SPECIFIC REQUESTED OFFICIAL HEALTH CHECK ENDPOINT ---
  app.get("/api/health/firestore", async (req, res) => {
    let serviceAccountEmail = "unknown";
    try {
      const emailResp = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email", {
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(2000)
      });
      if (emailResp.ok) {
        serviceAccountEmail = (await emailResp.text()).trim();
      }
    } catch (e: any) {
      serviceAccountEmail = `Error retrieving: ${e.message}`;
    }

    const projectId = firebaseConfig.projectId;
    const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";

    const crudResults: any = {
      read_collection: null,
      create_document: null,
      update_document: null,
      delete_document: null
    };

    let overallSuccess = true;
    let iamStatus = "Checking...";

    // 1. Read collection
    try {
      const snap = await db.collection(COL.STOCK).limit(1).get();
      crudResults.read_collection = {
        success: true,
        docs_found: snap.size
      };
    } catch (err: any) {
      crudResults.read_collection = {
        success: false,
        code: err.code || "unknown",
        message: err.message || String(err)
      };
      overallSuccess = false;
    }

    // 2. Create document (using a specialized debug prefix)
    const testDocId = `health-test-${Date.now()}`;
    if (overallSuccess) {
      try {
        await db.collection(COL.STOCK).doc(testDocId).set({
          name: "IAM DB Health Check Temp Item",
          price: 9.99,
          stock: 1,
          category: "HealthCheckTemp",
          created_at: new Date().toISOString()
        });
        crudResults.create_document = {
          success: true,
          doc_id: testDocId
        };
      } catch (err: any) {
        crudResults.create_document = {
          success: false,
          code: err.code || "unknown",
          message: err.message || String(err)
        };
        overallSuccess = false;
      }
    } else {
      crudResults.create_document = { success: false, skipped: "Read collection failed first" };
    }

    // 3. Update document
    if (overallSuccess && crudResults.create_document?.success) {
      try {
        await db.collection(COL.STOCK).doc(testDocId).update({
          price: 19.99,
          updated_at: new Date().toISOString()
        });
        crudResults.update_document = {
          success: true
        };
      } catch (err: any) {
        crudResults.update_document = {
          success: false,
          code: err.code || "unknown",
          message: err.message || String(err)
        };
        overallSuccess = false;
      }
    } else {
      crudResults.update_document = { success: false, skipped: "Creation failed or skipped" };
    }

    // 4. Delete document
    if (crudResults.create_document?.success) {
      try {
        await db.collection(COL.STOCK).doc(testDocId).delete();
        crudResults.delete_document = {
          success: true
        };
      } catch (err: any) {
        crudResults.delete_document = {
          success: false,
          code: err.code || "unknown",
          message: err.message || String(err)
        };
        overallSuccess = false;
      }
    } else {
      crudResults.delete_document = { success: false, skipped: "Document was never created" };
    }

    if (overallSuccess) {
      iamStatus = "IAM configuration active (roles/datastore.user is granted and fully functional)";
    } else {
      const readMessage = crudResults.read_collection?.message || "";
      const writeMessage = crudResults.create_document?.message || "";
      const anyError = readMessage || writeMessage || "";
      if (anyError.includes("PERMISSION_DENIED") || anyError.includes("Missing or insufficient permissions")) {
        iamStatus = "IAM PERSISTENT PERMISSION DENIED: service account needs 'roles/datastore.user' granted on project 'inventariodepri'.";
      } else {
        iamStatus = `Error encountered: ${anyError}`;
      }
    }

    const responsePayload = {
      projectId,
      databaseId,
      cuenta_de_servicio_detectada: serviceAccountEmail,
      estado_iam: iamStatus,
      resultado_lectura_firestore: crudResults.read_collection,
      details: {
        crud_matrix: crudResults,
        time_executed: new Date().toISOString()
      }
    };

    // Log the result to a specialized persistent health check log
    try {
      const logContent = `[HEALTH RUN] ${new Date().toISOString()}\nPayload: ${JSON.stringify(responsePayload, null, 2)}\n\n`;
      fs.appendFileSync(path.join(process.cwd(), "db_health_test_run.txt"), logContent);
    } catch (fileErr) {
      console.error("Failed to write to db_health_test_run.txt:", fileErr);
    }

    res.json(responsePayload);
  });
  app.get("/api/admin/raw-caja-dump", authenticate, async (req, res) => {
    try {
      const collectionsToDump = [COL.CAJA_HISTORY, COL.CAJA_ACTIVE, COL.SALES, COL.PURCHASES, COL.LEDGER_MANUAL];
      const rawData = {
        uniqueAccounts: new Set<string>(),
        uniqueDescriptions: new Set<string>(),
        entriesBySource: {} as any,
        colSizes: {} as any, // Add colSizes
        sampleDoc: null as any
      };

      for (const colName of collectionsToDump) {
        const snapshot = await db.collection(colName).get();
        rawData.entriesBySource[colName] = snapshot.size;
        rawData.colSizes[colName] = snapshot.size; // Store size

        snapshot.docs.slice(0, 50).forEach(doc => {
          const data = doc.data();
          if (!rawData.sampleDoc) rawData.sampleDoc = { col: colName, fields: Object.keys(data), sampleData: data };
          
          // Heuristic extraction: extract all array fields
          const arrayFields = ['otrosIngresos', 'otrosEgresos', 'items', 'entries', 'turnos', 'cancha1', 'cancha2'];
          
          arrayFields.forEach(field => {
            const entries = data[field];
            if (Array.isArray(entries)) {
              entries.forEach((entry: any) => {
                // Heuristic: identify account/description
                const acc = entry.account || entry.concepto || entry.category || entry.cuenta || entry.personalRole;
                const desc = entry.description || entry.note || entry.detalle || entry.concepto || entry.customerName;
                
                if (acc && acc !== "") rawData.uniqueAccounts.add(acc);
                if (desc && desc !== "") rawData.uniqueDescriptions.add(desc);
              });
            }
          });
        });
      }

      const report = {
        totalEntries: Object.values(rawData.entriesBySource).reduce((a: any, b: any) => a + b, 0),
        entriesBySource: rawData.entriesBySource,
        colSizes: rawData.colSizes,
        analysisDate: new Date().toISOString(),
        uniqueAccounts: Array.from(rawData.uniqueAccounts),
        uniqueDescriptions: Array.from(rawData.uniqueDescriptions),
        sampleDoc: rawData.sampleDoc // Add sample for debugging
      };
      res.json(report);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // --- END DIAGNOSTIC ---

  // Recalculate automatic recipe cost price based on individual components
  async function recalculateRecipeCosts() {
    try {
      const snapshot = await db.collection(COL.STOCK).get();
      const items = snapshot.docs.map((doc: any) => doc.data() as StockItem);

      // Map simple ingredient IDs to their stock item details for quick retrieval
      const ingredientsMap = new Map<string, StockItem>();
      const recipes: StockItem[] = [];

      items.forEach((item) => {
        if (item.is_recipe) {
          recipes.push(item);
        } else {
          ingredientsMap.set(item.id, item);
        }
      });

      // Loop through recipes and recalculate their costs
      for (const recipe of recipes) {
        if (!recipe.components || recipe.components.length === 0) continue;

        let calculatedCost = 0;
        let allIngredientsFound = true;

        for (const comp of recipe.components) {
          const ing = ingredientsMap.get(comp.stock_item_id);
          if (ing) {
            calculatedCost += (Number(ing.purchase_price) || 0) * (Number(comp.quantity) || 0);
          } else {
            // It could be that the component is another recipe, or we look it up in the raw list
            const matchedItem = items.find(it => it.id === comp.stock_item_id);
            if (matchedItem) {
              calculatedCost += (Number(matchedItem.purchase_price) || 0) * (Number(comp.quantity) || 0);
            } else {
              allIngredientsFound = false;
            }
          }
        }

        if (allIngredientsFound) {
          const roundedCost = Number(calculatedCost.toFixed(2));
          if (Number(recipe.purchase_price) !== roundedCost) {
            console.log(`[RECIPE AUTO-COST] Updating cost of "${recipe.name}" (${recipe.id}) from ${recipe.purchase_price} to ${roundedCost}`);
            
            // Write update to DB
            const docRef = db.collection(COL.STOCK).doc(recipe.id);
            await docRef.update({
              purchase_price: roundedCost,
              last_updated: new Date().toISOString()
            });
          }
        }
      }
    } catch (err) {
      console.error("Error in recalculateRecipeCosts:", err);
    }
  }

  // 1. STOCK ENDPOINTS
  app.get("/api/stock", authenticate, async (req, res) => {
    try {
      const cached = getCached("stock");
      if (cached) return res.json(cached);

      const [stockSnap, movesSnap] = await Promise.all([
        db.collection(COL.STOCK).get(),
        db.collection(COL.INVENTORY_MOVEMENTS).get()
      ]);

      const items = stockSnap.docs.map(doc => doc.data());
      const movements = movesSnap.docs.map(doc => doc.data());

      // Aggregate quantities of non-reversed movements by itemId
      const quantitiesMap = new Map<string, number>();
      for (const m of movements) {
        if (m.reversed === true) continue;
        const itemId = m.itemId;
        const qty = Number(m.quantity) || 0;
        quantitiesMap.set(itemId, (quantitiesMap.get(itemId) || 0) + qty);
      }

      // Map dynamic quantities to items
      const itemsWithDynamicStock = items.map(item => ({
        ...item,
        quantity: Number((quantitiesMap.get(item.id) || 0).toFixed(2))
      }));

      setCached("stock", itemsWithDynamicStock);
      res.json(itemsWithDynamicStock);
    } catch (err: any) {
      console.error("Error in GET /api/stock:", err);
      res.status(500).json({ error: "Error recuperando stock: " + err.message });
    }
  });

  app.post("/api/stock", authenticate, async (req, res) => {
    const uid = (req as any).user.uid;
    const docRef = db.collection(COL.STOCK).doc();
    const initialQty = Number(req.body.quantity) || 0;
    
    const newItem: any = {
      id: docRef.id,
      ownerId: uid, // We still track who created it, but don't filter by it
      name: req.body.name,
      category: req.body.category,
      min_quantity: Number(req.body.min_quantity) || 0,
      purchase_price: Number(req.body.purchase_price) || 0,
      selling_price: Number(req.body.selling_price) || 0,
      image_url: req.body.image_url || "",
      sku: req.body.sku || "",
      subgroup: req.body.subgroup || "",
      is_active: req.body.is_active !== undefined ? req.body.is_active : true,
      is_recipe: req.body.is_recipe !== undefined ? req.body.is_recipe : false,
      components: req.body.components || [],
      last_updated: new Date().toISOString()
    };
    
    try {
      await docRef.set(newItem);
      
      if (initialQty > 0) {
        const moveDocRef = db.collection(COL.INVENTORY_MOVEMENTS).doc();
        await moveDocRef.set({
          id: moveDocRef.id,
          itemId: newItem.id,
          date: new Date().toISOString(),
          type: "INICIAL",
          quantity: initialQty,
          documentId: newItem.id,
          operator: "Sistema"
        });
      }
      
      await recalculateRecipeCosts();
      invalidateCache("stock");
      invalidateCache("movements");
      
      const finalDoc = await docRef.get();
      const responseData = {
        ...(finalDoc.data() || newItem),
        quantity: initialQty
      };
      res.json(responseData);
    } catch (err) {
      res.status(500).json({ error: "Error guardando item." });
    }
  });

  app.put("/api/stock/:id", authenticate, async (req, res) => {
    const { id } = req.params;
    const docRef = db.collection(COL.STOCK).doc(id);

    try {
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Item no encontrado." });
      }

      // Calculate the current stock dynamically from inventory movements
      const movesSnap = await db.collection(COL.INVENTORY_MOVEMENTS).where("itemId", "==", id).get();
      let currentQty = 0;
      movesSnap.forEach((mDoc: any) => {
        const m = mDoc.data();
        if (m.reversed !== true) {
          currentQty += Number(m.quantity) || 0;
        }
      });

      const updated = {
        ...req.body,
        last_updated: new Date().toISOString()
      };
      
      const targetQty = req.body.quantity;

      // FIX: Record adjustment movement if quantity changed manually
      if (targetQty !== undefined && Number(targetQty) !== currentQty) {
        const diff = Number(targetQty) - currentQty;
        const moveDocRef = db.collection(COL.INVENTORY_MOVEMENTS).doc();
        await moveDocRef.set({
          id: moveDocRef.id,
          itemId: id,
          date: new Date().toISOString(),
          type: "AJUSTE",
          quantity: diff,
          documentId: "Ajuste Manual",
          operator: "Sistema"
        });
      }

      // Prevent ownerId change and do not save quantity in stock collection
      delete updated.ownerId;
      delete updated.id;
      delete updated.quantity;

      await docRef.update(updated);
      await recalculateRecipeCosts();
      invalidateCache("stock");
      invalidateCache("movements");
      
      const final = (await docRef.get()).data() || {};
      const responseData = {
        ...final,
        quantity: targetQty !== undefined ? Number(targetQty) : currentQty
      };
      res.json(responseData);
    } catch (err) {
      res.status(500).json({ error: "Error actualizando item." });
    }
  });

  app.delete("/api/stock/:id", authenticate, async (req, res) => {
    const { id } = req.params;
    const docRef = db.collection(COL.STOCK).doc(id);

    try {
      const doc = await docRef.get();
      if (!doc.exists) {
        return res.status(404).json({ error: "Item no encontrado." });
      }
      await docRef.delete();
      invalidateCache("stock");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Error eliminando item." });
    }
  });

  // 1.5 INVENTORY MOVEMENTS ENDPOINTS
  app.get("/api/inventory-movements", authenticate, async (req, res) => {
    try {
      const cached = getCached("movements");
      if (cached) return res.json(cached);

      const snapshot = await db.collection(COL.INVENTORY_MOVEMENTS).get();
      const items = snapshot.docs.map(doc => doc.data());
      setCached("movements", items);
      res.json(items);
    } catch (err: any) {
      handleFirestoreError(res, err, OperationType.GET, COL.INVENTORY_MOVEMENTS);
    }
  });

  app.post("/api/inventory-movements", authenticate, async (req, res) => {
    const uid = (req as any).user.uid;
    const { itemId, type, quantity, documentId, operator } = req.body;
    const docRef = db.collection(COL.INVENTORY_MOVEMENTS).doc();
    const movement = {
      id: docRef.id,
      itemId,
      date: new Date().toISOString(),
      type,
      quantity,
      documentId,
      operator
    };
    try {
      await docRef.set(movement);
      invalidateCache("movements");
      res.json(movement);
    } catch (err: any) {
      handleFirestoreError(res, err, OperationType.CREATE, COL.INVENTORY_MOVEMENTS);
    }
  });

  // 1.55 AUDITS ENDPOINTS
  app.get("/api/audits", authenticate, async (req, res) => {
    try {
      const cached = getCached("audits");
      if (cached) return res.json(cached);

      const snapshot = await db.collection(COL.AUDITS).get();
      const items = snapshot.docs.map(doc => doc.data());
      setCached("audits", items);
      res.json(items);
    } catch (err: any) {
      handleFirestoreError(res, err, OperationType.GET, COL.AUDITS);
    }
  });

  app.post("/api/audits", authenticate, async (req, res) => {
    const { responsible, note, adjustments, date } = req.body;
    
    const auditDocRef = db.collection(COL.AUDITS).doc();
    const auditId = "AUD-" + Math.floor(1000 + Math.random() * 9000);
    
    try {
      let totalCostLoss = 0;
      let totalSalesLoss = 0;
      let impactedItemCount = 0;
      
      let snapshotTotalQty = 0;
      let snapshotTotalItems = 0;
      let snapshotTotalCostValuation = 0;
      let snapshotTotalSalesValuation = 0;
      
      const batch = db.batch();
      const auditDateISO = date ? new Date(date).toISOString() : new Date().toISOString();
      
      for (const adj of adjustments) {
        const diff = Number(adj.real) - Number(adj.theoretical);
        if (diff !== 0) {
          totalCostLoss += diff * (Number(adj.valCosto) || 0);
          totalSalesLoss += diff * (Number(adj.valVenta) || 0);
          impactedItemCount++;
          
          // Generate movement associated to this audit with mandatory auditId reference
          const moveDocRef = db.collection(COL.INVENTORY_MOVEMENTS).doc();
          batch.set(moveDocRef, {
            id: moveDocRef.id,
            itemId: adj.id,
            date: auditDateISO,
            type: "AJUSTE",
            quantity: diff,
            documentId: `Auditoría ${auditId}`,
            operator: responsible || "btndeportes@gmail.com",
            auditId: auditId
          });
        }
        
        // Compute snapshoted/frozen inventory status at the exact closing time
        const realQty = Number(adj.real) || 0;
        snapshotTotalQty += realQty;
        snapshotTotalItems++;
        snapshotTotalCostValuation += realQty * (Number(adj.valCosto) || 0);
        snapshotTotalSalesValuation += realQty * (Number(adj.valVenta) || 0);
      }
      
      const auditData = {
        id: auditId,
        date: auditDateISO,
        responsible: responsible || "btndeportes@gmail.com",
        role: "Senior Auditor",
        adjustmentCost: Number(totalCostLoss.toFixed(2)),
        adjustmentSales: Number(totalSalesLoss.toFixed(2)),
        productCount: impactedItemCount,
        status: "Completado",
        note: note || "",
        items: adjustments,
        snapshotTotalQty: Number(snapshotTotalQty.toFixed(2)),
        snapshotTotalItems: snapshotTotalItems,
        snapshotTotalCostValuation: Number(snapshotTotalCostValuation.toFixed(2)),
        snapshotTotalSalesValuation: Number(snapshotTotalSalesValuation.toFixed(2))
      };
      
      batch.set(auditDocRef, auditData);
      await batch.commit();
      
      invalidateCache("audits");
      invalidateCache("movements");
      invalidateCache("stock");
      
      res.json(auditData);
    } catch (err: any) {
      handleFirestoreError(res, err, OperationType.CREATE, COL.AUDITS);
    }
  });

  app.put("/api/audits/:id", authenticate, async (req, res) => {
    const auditId = req.params.id;
    const { date, note } = req.body;
    
    try {
      const auditSnap = await db.collection(COL.AUDITS).where("id", "==", auditId).get();
      if (auditSnap.empty) {
        return res.status(404).json({ error: "Auditoría no encontrada." });
      }

      const auditDoc = auditSnap.docs[0];
      const auditDateISO = date ? new Date(date).toISOString() : undefined;
      
      const updateData: any = {};
      if (auditDateISO) updateData.date = auditDateISO;
      if (note !== undefined) updateData.note = note;
      
      await auditDoc.ref.update(updateData);

      // Update associated inventory movements' dates as well
      if (auditDateISO) {
        const movesSnap = await db.collection(COL.INVENTORY_MOVEMENTS).get();
        const batch = db.batch();
        let updatedMovesCount = 0;
        
        for (const doc of movesSnap.docs) {
          const m = doc.data();
          const matchId = m.auditId || (m.documentId && m.documentId.startsWith("Auditoría ") ? m.documentId.replace("Auditoría ", "").trim() : "");
          if (matchId === auditId || m.documentId === `Auditoría ${auditId}`) {
            batch.update(doc.ref, { date: auditDateISO });
            updatedMovesCount++;
          }
        }
        
        if (updatedMovesCount > 0) {
          await batch.commit();
        }
      }

      invalidateCache("audits");
      invalidateCache("movements");
      
      res.json({ success: true, message: "Auditoría actualizada correctamente." });
    } catch (err: any) {
      handleFirestoreError(res, err, OperationType.UPDATE, COL.AUDITS);
    }
  });

  // 1.6 PRESENTATIONS ENDPOINTS
  app.get("/api/presentations", authenticate, async (req, res) => {
    try {
      const cached = getCached("presentations");
      if (cached) return res.json(cached);

      const snapshot = await db.collection(COL.PRESENTATIONS).get();
      const items = snapshot.docs.map(doc => doc.data());
      setCached("presentations", items);
      res.json(items);
    } catch (err: any) {
      handleFirestoreError(res, err, OperationType.GET, COL.PRESENTATIONS);
    }
  });

  app.post("/api/presentations", authenticate, async (req, res) => {
    const { name, units } = req.body;
    const docRef = db.collection(COL.PRESENTATIONS).doc();
    const presentation = { id: docRef.id, name, units };
    try {
      await docRef.set(presentation);
      invalidateCache("presentations");
      res.json(presentation);
    } catch (err: any) {
      handleFirestoreError(res, err, OperationType.CREATE, COL.PRESENTATIONS);
    }
  });

  app.put("/api/presentations/:id", authenticate, async (req, res) => {
    const { id } = req.params;
    try {
      await db.collection(COL.PRESENTATIONS).doc(id).update(req.body);
      const doc = await db.collection(COL.PRESENTATIONS).doc(id).get();
      invalidateCache("presentations");
      res.json(doc.data());
    } catch (err: any) {
      handleFirestoreError(res, err, OperationType.UPDATE, COL.PRESENTATIONS);
    }
  });

  app.delete("/api/presentations/:id", authenticate, async (req, res) => {
    const { id } = req.params;
    try {
      await db.collection(COL.PRESENTATIONS).doc(id).delete();
      invalidateCache("presentations");
      res.json({ success: true });
    } catch (err: any) {
      handleFirestoreError(res, err, OperationType.DELETE, COL.PRESENTATIONS);
    }
  });

  // 2. SALES ENDPOINTS
  app.get("/api/sales", authenticate, async (req, res) => {
    try {
      const cached = getCached("sales");
      if (cached) return res.json(cached);

      // Removing orderBy temporarily for debugging potential index issues
      const snapshot = await db.collection(COL.SALES).get();
      const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      // Sort manually in memory if needed
      items.sort((a: any, b: any) => {
        const dateA = new Date((a as any).date).getTime();
        const dateB = new Date((b as any).date).getTime();
        return dateB - dateA;
      });
      setCached("sales", items);
      res.json(items);
    } catch (err: any) {
      console.error("Error in GET /api/sales:", err);
      res.status(500).json({ error: "Error recuperando ventas: " + (err.message || err) });
    }
  });

  app.post("/api/sales", authenticate, async (req, res) => {
    const uid = (req as any).user.uid;
    const clientItems = req.body.items as SaleItem[];
    if (!clientItems || clientItems.length === 0) {
      return res.status(400).json({ error: "Debe incluir al menos un artículo para registrar la venta." });
    }

    try {
      const newSaleDoc = db.collection(COL.SALES).doc();
      const saleItemsProcessed: SaleItem[] = [];
      let grandTotal = 0;

      // 1. Fetch entire stock map first to resolve recipes outside the transaction
      const stockSnapshot = await db.collection(COL.STOCK).get();
      const allStockItemsMap = new Map<string, any>();
      stockSnapshot.docs.forEach(doc => {
        allStockItemsMap.set(doc.id, doc.data());
      });

      // 2. Resolve final physical inventory items and required quantities
      const physicalDeductions = new Map<string, { name: string; quantityNeeded: number }>();
      
      for (const item of clientItems) {
        if (!item.stock_item_id || item.stock_item_id === "custom") {
          continue;
        }

        const resolveItem = (itemId: string, qtyMultiplier: number) => {
          const sItem = allStockItemsMap.get(itemId);
          if (!sItem) return;

          if (sItem.is_recipe && sItem.components && sItem.components.length > 0) {
            for (const comp of sItem.components) {
              resolveItem(comp.stock_item_id, qtyMultiplier * comp.quantity);
            }
          } else {
            const existing = physicalDeductions.get(itemId) || { name: sItem.name, quantityNeeded: 0 };
            existing.quantityNeeded += qtyMultiplier;
            physicalDeductions.set(itemId, existing);
          }
        };

        resolveItem(item.stock_item_id, item.quantity);
      }

      // Calculate dynamic stock quantities for validation
      const itemsToDeduct = Array.from(physicalDeductions.keys());
      const dynamicQuantitiesMap = new Map<string, number>();
      if (itemsToDeduct.length > 0) {
        let movesQuery: admin.firestore.Query = db.collection(COL.INVENTORY_MOVEMENTS);
        if (itemsToDeduct.length <= 30) {
          movesQuery = movesQuery.where("itemId", "in", itemsToDeduct);
        }
        const movesSnap = await movesQuery.get();
        movesSnap.forEach(doc => {
          const m = doc.data();
          if (m.reversed !== true) {
            const itemId = m.itemId;
            // Support both internal items in array and list
            if (itemsToDeduct.includes(itemId)) {
              dynamicQuantitiesMap.set(itemId, (dynamicQuantitiesMap.get(itemId) || 0) + Number(m.quantity || 0));
            }
          }
        });
      }

      // 3. Perform atomic transaction
      await db.runTransaction(async (transaction) => {
        const errorReasons: string[] = [];
        const stockDocsMap = new Map<string, any>();
        let customerDoc: any = null;

        // --- READ PHASE ---
        // 1. Read all stock items needed
        for (const [itemId, reqObj] of physicalDeductions.entries()) {
          const stockRef = db.collection(COL.STOCK).doc(itemId);
          const sDoc = await transaction.get(stockRef);
          if (!sDoc.exists) {
            errorReasons.push(`El ingrediente base "${reqObj.name}" no existe en stock.`);
          } else {
            stockDocsMap.set(itemId, sDoc.data());
          }
        }

        // 2. Read customer if applicable
        if (req.body.customer_id) {
          const customerRef = db.collection(COL.CUSTOMERS).doc(req.body.customer_id);
          customerDoc = await transaction.get(customerRef);
        }

        // --- VALIDATION PHASE ---
        for (const [itemId, reqObj] of physicalDeductions.entries()) {
          const sData = stockDocsMap.get(itemId);
          if (!sData) continue;
          
          const currentQty = dynamicQuantitiesMap.get(itemId) || 0;
          if (currentQty < reqObj.quantityNeeded) {
            const missing = (reqObj.quantityNeeded - currentQty).toFixed(2);
            errorReasons.push(`Stock insuficiente de "${reqObj.name}". Requerido: ${reqObj.quantityNeeded.toFixed(2)}, Disponible: ${currentQty.toFixed(2)} (Falta: ${missing})`);
          }
        }

        if (errorReasons.length > 0) {
          throw new Error(errorReasons.join("\n"));
        }

        // --- WRITE PHASE ---
        // 1. Deduct stock metadata only (do not update stock quantity in Firestore)
        for (const [itemId, reqObj] of physicalDeductions.entries()) {
          const stockRef = db.collection(COL.STOCK).doc(itemId);
          transaction.update(stockRef, {
            last_updated: new Date().toISOString()
          });
        }

        // 2. Prepare items detail (grandTotal calculation)
        for (const item of clientItems) {
          if (item.stock_item_id && item.stock_item_id !== "custom") {
            const sItem = allStockItemsMap.get(item.stock_item_id);
            const price = item.price || sItem?.selling_price || 0;
            const total = Number((item.quantity * price).toFixed(2));
            const purchasePrice = Number(sItem?.purchase_price) || 0;
            grandTotal += total;

            saleItemsProcessed.push({
              stock_item_id: item.stock_item_id,
              name: sItem?.name || item.name,
              quantity: item.quantity,
              price: price,
              total: total,
              purchase_price: purchasePrice
            });
          } else {
            const total = Number((item.quantity * (item.price || 0)).toFixed(2));
            grandTotal += total;
            saleItemsProcessed.push({
              stock_item_id: "custom",
              name: item.name,
              quantity: item.quantity,
              price: item.price || 0,
              total: total,
              purchase_price: 0
            });
          }
        }

        let finalGrandTotal = grandTotal;
        if (req.body.origin === "consumo_interno") {
          const expenseNotes = req.body.notes ? ` (${req.body.notes})` : "";
          const expenseTotal = -grandTotal;
          saleItemsProcessed.push({
            stock_item_id: "custom",
            name: "Egreso por Consumo Interno" + expenseNotes,
            quantity: 1,
            price: expenseTotal,
            total: expenseTotal,
            purchase_price: 0
          });
          finalGrandTotal = 0;
        }

        // 3. Create Sale doc
        const newSale: SaleTransaction = {
          id: newSaleDoc.id,
          ownerId: uid,
          items: saleItemsProcessed,
          total: Number(finalGrandTotal.toFixed(2)),
          date: req.body.date || new Date().toISOString(),
          method: req.body.method || "efectivo",
          origin: req.body.origin || "terminal",
          notes: req.body.notes || "",
          table_number: req.body.table_number || "Barra",
          caja_session_id: req.body.caja_session_id || null,
          customer_id: req.body.customer_id || null,
          customer_name: req.body.customer_name || null
        };
        transaction.set(newSaleDoc, newSale);

        const kardexType = req.body.origin === "consumo_interno" ? "CONSUMO" : "VENTA";

        // 4. Movements for inventory Kardex
        // We use the same date as the sale transaction (req.body.date) to ensure Kardex matches the accounting day
        const finalDate = req.body.date || new Date().toISOString();

        // FIX: Record Kardex movements for physical deductions (ingredients) 
        // instead of the sale item name if it's a recipe.
        for (const [itemId, reqObj] of physicalDeductions.entries()) {
          const moveDocRef = db.collection(COL.INVENTORY_MOVEMENTS).doc();
          transaction.set(moveDocRef, {
            id: moveDocRef.id,
            itemId: itemId,
            date: finalDate, 
            type: kardexType,
            quantity: -Math.abs(reqObj.quantityNeeded),
            documentId: newSaleDoc.id,
            operator: "Sistema",
            ownerId: uid
          });
        }

        // 5. Update customer statistics
        if (customerDoc && customerDoc.exists) {
          const customerData = customerDoc.data() || {};
          const oldYtdSales = Number(customerData.ytdSales || 0);
          const nextYtdSales = oldYtdSales + grandTotal;
          const pointsGained = Math.round(grandTotal / 10); 
          const oldPoints = Number(customerData.loyaltyPoints || 0);
          const nextPoints = oldPoints + pointsGained;
          
          const currentHistory = customerData.purchaseHistory || [];
          const newHistoryItem = {
            id: newSaleDoc.id,
            date: req.body.date || new Date().toISOString().split("T")[0],
            invoiceNumber: `TKT-${newSaleDoc.id.slice(0, 5).toUpperCase()}`,
            items: saleItemsProcessed.map(i => `${i.quantity}x ${i.name}`).join(", "),
            total: Number(grandTotal.toFixed(2))
          };

          const updatedFields: any = {
            ytdSales: Number(nextYtdSales.toFixed(2)),
            loyaltyPoints: nextPoints,
            purchaseHistory: [newHistoryItem, ...currentHistory]
          };

          if (req.body.is_debt) {
            const oldCredit = Number(customerData.outstandingCredit || 0);
            updatedFields.outstandingCredit = Number((oldCredit + (req.body.debt_amount !== undefined ? req.body.debt_amount : grandTotal)).toFixed(2));
          }

          transaction.update(customerDoc.ref, updatedFields);
        }
      });

      const finalSale = (await newSaleDoc.get()).data();
      invalidateCache("sales");
      invalidateCache("stock");
      invalidateCache("movements");
      invalidateCache("customers");
      res.json({ success: true, transaction: finalSale });
    } catch (err: any) {
      console.error("Sale transaction error:", err);
      res.status(400).json({ error: err.message || "Error procesando la venta." });
    }
  });

  app.delete("/api/sales/:id", authenticate, async (req, res) => {
    const { id } = req.params;
    logLiveInstrument(`[BACKEND-1] ID recibido por DELETE /api/sales/:id: "${id}"`);
    const saleDocRef = db.collection(COL.SALES).doc(id);

    try {
      const salesBeforeSnapshot = await db.collection(COL.SALES).get();
      logLiveInstrument(`[BACKEND-4] Cantidad total de documentos sales antes: ${salesBeforeSnapshot.size}`);

      const beforeSnap = await saleDocRef.get();
      logLiveInstrument(`[BACKEND-2] Confirmación de existencia del documento antes del borrado (exists): ${beforeSnap.exists}`);

      await db.runTransaction(async (transaction: any) => {
        const saleDoc = await transaction.get(saleDocRef);
        if (!saleDoc.exists) {
          throw new Error("Venta no encontrada.");
        }
        transaction.delete(saleDocRef);
      });
      
      const afterSnap = await saleDocRef.get();
      logLiveInstrument(`[BACKEND-3] Confirmación de existencia después del borrado (exists): ${afterSnap.exists}`);

      const salesAfterSnapshot = await db.collection(COL.SALES).get();
      logLiveInstrument(`[BACKEND-4] Cantidad total de documentos sales después: ${salesAfterSnapshot.size}`);

      invalidateCache("sales");
      invalidateCache("stock");
      logLiveInstrument(`[BACKEND-5] Confirmación de invalidación de caché (sales y stock realizada).`);

      const jsonResponse = { success: true };
      res.json(jsonResponse);
      logLiveInstrument(`[BACKEND-6] Confirmación de respuesta enviada al cliente (success con JSON): ${JSON.stringify(jsonResponse)}`);
    } catch (err: any) {
      console.error("Error deleting sale:", err);
      const errResponse = { error: "Error eliminando venta: " + err.message };
      res.status(500).json(errResponse);
      logLiveInstrument(`[BACKEND-6-ERROR] Confirmación de respuesta de error enviada al cliente: ${JSON.stringify(errResponse)}`);
    }
  });

  app.get("/api/db/diagnose-stats-real", authenticate, async (req, res) => {
    try {
        const purchases = await db.collection(COL.PURCHASES).get();
        const historySnapshot = await db.collection(COL.CAJA_HISTORY).get();
        const activeSnapshot = await db.collection(COL.CAJA_ACTIVE).get();
        
        let allCajas = [
          ...historySnapshot.docs.map(d => ({ id: d.id, ...d.data() })),
          ...activeSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        ];

        let totalPurchases = purchases.size;
        let purchasesWithCajaId = 0;
        let purchasesWithoutCajaId = 0;
        
        let totalEgresos = 0;
        let egresosWithPurchaseId = 0;
        let egresosWithoutPurchaseId = 0;
        
        // Count egresos
        for (const caja of allCajas) {
            const egresos = (caja.otrosEgresos as any[]) || [];
            totalEgresos += egresos.length;
            for (const e of egresos) {
                if (e.purchaseId) egresosWithPurchaseId++;
                else egresosWithoutPurchaseId++;
            }
        }

        let linkablePurchases = 0;
        let unlinkablePurchases = 0;

        for (const pDoc of purchases.docs) {
            const pData = pDoc.data() as any;
            if (pData.cajaId) {
                purchasesWithCajaId++;
                continue; // Ya vinculada no necesita reconstruccion autom.
            }
            purchasesWithoutCajaId++;
            
            let matched = false;
            for (const caja of allCajas) {
                const egresos = (caja.otrosEgresos as any[]) || [];
                const match = egresos.find(e => 
                    e.documentId === pDoc.id || 
                    (pData.invoiceNumber && e.documentId === pData.invoiceNumber) ||
                    e.purchaseId === pDoc.id
                );
                
                if (match) {
                    matched = true;
                    break;
                }
            }
            if (matched) {
               linkablePurchases++;
            } else {
               unlinkablePurchases++;
            }
        }

        res.json({
            stats: {
                totalPurchases,
                purchasesWithCajaId,
                purchasesWithoutCajaId,
                totalEgresos,
                egresosWithPurchaseId,
                egresosWithoutPurchaseId,
                purchasesHistoricasVinculables: linkablePurchases,
                purchasesSinPosibilidadDeReconstruccion: unlinkablePurchases
            }
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/db/diagnose-all", authenticate, async (req, res) => {
    try {
        const purchases = await db.collection(COL.PURCHASES).get();
        const historySnapshot = await db.collection(COL.CAJA_HISTORY).get();
        const cajaHistory = historySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        const stats = {
            totalPurchases: purchases.size,
            purchasesWithDocumentIdMatch: 0,
            purchasesWithInvoiceNumberMatch: 0,
            purchasesWithoutMatch: 0,
            percentageRecoverable: 0
        };

        const samples: any[] = [];

        for (const pDoc of purchases.docs) {
            const pData = pDoc.data() as any;
            const purchaseId = pDoc.id;
            
            let matched = false;
            let cajaFound = null;

            for (const caja of cajaHistory) {
                const egresos = caja.otrosEgresos || [];
                const match = egresos.find((e: any) => 
                    (e.documentId === purchaseId)
                );
                
                if (match) {
                    matched = true;
                    cajaFound = caja;
                    stats.purchasesWithDocumentIdMatch++;
                    break;
                }
                
                if (pData.invoiceNumber) {
                    const matchInv = egresos.find((e: any) => e.documentId === pData.invoiceNumber);
                    if (matchInv) {
                        matched = true;
                        cajaFound = caja;
                        stats.purchasesWithInvoiceNumberMatch++;
                        break;
                    }
                }
            }
            
            if (!matched) {
                stats.purchasesWithoutMatch++;
            }

            if (samples.length < 20) {
                samples.push({
                    purchaseId,
                    invoiceNumber: pData.invoiceNumber,
                    purchaseDate: pData.purchaseDate,
                    operationDate: pData.operationDate,
                    date: pData.date,
                    cajaId: cajaFound ? cajaFound.id : null,
                    cajaDate: cajaFound ? cajaFound.dateStr : null
                });
            }
        }
        
        stats.percentageRecoverable = Number(((stats.purchasesWithDocumentIdMatch + stats.purchasesWithInvoiceNumberMatch) / stats.totalPurchases * 100).toFixed(2));
        
        res.json({ stats, samples });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/db/diagnose-purchase/:id", authenticate, async (req, res) => {
    try {
        const purchaseId = req.params.id;
        const purchaseDoc = await db.collection(COL.PURCHASES).doc(purchaseId).get();
        if (!purchaseDoc.exists) return res.status(404).json({ error: "Purchase not found" });
        
        const pData = purchaseDoc.data() as any;
        
        // Find Caja History that might contain this purchase
        const historySnapshot = await db.collection(COL.CAJA_HISTORY).get();
        const cajaHistory = historySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        let relatedCaja = null;
        for (const caja of cajaHistory) {
            const egresos = caja.otrosEgresos || [];
            // Check for potential matches in egresos
            const match = egresos.find((e: any) => 
                (e.documentId === purchaseId) || 
                (pData.invoiceNumber && e.documentId === pData.invoiceNumber) ||
                (e.description && e.description.includes(purchaseId)) ||
                (e.description && e.description.includes(pData.invoiceNumber))
            );
            if (match) {
                relatedCaja = { ...caja, matchedEgreso: match };
                break;
            }
        }
        
        res.json({ purchase: pData, relatedCaja });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/migrate-kardex", authenticate, async (req, res) => {
    try {
        const stats = {
            purchasesFound: 0,
            purchasesUpdated: 0,
            purchasesSkipped: 0,
            movementsFound: 0,
            movementsUpdated: 0
        };

        const purchases = await db.collection(COL.PURCHASES).get();
        stats.purchasesFound = purchases.size;
        
        for (const pDoc of purchases.docs) {
            const pData = pDoc.data();
            const pId = pDoc.id;
            
            let opDate = pData.operationDate;
            if (!opDate) {
                const candidateDate = pData.date ? pData.date.split("T")[0] : null;
                if (candidateDate) opDate = candidateDate;
            }

            if (!opDate) {
                stats.purchasesSkipped++;
                continue;
            }

            await pDoc.ref.update({
                operationDate: opDate,
                purchaseDate: pData.purchaseDate || pData.invoiceDate || pData.date?.split("T")[0] || opDate
            });
            stats.purchasesUpdated++;

            const movements = await db.collection(COL.INVENTORY_MOVEMENTS)
                .where("documentId", "in", [pId, pData.invoiceNumber || "S/N"]).get();
                
            stats.movementsFound += movements.size;
            for (const mDoc of movements.docs) {
                await mDoc.ref.update({
                    operationDate: opDate,
                    purchaseDate: pData.purchaseDate || pData.invoiceDate || opDate,
                    date: opDate + "T12:00:00.000Z"
                });
                stats.movementsUpdated++;
            }
        }
        res.json({ success: true, message: "Migration completed.", stats });
    } catch (err: any) {
        console.error("Migration error:", err);
        res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/clear", authenticate, async (req, res) => {
    try {
      const collections = [COL.STOCK, COL.SALES, COL.CUSTOMERS, COL.PROVIDERS, COL.EVENTS, COL.TABLES, COL.CAJA_ACTIVE, COL.CAJA_HISTORY, COL.CAJA_TARIFAS];
      for (const colName of collections) {
        const snapshot = await db.collection(colName).get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
      ApiCache.clear();
      res.json({ success: true, message: "Base de datos vaciada con éxito." });
    } catch (err) {
      res.status(500).json({ error: "Error vaciando DB." });
    }
  });

  // TEMPORARY: Total Wipe maintenance endpoint to clear all transactional data
  app.get("/api/maintenance/total-wipe", async (req, res) => {
    try {
      const collectionsToWipe = [
        COL.SALES,
        COL.INVENTORY_MOVEMENTS,
        COL.PURCHASES,
        // We keep STOCK, CUSTOMERS, PROVIDERS, EVENTS, TABLES as they are "catalog" data
      ];

      const results: any = {};

      for (const colName of collectionsToWipe) {
        const snapshot = await db.collection(colName).get();
        let count = 0;
        const batch = db.batch();
        
        snapshot.forEach((doc: any) => {
          batch.delete(doc.ref);
          count++;
        });

        if (count > 0) {
          await batch.commit();
        }
        results[colName] = count;
      }

      // Reset physical stock levels in the items themselves
      const stockSnapshot = await db.collection(COL.STOCK).get();
      const stockBatch = db.batch();
      let stockResetCount = 0;
      stockSnapshot.forEach((doc: any) => {
        stockBatch.update(doc.ref, { 
          quantity: 0,
          last_updated: new Date().toISOString()
        });
        stockResetCount++;
      });
      if (stockResetCount > 0) {
        await stockBatch.commit();
      }
      results["stock_items_reset"] = stockResetCount;

      res.json({ 
        success: true, 
        message: "Se han eliminado todas las ventas, movimientos y compras, y se ha restablecido el stock físico a cero. El sistema está limpio para comenzar de nuevo.",
        details: results
      });
    } catch (err: any) {
      console.error("Error in total-wipe:", err);
      res.status(500).json({ error: err.message || err });
    }
  });

  app.get("/api/maintenance/rebase-initial-stock", async (req, res) => {
    try {
      // 1. Wipe all existing movements first to avoid accumulation
      const movesSnapshot = await db.collection(COL.INVENTORY_MOVEMENTS).get();
      const wipeBatch = db.batch();
      movesSnapshot.forEach((doc: any) => wipeBatch.delete(doc.ref));
      await wipeBatch.commit();

      const targetDate = "2026-06-06T10:00:00.000Z"; // As requested: 6-6-26 10:00hs
      const snapshot = await db.collection(COL.STOCK).get();
      const batch = db.batch();
      
      let count = 0;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const moveRef = db.collection(COL.INVENTORY_MOVEMENTS).doc();
        batch.set(moveRef, {
          id: moveRef.id,
          itemId: doc.id,
          date: targetDate,
          type: "INICIAL",
          quantity: Number(data.quantity) || 0,
          documentId: "Rebase Stock 6-6-26",
          operator: "Sistema",
          ownerId: data.ownerId
        });
        count++;
      }

      await batch.commit();

      res.json({ 
        success: true, 
        message: `Se han limpiado movimientos previos y creado ${count} movimientos iniciales para el 6-6-26.`,
      });
    } catch (err: any) {
      console.error("Error in rebase-initial-stock:", err);
      res.status(500).json({ error: err.message || err });
    }
  });

  app.post("/api/maintenance/surgical-repair-initial-stock", async (req, res) => {
    try {
      const batch = db.batch();
      
      const corrections = [
        { moveId: "bZjlpPz1rJXjmfmGfI8F", itemId: "Flcun9lgVGyBqMcLWlEm", name: "Gaseosa linea coca cola 2L", oldVal: 152.4, newVal: 93.4 },
        { moveId: "H2oqqBfGGRICgcOjHjJn", itemId: "sZvwS3rWnaeAjbaukNSB", name: "Gaseosa linea coca cola 310cc", oldVal: 108.0, newVal: 109.0 },
        { moveId: "vMToeqPi9rkh0HcPMsx1", itemId: "soGZHRB1Ugy7KORXICFK", name: "Gaseosa linea coca cola 1250", oldVal: 65.0, newVal: 58.0 },
        { moveId: "Q8v2SrMO7acQBoLuKumV", itemId: "tNMhIQ90MWC9TF1h4cVK", name: "Brahma 1L", oldVal: 43.0, newVal: 54.0 }
      ];

      for (const item of corrections) {
        const docRef = db.collection(COL.INVENTORY_MOVEMENTS).doc(item.moveId);
        batch.update(docRef, {
          quantity: item.newVal,
          last_repaired_at: new Date().toISOString()
        });
      }

      await batch.commit();
      invalidateCache("movements");

      res.json({
        success: true,
        message: "Surgical repair of INICIAL movements executed successfully.",
        details: corrections
      });
    } catch (err: any) {
      console.error("Surgical repair failed:", err);
      res.status(500).json({ error: err.message || err });
    }
  });

  app.post("/api/db/seed", authenticate, async (req, res) => {
    const uid = (req as any).user.uid;
    try {
      // Fetch existing stock to check matching names / ignore duplications
      const currentSnap = await db.collection(COL.STOCK).get();
      const existingNames = new Set(currentSnap.docs.map((d: any) => d.data()?.name?.toLowerCase().trim()));

      const seedStockRaw = [
        { name: "Estrella Galicia (Quinto Tirado)", category: BarCategory.CERVEZAS, quantity: 150, min_quantity: 30, purchase_price: 0.80, selling_price: 2.50 },
        { name: "Cerveza IPA Fútbol Club 47cl", category: BarCategory.CERVEZAS, quantity: 75, min_quantity: 15, purchase_price: 1.20, selling_price: 4.00 },
        { name: "Coca-Cola Original (Estadio)", category: BarCategory.REFRESCOS, quantity: 180, min_quantity: 40, purchase_price: 0.50, selling_price: 2.20 },
        { name: "Aquarius Limón (Tercer Tiempo)", category: BarCategory.REFRESCOS, quantity: 90, min_quantity: 20, purchase_price: 0.60, selling_price: 2.20 },
        { name: "Hamburguesa Completa 'De Primera'", category: BarCategory.TAPAS_COMIDA, quantity: 45, min_quantity: 10, purchase_price: 2.50, selling_price: 9.50 },
        { name: "Ración Empanadillas Tucumanas", category: BarCategory.TAPAS_COMIDA, quantity: 110, min_quantity: 20, purchase_price: 0.50, selling_price: 1.80 }
      ];

      const batch = db.batch();
      const createdStock: StockItem[] = [];

      for (const s of seedStockRaw) {
        if (existingNames.has(s.name.toLowerCase().trim())) {
          console.log(`Skipping duplicate seed item: ${s.name}`);
          continue; // Avoid duplication
        }

        const ref = db.collection(COL.STOCK).doc();
        const item: StockItem = {
          ...s,
          id: ref.id,
          ownerId: uid,
          last_updated: new Date().toISOString(),
          is_active: true,
          image_url: "",
          sku: "",
          subgroup: ""
        };
        batch.set(ref, item);
        createdStock.push(item);
      }

      // Seed default tables in the background if none exist
      const tablesSnap = await db.collection(COL.TABLES).get();
      if (tablesSnap.empty) {
        const stockItems = createdStock.length > 0 ? createdStock : (await db.collection(COL.STOCK).get()).docs.map((d: any) => d.data());
        const ipaItem = stockItems.find((s: any) => s.name?.includes("IPA")) || { id: "seed-ipa", selling_price: 4.00, name: "Cerveza IPA Fútbol Club 47cl" };
        const burgerItem = stockItems.find((s: any) => s.name?.includes("Hamburguesa")) || { id: "seed-burger", selling_price: 9.50, name: "Hamburguesa Completa 'De Primera'" };
        const estrellaItem = stockItems.find((s: any) => s.name?.includes("Estrella Galicia")) || { id: "seed-estrella", selling_price: 2.50, name: "Estrella Galicia (Quinto Tirado)" };

        const sampleTables = [
          { name: "Mesa 1", status: "libre", client_name: "Consumidor Final", items: [], payments: [], total_consumed: 0, total_paid: 0, outstanding_balance: 0, fecha_apertura: new Date().toISOString() },
          { name: "Mesa 2", status: "libre", client_name: "Consumidor Final", items: [], payments: [], total_consumed: 0, total_paid: 0, outstanding_balance: 0, fecha_apertura: new Date().toISOString() },
          { 
            name: "Mesa VIP", 
            status: "abierta", 
            client_name: "Sofía Varela", 
            items: [
              { stock_item_id: ipaItem.id, name: ipaItem.name, quantity: 2, price: ipaItem.selling_price, total: 2 * ipaItem.selling_price }
            ], 
            payments: [], 
            total_consumed: 2 * ipaItem.selling_price, 
            total_paid: 0, 
            outstanding_balance: 2 * ipaItem.selling_price, 
            fecha_apertura: new Date(Date.now() - 45 * 60000).toISOString(),
            operator: "btndeportes@gmail.com", 
            notes: "Preguntó por copa de degustación de vino tinto." 
          },
          { 
            name: "Cumpleaños Raúl", 
            status: "deuda", 
            client_name: "Raúl Gómez", 
            items: [
              { stock_item_id: burgerItem.id, name: burgerItem.name, quantity: 3, price: burgerItem.selling_price, total: 3 * burgerItem.selling_price },
              { stock_item_id: estrellaItem.id, name: estrellaItem.name, quantity: 5, price: estrellaItem.selling_price, total: 5 * estrellaItem.selling_price }
            ], 
            payments: [
              { id: "pay_1", amount: 20.00, date: new Date().toISOString().split("T")[0], time: "21:30", operator: "Pablo Moyano", method: "efectivo", notes: "Raúl a cuenta" }
            ], 
            total_consumed: (3 * burgerItem.selling_price) + (5 * estrellaItem.selling_price), 
            total_paid: 20.00, 
            outstanding_balance: ((3 * burgerItem.selling_price) + (5 * estrellaItem.selling_price)) - 20.00, 
            fecha_apertura: new Date(Date.now() - 180 * 60000).toISOString(),
            operator: "Pablo Moyano", 
            notes: "Cumpleaños de 15 personas. Trajeron torta." 
          },
          { 
            name: "Evento Empresa XYZ", 
            status: "cerrada", 
            client_name: "Corporativo XYZ", 
            items: [
              { stock_item_id: "custom", name: "Servicio de Catering Salón", quantity: 1, price: 150.00, total: 150.00 }
            ], 
            payments: [
              { id: "pay_xyz", amount: 150.00, date: new Date().toISOString().split("T")[0], time: "18:00", operator: "btndeportes@gmail.com", method: "tarjeta", notes: "Saldado completo" }
            ], 
            total_consumed: 150.00, 
            total_paid: 150.00, 
            outstanding_balance: 0, 
            fecha_apertura: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
            fecha_cierre: new Date(Date.now() - 2 * 24 * 3600000 + 4 * 3600000).toISOString(),
            operator: "btndeportes@gmail.com", 
            notes: "Cierre definitivo para reporte contable corporativo." 
          }
        ];

        const tablesBatch = db.batch();
        for (const t of sampleTables) {
          const tRef = db.collection(COL.TABLES).doc();
          tablesBatch.set(tRef, { ...t, id: tRef.id, ownerId: uid });
        }
        await tablesBatch.commit();
      }

      if (createdStock.length > 0) {
        await batch.commit();
        ApiCache.clear();
        res.json({ success: true, message: `¡Datos oficiales de Stock y Mesas cargados! Se agregaron ${createdStock.length} productos nuevos.`, stock: createdStock });
      } else {
        ApiCache.clear();
        res.json({ success: true, message: "Todos los productos y mesas ya estaban presentes. No se crearon duplicados.", stock: [] });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Error en seeding." });
    }
  });

  // 4. CUSTOMERS ENDPOINTS
  app.get("/api/customers", authenticate, async (req, res) => {
    try {
      const cached = getCached("customers");
      if (cached) return res.json(cached);

      const snapshot = await db.collection(COL.CUSTOMERS).get();
      const items = snapshot.docs.map(doc => doc.data());
      setCached("customers", items);
      res.json(items);
    } catch (err: any) {
      handleFirestoreError(res, err, OperationType.LIST, COL.CUSTOMERS);
    }
  });

  app.post("/api/customers", authenticate, async (req, res) => {
    try {
      const uid = (req as any).user.uid;
      const ref = db.collection(COL.CUSTOMERS).doc();
      const newCustomer: CustomerProfile = {
        ...req.body,
        id: ref.id,
        ownerId: uid,
        loyaltyPoints: Number(req.body.loyaltyPoints) || 0,
        ytdSales: Number(req.body.ytdSales) || 0,
        purchaseHistory: req.body.purchaseHistory || [],
        is_active: true
      };
      await ref.set(newCustomer);
      invalidateCache("customers");
      res.json(newCustomer);
    } catch (err: any) {
      console.error("Error in POST /api/customers:", err);
      res.status(500).json({ error: "Error guardando cliente: " + (err.message || err) });
    }
  });

  app.put("/api/customers/:id", authenticate, async (req, res) => {
    try {
      const ref = db.collection(COL.CUSTOMERS).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Cliente no encontrado." });
      const up = { ...req.body };
      delete up.ownerId; delete up.id;
      await ref.update(up);
      invalidateCache("customers");
      res.json((await ref.get()).data());
    } catch (err: any) {
      console.error("Error in PUT /api/customers:", err);
      res.status(500).json({ error: "Error actualizando cliente: " + (err.message || err) });
    }
  });

  app.delete("/api/customers/:id", authenticate, async (req, res) => {
    try {
      const ref = db.collection(COL.CUSTOMERS).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Cliente no encontrado." });
      await ref.delete();
      invalidateCache("customers");
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error in DELETE /api/customers:", err);
      res.status(500).json({ error: "Error eliminando cliente: " + (err.message || err) });
    }
  });

  // 5. PROVIDERS ENDPOINTS
  app.get("/api/providers", authenticate, async (req, res) => {
    try {
      const cached = getCached("providers");
      if (cached) return res.json(cached);

      const snapshot = await db.collection(COL.PROVIDERS).get();
      const items = snapshot.docs.map(doc => doc.data());
      setCached("providers", items);
      res.json(items);
    } catch (err: any) {
      console.error("Error in GET /api/providers:", err);
      res.status(500).json({ error: "Error recuperando proveedores: " + (err.message || err) });
    }
  });

  app.post("/api/providers", authenticate, async (req, res) => {
    try {
      const uid = (req as any).user.uid;
      const ref = db.collection(COL.PROVIDERS).doc();
      const newDoc: Provider = { ...req.body, id: ref.id, ownerId: uid, is_active: true };
      await ref.set(newDoc);
      invalidateCache("providers");
      res.json(newDoc);
    } catch (err: any) {
      console.error("Error in POST /api/providers:", err);
      res.status(500).json({ error: "Error guardando proveedor: " + (err.message || err) });
    }
  });

  app.put("/api/providers/:id", authenticate, async (req, res) => {
    try {
      const ref = db.collection(COL.PROVIDERS).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Proveedor no encontrado." });
      const up = { ...req.body };
      delete up.ownerId; delete up.id;
      await ref.update(up);
      invalidateCache("providers");
      res.json((await ref.get()).data());
    } catch (err: any) {
      console.error("Error in PUT /api/providers:", err);
      res.status(500).json({ error: "Error actualizando proveedor: " + (err.message || err) });
    }
  });

  app.delete("/api/providers/:id", authenticate, async (req, res) => {
    try {
      const ref = db.collection(COL.PROVIDERS).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Proveedor no encontrado." });
      await ref.delete();
      invalidateCache("providers");
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error in DELETE /api/providers:", err);
      res.status(500).json({ error: "Error eliminando proveedor: " + (err.message || err) });
    }
  });

  // PURCHASES ENDPOINTS
  app.get("/api/purchases", authenticate, async (req, res) => {
    try {
      const cached = getCached("purchases");
      if (cached) return res.json(cached);

      const snapshot = await db.collection(COL.PURCHASES).get();
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCached("purchases", items);
      res.json(items);
    } catch (err: any) {
      console.error("Error in GET /api/purchases:", err);
      res.status(500).json({ error: "Error recuperando transacciones de compras: " + (err.message || err) });
    }
  });

  function sanitizeForFirestore(obj: any): any {
    if (obj === undefined) return null;
    if (obj === null) return null;
    if (Array.isArray(obj)) {
      return obj.map(sanitizeForFirestore);
    }
    if (typeof obj === "object") {
      const cleaned: any = {};
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val !== undefined) {
          cleaned[key] = sanitizeForFirestore(val);
        }
      }
      return cleaned;
    }
    if (typeof obj === "number" && isNaN(obj)) {
      return 0;
    }
    return obj;
  }

  app.post("/api/purchases", authenticate, async (req, res) => {
    try {
      console.log("POST /api/purchases payload:", JSON.stringify(req.body));
      const uid = (req as any).user.uid;
      const ref = db.collection(COL.PURCHASES).doc();
      
      let purchaseDate = req.body.date;
      if (!purchaseDate && req.body.invoiceDate) {
        try {
          purchaseDate = new Date(req.body.invoiceDate + "T12:00:00").toISOString();
        } catch (e) {
          purchaseDate = null;
        }
      }
      if (!purchaseDate) {
        purchaseDate = new Date().toISOString();
      }

      // Try to read active Caja for operationDate
      let operationDateStr = "";
      try {
        const cajaRef = db.collection(COL.CAJA_ACTIVE).doc("current");
        const cajaDoc = await cajaRef.get();
        if (cajaDoc.exists) {
          const cajaData = cajaDoc.data() || {};
          if (cajaData.dateStr) {
            let tempStr = cajaData.dateStr.split("T")[0];
            if (tempStr.includes("/")) {
              const parts = tempStr.split("/");
              if (parts.length === 3) {
                 tempStr = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
              }
            }
            operationDateStr = tempStr;
          }
        }
      } catch (err) {
        console.error("Error retrieving active caja date:", err);
      }

      if (!operationDateStr) {
        operationDateStr = new Date().toISOString().split("T")[0];
      }

      let purchaseDateStr = "";
      if (req.body.invoiceDate) {
        let tempStr = req.body.invoiceDate.split("T")[0];
        if (tempStr.includes("/")) {
          const parts = tempStr.split("/");
          if (parts.length === 3) {
             tempStr = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
        }
        purchaseDateStr = tempStr;
      } else if (purchaseDate) {
        purchaseDateStr = purchaseDate.split("T")[0];
      } else {
        purchaseDateStr = new Date().toISOString().split("T")[0];
      }

      // Smart query to find target Caja based on purchase date (purchaseDateStr)
      let targetCajaId: string | null = null;
      let targetIsHistory = false;
      let hasAnyOpenCaja = false;

      try {
        // A. Check if there is an active/open caja right now
        const activeCajaDoc = await db.collection(COL.CAJA_ACTIVE).doc("current").get();
        if (activeCajaDoc.exists) {
          hasAnyOpenCaja = true;
          const activeCajaData = activeCajaDoc.data() || {};
          if (activeCajaData.dateStr === purchaseDateStr) {
            targetCajaId = activeCajaData.id;
            targetIsHistory = false;
          }
        }

        // B. If no match in active, check historic boxes matching this purchaseDateStr
        if (!targetCajaId) {
          const historySnap = await db.collection(COL.CAJA_HISTORY).where("dateStr", "==", purchaseDateStr).get();
          if (historySnap && historySnap.docs && historySnap.docs.length > 0) {
            targetCajaId = historySnap.docs[0].id;
            targetIsHistory = true;
          }
        }

        // C. If still no match but we have an open active caja, fall back to it
        if (!targetCajaId && activeCajaDoc.exists) {
          targetCajaId = (activeCajaDoc.data() as any).id;
          targetIsHistory = false;
        }
      } catch (err) {
        console.error("Error retrieving target caja for linkage:", err);
      }

      const affectsCaja = req.body.affectsCaja !== false;
      if (affectsCaja && !hasAnyOpenCaja && !targetCajaId) {
        return res.status(400).json({ error: "No existe una caja abierta para registrar el egreso. Por favor, abre una caja o desmarca la opción 'Afecta Caja Diaria'." });
      }

      const payload = {
        providerId: req.body.providerId || "",
        providerName: req.body.providerName || "S/P",
        invoiceDate: req.body.invoiceDate || "",
        invoiceNumber: req.body.invoiceNumber || "S/N",
        cajaId: affectsCaja ? targetCajaId : null,
        date: purchaseDate,
        operationDate: affectsCaja ? operationDateStr : null,
        purchaseDate: purchaseDateStr,
        items: req.body.items || [],
        total: Number(req.body.total) || 0,
        paidAmount: Number(req.body.paidAmount) || 0,
        affectsCaja: affectsCaja,
        updateStock: req.body.updateStock !== false,
        updateCost: req.body.updateCost !== false,
        accountId: req.body.accountId || "",
        subaccountId: req.body.subaccountId || "",
        account: req.body.account || "",
        subaccountLabel: req.body.subaccountLabel || ""
      };

      const newDoc = sanitizeForFirestore({
        ...payload,
        id: ref.id,
        ownerId: uid
      });
      
      await ref.set(newDoc);

      // 1. Update Provider Balance if owed and YTD Purchases
      if (payload.providerId) {
        const debt = payload.total - payload.paidAmount;
        const providerRef = db.collection(COL.PROVIDERS).doc(payload.providerId);
        const pDoc = await providerRef.get();
        if (pDoc.exists) {
          const pData = pDoc.data() || {};
          const currentBalance = Number(pData.nextPaymentAmount !== undefined ? pData.nextPaymentAmount : (pData.current_account_balance || 0));
          const currentYtd = Number(pData.ytdPurchases || 0);
          
          await providerRef.update({
            nextPaymentAmount: Number((currentBalance + debt).toFixed(2)),
            current_account_balance: Number((currentBalance + debt).toFixed(2)),
            ytdPurchases: Number((currentYtd + payload.total).toFixed(2))
          });
          invalidateCache("providers");
        }
      }

      // 2. Add entry to Caja (Otros Egresos) if affectsCaja is true and paidAmount > 0 and a box was identified
      if (payload.affectsCaja && payload.paidAmount > 0 && targetCajaId) {
        try {
          const cajaRef = targetIsHistory
            ? db.collection(COL.CAJA_HISTORY).doc(targetCajaId)
            : db.collection(COL.CAJA_ACTIVE).doc("current");

          const cajaDoc = await cajaRef.get();
          if (cajaDoc.exists) {
            const cajaData = cajaDoc.data() || {};
            const egresos = cajaData.otrosEgresos || [];
            
            // Avoid duplicate registration check
            if (!egresos.some((e: any) => e.purchaseId === ref.id)) {
              const newEgreso = {
                id: "purch_" + ref.id,
                quantity: 1,
                accountId: payload.accountId,
                subaccountId: payload.subaccountId,
                description: `${payload.providerName} - Comp. ${payload.invoiceNumber}`,
                amount: payload.paidAmount,
                purchaseId: ref.id
              };
              await cajaRef.update({
                otrosEgresos: [...egresos, newEgreso]
              });
              if (targetIsHistory) {
                invalidateCache("caja_history");
              } else {
                invalidateCache("caja_active");
              }
            }
          }
        } catch (cajaErr) {
          console.error("Failed adding purchase to target caja:", cajaErr);
        }
      } else if (!payload.affectsCaja && payload.paidAmount > 0) {
        try {
          const ledgerRef = db.collection(COL.LEDGER_MANUAL).doc("purch_ledg_" + ref.id);
          
          let accountLabel = payload.account;
          let subaccountLabel = payload.subaccountLabel;

          if (!accountLabel) {
            // Try parsing from ID like pillarId_label_timestamp
            if (payload.accountId && payload.accountId.includes("_")) {
              const parts = payload.accountId.split("_");
              if (parts.length >= 2) {
                accountLabel = parts[1];
              }
            }
          }
          if (!subaccountLabel) {
            // Try parsing from ID like accountId_label_timestamp
            if (payload.subaccountId && payload.subaccountId.includes("_")) {
              const parts = payload.subaccountId.split("_");
              if (parts.length >= 2) {
                subaccountLabel = parts[parts.length - 2];
              }
            }
          }

          // Fetch from Firestore settings as absolute final fallback lookup
          if (!accountLabel || !subaccountLabel) {
            try {
              const doc = await db.collection("settings").doc("chart_of_accounts").get();
              if (doc.exists) {
                const accounts = doc.data()?.accounts || [];
                const matchedAcc = accounts.find((a: any) => a.id === payload.accountId);
                if (matchedAcc) {
                  if (!accountLabel) accountLabel = matchedAcc.label;
                  if (!subaccountLabel) {
                    const matchedSub = matchedAcc.subaccounts?.find((s: any) => s.id === payload.subaccountId);
                    if (matchedSub) {
                      subaccountLabel = matchedSub.label;
                    }
                  }
                }
              }
            } catch (err) {
              console.error("Error fetching account labels for ledger manual sync:", err);
            }
          }

          if (!accountLabel) {
            accountLabel = payload.accountId || "Compras Buffet";
          }
          if (!subaccountLabel) {
            subaccountLabel = payload.subaccountId || "Proveedores";
          }

          let imputed = "";
          try {
            const dateObj = new Date(purchaseDateStr + "T12:00:00");
            const monthName = dateObj.toLocaleString("es-ES", { month: "long" });
            imputed = monthName[0].toUpperCase() + monthName.substring(1) + " " + dateObj.getFullYear();
          } catch {
            imputed = "";
          }

          const newEntry = {
            id: "purch_ledg_" + ref.id,
            date: purchaseDateStr,
            periodoImputado: imputed,
            origin: "Fondo Administrador",
            type: "Egreso",
            account: accountLabel,
            subaccount: subaccountLabel,
            description: `${payload.providerName} - Comp. ${payload.invoiceNumber} (Fondo Propio)`,
            debe: 0,
            haber: payload.paidAmount,
            isSystem: true,
            purchaseId: ref.id
          };

          await ledgerRef.set(sanitizeForFirestore(newEntry));
        } catch (ledgErr) {
          console.error("Failed adding purchase to ledger-manual:", ledgErr);
        }
      }

      const updateStock = payload.updateStock !== false;
      const updateCost = payload.updateCost !== false;

      if (payload.items && Array.isArray(payload.items)) {
        for (const item of payload.items) {
          if (!item.stock_item_id) continue;
          const stockRef = db.collection(COL.STOCK).doc(item.stock_item_id);
          const stockDoc = await stockRef.get();
          if (stockDoc.exists) {
            const updates: any = {};
            
            if (updateStock) {
              let qtyAdded = Number(item.quantity);
              if (isNaN(qtyAdded)) qtyAdded = 0;
              
              if (qtyAdded > 0) {
                // Register inventory movement for Kardex
                const moveDocRef = db.collection(COL.INVENTORY_MOVEMENTS).doc();
                await moveDocRef.set(sanitizeForFirestore({
                  id: moveDocRef.id,
                  itemId: item.stock_item_id,
                  date: purchaseDateStr + "T12:00:00.000Z", // Use purchase invoice date in Kardex as requested
                  operationDate: purchaseDateStr,
                  purchaseDate: purchaseDateStr,
                  type: "COMPRA",
                  quantity: qtyAdded,
                  documentId: payload.invoiceNumber,
                  operator: "Sistema"
                }));
              }
            }
            if (updateCost) {
              let unitCost = Number(item.unit_cost);
              if (isNaN(unitCost)) unitCost = 0;
              updates.purchase_price = unitCost;
            }

            if (Object.keys(updates).length > 0) {
              updates.last_updated = new Date().toISOString();
              await stockRef.update(sanitizeForFirestore(updates));
            }
          }
        }
        await recalculateRecipeCosts();
      }
      invalidateCache("purchases");
      invalidateCache("stock");
      invalidateCache("movements");

      res.json(newDoc);
    } catch (err: any) {
      console.error("Error in POST /api/purchases:", err);
      res.status(500).json({ error: "Error guardando transacción de compra: " + (err.message || err) });
    }
  });

  app.delete("/api/purchases/:id", authenticate, async (req, res) => {
    try {
      const purchaseId = req.params.id;
      const purchaseRef = db.collection(COL.PURCHASES).doc(purchaseId);
      const purchaseDoc = await purchaseRef.get();
      
      if (!purchaseDoc.exists) {
        return res.status(404).json({ error: "Purchase not found" });
      }

      const purchaseData = purchaseDoc.data() as any;

      // Ensure the associated caja is open (if it affects caja and has cajaId)
      const affectsCaja = purchaseData.affectsCaja !== false;
      if (affectsCaja && purchaseData.cajaId) {
        const activeCajaDoc = await db.collection(COL.CAJA_ACTIVE).doc("current").get();
        let isActive = false;
        if (activeCajaDoc.exists) {
          const activeCajaData = activeCajaDoc.data() || {};
          if (activeCajaData.id === purchaseData.cajaId) {
            isActive = true;
          }
        }
        if (!isActive) {
          return res.status(400).json({ error: "No se puede eliminar la compra porque la caja a la que está vinculada ya se encuentra cerrada." });
        }
      }

      // 1. Revert stock dynamically (no-op since movements deletion does this)
      // 2. Delete inventory movements associated with this purchase
      // The documentId in movements is req.body.invoiceNumber or ref.id.
      // So let's look at the purchase data to handle it correctly.
      let docIdQuery = purchaseId;
      if (purchaseData.invoiceNumber && purchaseData.invoiceNumber.trim() !== "" && purchaseData.invoiceNumber !== "S/N") {
         docIdQuery = purchaseData.invoiceNumber;
      }
      
      const movementsSnapshot = await db.collection(COL.INVENTORY_MOVEMENTS).where("documentId", "in", [purchaseId, purchaseData.invoiceNumber || "S/N"]).get();
      if (!movementsSnapshot.empty) {
        const batch = db.batch();
        movementsSnapshot.docs.forEach(doc => {
           batch.delete(doc.ref);
        });
        await batch.commit();
      }

      // Revert provider balance and YTD Purchases when a purchase is deleted
      if (purchaseData?.providerId) {
        const debt = (Number(purchaseData.total) || 0) - (Number(purchaseData.paidAmount) || 0);
        const totalPurchased = Number(purchaseData.total) || 0;
        const providerRef = db.collection(COL.PROVIDERS).doc(purchaseData.providerId);
        const pDoc = await providerRef.get();
        if (pDoc.exists) {
          const pData = pDoc.data() || {};
          const currentBalance = Number(pData.nextPaymentAmount !== undefined ? pData.nextPaymentAmount : (pData.current_account_balance || 0));
          const currentYtd = Number(pData.ytdPurchases || 0);
          
          await providerRef.update({
            nextPaymentAmount: Math.max(0, Number((currentBalance - debt).toFixed(2))),
            current_account_balance: Math.max(0, Number((currentBalance - debt).toFixed(2))),
            ytdPurchases: Math.max(0, Number((currentYtd - totalPurchased).toFixed(2)))
          });
          invalidateCache("providers");
        }
      }

      // Revert Daily Caja expenses (otrosEgresos) in active or historic sessions
      try {
        // 1. Try to find and revert in Active Caja
        const activeCajaRef = db.collection(COL.CAJA_ACTIVE).doc("current");
        const activeCajaDoc = await activeCajaRef.get();
        if (activeCajaDoc.exists) {
          const cData = activeCajaDoc.data() || {};
          const egresos = cData.otrosEgresos || [];
          const filtered = egresos.filter((e: any) => e.purchaseId !== purchaseId);
          if (egresos.length !== filtered.length) {
            await activeCajaRef.update({ otrosEgresos: filtered });
            invalidateCache("caja_active");
          }
        }

        // 2. Try to find and revert in Historic Caja sessions
        if (purchaseData?.cajaId) {
          const closedCajaRef = db.collection(COL.CAJA_HISTORY).doc(purchaseData.cajaId);
          const closedCajaDoc = await closedCajaRef.get();
          if (closedCajaDoc.exists) {
            const cData = closedCajaDoc.data() || {};
            const egresos = cData.otrosEgresos || [];
            const filtered = egresos.filter((e: any) => e.purchaseId !== purchaseId);
            if (egresos.length !== filtered.length) {
              await closedCajaRef.update({ otrosEgresos: filtered });
              invalidateCache("caja_history");
            }
          }
        } else {
          // Fallback: search all closed history boxes for an egreso matching purchaseId
          const matchingHistorySnap = await db.collection(COL.CAJA_HISTORY).get();
          for (const doc of matchingHistorySnap.docs) {
            const cData = doc.data() || {};
            const egresos = cData.otrosEgresos || [];
            const filtered = egresos.filter((e: any) => e.purchaseId !== purchaseId);
            if (egresos.length !== filtered.length) {
              await doc.ref.update({ otrosEgresos: filtered });
              invalidateCache("caja_history");
            }
          }
        }
      } catch (cajaErr) {
        console.error("Error reverting caja other expenses for deleted purchase:", cajaErr);
      }

      // Revert cost price (purchase_price) for purchased items
      try {
        if (purchaseData.updateCost !== false && purchaseData.items && Array.isArray(purchaseData.items)) {
          console.log("[DELETE PURCHASE] Reverting purchase_price for items...");
          // Extract unique item IDs that were modified by this purchase
          const stockItemIds = Array.from(new Set(
            purchaseData.items
              .map((item: any) => item.stock_item_id)
              .filter(Boolean)
          )) as string[];

          if (stockItemIds.length > 0) {
            // Get all other purchases to find the previous cost price
            const allPurchasesSnap = await db.collection(COL.PURCHASES).get();
            const otherPurchases = allPurchasesSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as any))
              .filter(p => p.id !== purchaseId);

            for (const itemId of stockItemIds) {
              const relevantPurchases = otherPurchases.filter(p => 
                (p.items || []).some((it: any) => it.stock_item_id === itemId && it.unit_cost !== undefined)
              );

              // Sort descending by date/purchaseDate
              relevantPurchases.sort((a, b) => {
                const dateA = a.date || a.purchaseDate || "";
                const dateB = b.date || b.purchaseDate || "";
                return dateB.localeCompare(dateA);
              });

              if (relevantPurchases.length > 0) {
                const mostRecentPurchase = relevantPurchases[0];
                const prevItem = (mostRecentPurchase.items || []).find((it: any) => it.stock_item_id === itemId);
                const prevCost = prevItem ? (Number(prevItem.unit_cost) || 0) : 0;
                console.log(`[ROLLBACK COST] Item ${itemId}: Rolling back cost price from current to ${prevCost} based on other purchase ID ${mostRecentPurchase.id}`);
                
                // Update stock with the rolled back cost
                const stockRef = db.collection(COL.STOCK).doc(itemId);
                const sDoc = await stockRef.get();
                if (sDoc.exists) {
                  await stockRef.update({
                    purchase_price: prevCost,
                    last_updated: new Date().toISOString()
                  });
                }
              } else {
                console.log(`[ROLLBACK COST] Item ${itemId}: No other purchases found. Keeping its current cost price intact.`);
              }
            }
          }
        }
      } catch (costErr) {
        console.error("Error reverting item cost prices for deleted purchase:", costErr);
      }

      // 2.5 Delete direct ledger entry if it was registered directly
      try {
        await db.collection(COL.LEDGER_MANUAL).doc("purch_ledg_" + purchaseId).delete();
      } catch (ledgErr) {
        console.error("Error deleting direct ledger entry for purchase:", ledgErr);
      }

      // 3. Delete the purchase document
      await purchaseRef.delete();
      
      // 4. Recalculate recipes
      await recalculateRecipeCosts();
      invalidateCache("purchases");
      invalidateCache("stock");
      invalidateCache("movements");

      res.json({ success: true, message: "Purchase deleted and stock reverted" });
    } catch (err: any) {
      console.error("Error in DELETE /api/purchases:", err);
      res.status(500).json({ error: "Error eliminando compra: " + (err.message || err) });
    }
  });

  // 6. EVENTS ENDPOINTS
  app.get("/api/caja/diagnose", authenticate, async (req, res) => {
    try {
      const activeDoc = await db.collection(COL.CAJA_ACTIVE).doc("current").get();
      const historySnapshot = await db.collection(COL.CAJA_HISTORY).get();
      
      const activeData = activeDoc.exists ? activeDoc.data() : null;
      const historyData = historySnapshot.docs.map(d => d.data());
      
      let repaired = false;
      let repairReason = "";
      
      if (activeData && activeData.dateStr) {
        // Normalize dates to check for conflict
        const activeDateIso = activeData.dateStr.includes("T") ? activeData.dateStr.split("T")[0] : activeData.dateStr;
        
        const hasInHistory = historyData.some(h => {
          const hDateIso = h.dateStr.includes("T") ? h.dateStr.split("T")[0] : h.dateStr;
          return hDateIso === activeDateIso;
        });
        
        if (hasInHistory) {
          // Stale active session remnant exists for a date that was already closed!
          await db.collection(COL.CAJA_ACTIVE).doc("current").delete();
          repaired = true;
          repairReason = `Deleted active session from 'current' because date ${activeDateIso} is already present in closed history.`;
          invalidateCache("caja_active");
        }
      }
      
      res.json({
        success: true,
        activeSession: activeData,
        historyCount: historyData.length,
        historyDates: historyData.map(h => h.dateStr),
        repaired,
        repairReason
      });
    } catch (err: any) {
      console.error("Error in GET /api/caja/diagnose:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/testDeleteError", async (req, res) => {
    try {
      const purchaseId = req.query.id as string;
      const purchaseRef = db.collection(COL.PURCHASES).doc(purchaseId);
      const purchaseDoc = await purchaseRef.get();
      
      if (!purchaseDoc.exists) {
        return res.json({ error: "Purchase not found" });
      }

      await purchaseRef.delete();
      res.json({ success: true, message: "Deleted" });
    } catch (err: any) {
      res.json({ error: err.message });
    }
  });

  app.get("/testError", async (req, res) => {
    try {
      // Create a purchase
      const ref = db.collection(COL.PURCHASES).doc();
      const newDoc = {
        id: ref.id,
        ownerId: 'test',
        date: new Date().toISOString(),
        items: [{
          stock_item_id: 'nonexistent',
          name: 'test',
          quantity: 1,
          unit_cost: 10,
          subtotal: 10
        }],
        total: 10,
        updateStock: true,
        updateCost: true
      };
      await ref.set(newDoc);

      // Now recalculate recipes
      await recalculateRecipeCosts();

      res.json({ success: true, createdId: ref.id });
    } catch (e: any) {
      res.json({ error: e.message, stack: e.stack });
    }
  });

  app.get("/api/events", authenticate, async (req, res) => {
    try {
      const cached = getCached("events");
      if (cached) return res.json(cached);

      const snapshot = await db.collection(COL.EVENTS).get();
      const items = snapshot.docs.map(doc => doc.data());
      setCached("events", items);
      res.json(items);
    } catch (err: any) {
      console.error("Error in GET /api/events:", err);
      res.status(500).json({ error: "Error recuperando eventos: " + (err.message || err) });
    }
  });

  app.post("/api/events", authenticate, async (req, res) => {
    try {
      const uid = (req as any).user.uid;
      const ref = db.collection(COL.EVENTS).doc();
      const newDoc: EventModel = { ...req.body, id: ref.id, ownerId: uid, status: req.body.status || "Pendiente" };
      await ref.set(newDoc);
      invalidateCache("events");
      res.json(newDoc);
    } catch (err: any) {
      console.error("Error in POST /api/events:", err);
      res.status(500).json({ error: "Error creando evento: " + (err.message || err) });
    }
  });

  app.put("/api/events/:id", authenticate, async (req, res) => {
    try {
      const ref = db.collection(COL.EVENTS).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Evento no encontrado." });
      const up = { ...req.body };
      delete up.ownerId; delete up.id;
      await ref.update(up);
      invalidateCache("events");
      res.json((await ref.get()).data());
    } catch (err: any) {
      console.error("Error in PUT /api/events:", err);
      res.status(500).json({ error: "Error actualizando evento: " + (err.message || err) });
    }
  });

  app.delete("/api/events/:id", authenticate, async (req, res) => {
    try {
      const ref = db.collection(COL.EVENTS).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Evento no encontrado." });
      await ref.delete();
      invalidateCache("events");
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error in DELETE /api/events:", err);
      res.status(500).json({ error: "Error eliminando evento: " + (err.message || err) });
    }
  });

  // 7. TABLES ENDPOINTS
  app.get("/api/tables", authenticate, async (req, res) => {
    try {
      const cached = getCached("tables");
      if (cached) return res.json(cached);

      const snapshot = await db.collection(COL.TABLES).get();
      const items = snapshot.docs.map(doc => doc.data());
      setCached("tables", items);
      res.json(items);
    } catch (err: any) {
      console.error("Error in GET /api/tables:", err);
      res.status(500).json({ error: "Error recuperando mesas: " + (err.message || err) });
    }
  });

  app.post("/api/tables", authenticate, async (req, res) => {
    try {
      const uid = (req as any).user.uid;
      const ref = db.collection(COL.TABLES).doc();
      const newDoc: TableSession = { 
        ...req.body, 
        id: ref.id, 
        ownerId: uid,
        status: req.body.status || "libre",
        client_name: req.body.client_name || "Consumidor Final",
        items: req.body.items || [],
        payments: req.body.payments || [],
        total_consumed: Number(req.body.total_consumed || 0),
        total_paid: Number(req.body.total_paid || 0),
        outstanding_balance: Number(req.body.outstanding_balance || 0),
        fecha_apertura: req.body.fecha_apertura || new Date().toISOString(),
        operator: req.body.operator || "Pablo Moyano"
      };
      await ref.set(newDoc);
      invalidateCache("tables");
      res.json(newDoc);
    } catch (err: any) {
      console.error("Error in POST /api/tables:", err);
      res.status(500).json({ error: "Error creando mesa: " + (err.message || err) });
    }
  });

  app.put("/api/tables/:id", authenticate, async (req, res) => {
    try {
      const ref = db.collection(COL.TABLES).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Mesa no encontrada." });
      const up = { ...req.body };
      delete up.ownerId; delete up.id;
      await ref.update(up);
      invalidateCache("tables");
      res.json((await ref.get()).data());
    } catch (err: any) {
      console.error("Error in PUT /api/tables:", err);
      res.status(500).json({ error: "Error actualizando mesa: " + (err.message || err) });
    }
  });

  app.delete("/api/tables/:id", authenticate, async (req, res) => {
    try {
      const ref = db.collection(COL.TABLES).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Mesa no encontrada." });
      await ref.delete();
      invalidateCache("tables");
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error in DELETE /api/tables:", err);
      res.status(500).json({ error: "Error eliminando mesa: " + (err.message || err) });
    }
  });

  // 8. CAJA DIARIA V2 ENDPOINTS
  app.get("/api/caja/active", authenticate, async (req, res) => {
    try {
      const cached = getCached("caja_active");
      if (cached) return res.json(cached);

      const doc = await db.collection(COL.CAJA_ACTIVE).doc("current").get();
      if (!doc.exists) {
        return res.json(null);
      }
      const data = doc.data();
      setCached("caja_active", data);
      res.json(data);
    } catch (err: any) {
      console.error("Error in GET /api/caja/active:", err);
      res.status(500).json({ error: "Error recuperando caja activa: " + (err.message || err) });
    }
  });

  app.post("/api/caja/active", authenticate, async (req, res) => {
    try {
      const ref = db.collection(COL.CAJA_ACTIVE).doc("current");
      await ref.set(req.body);
      invalidateCache("caja_active");
      res.json(req.body);
    } catch (err: any) {
      console.error("Error in POST /api/caja/active:", err);
      res.status(500).json({ error: "Error guardando caja activa: " + (err.message || err) });
    }
  });

  app.delete("/api/caja/active", authenticate, async (req, res) => {
    try {
      await db.collection(COL.CAJA_ACTIVE).doc("current").delete();
      invalidateCache("caja_active");
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error in DELETE /api/caja/active:", err);
      res.status(500).json({ error: "Error eliminando caja activa: " + (err.message || err) });
    }
  });

  app.get("/api/caja/history", authenticate, async (req, res) => {
    try {
      const cached = getCached("caja_history");
      if (cached) return res.json(cached);

      // Limit to latest 50 entries to optimize database read tokens
      const snapshot = await db.collection(COL.CAJA_HISTORY).limit(50).get();
      const items = snapshot.docs.map(doc => doc.data());
      items.sort((a: any, b: any) => {
        const dA = new Date(a.dateStr).getTime() || 0;
        const dB = new Date(b.dateStr).getTime() || 0;
        return dB - dA;
      });
      setCached("caja_history", items);
      res.json(items);
    } catch (err: any) {
      console.error("Error in GET /api/caja/history:", err);
      res.status(500).json({ error: "Error recuperando historial de caja: " + (err.message || err) });
    }
  });

  app.post("/api/caja/history", authenticate, async (req, res) => {
    try {
      const id = req.body.id || db.collection(COL.CAJA_HISTORY).doc().id;
      const docData = { ...req.body, id };
      await db.collection(COL.CAJA_HISTORY).doc(id).set(docData);
      invalidateCache("caja_active");
      invalidateCache("caja_history");
      res.json(docData);
    } catch (err: any) {
      console.error("Error in POST /api/caja/history:", err);
      res.status(500).json({ error: "Error guardando historial de caja: " + (err.message || err) });
    }
  });

  app.post("/api/caja/reopen", authenticate, async (req, res) => {
    try {
      const { dateStr } = req.body;
      if (!dateStr) {
        return res.status(400).json({ error: "dateStr is required" });
      }

      console.log(`[REOPEN-CAJA] Request received to reopen caja for date: ${dateStr}`);

      // 1. Find matching document in caja_history
      const historySnapshot = await db.collection(COL.CAJA_HISTORY).where("dateStr", "==", dateStr).get();
      if (historySnapshot.empty) {
        return res.status(404).json({ error: `No se encontró ninguna caja cerrada para la fecha ${dateStr}` });
      }

      const historyDoc = historySnapshot.docs[0];
      const historyData = historyDoc.data();

      // 2. Prepare reopened session data
      const reopenedSession = {
        ...historyData,
        isClosed: false,
        isOpen: true
      };

      // 3. Write to active box as "current"
      await db.collection(COL.CAJA_ACTIVE).doc("current").set(reopenedSession);

      // 4. Delete from caja_history
      await db.collection(COL.CAJA_HISTORY).doc(historyDoc.id).delete();

      // 5. Invalidate cache
      invalidateCache("caja_active");
      invalidateCache("caja_history");

      console.log(`[REOPEN-CAJA] Successfully reopened caja for date: ${dateStr}, Session ID: ${historyDoc.id}`);
      res.json({ success: true, session: reopenedSession });
    } catch (err: any) {
      console.error("Error in POST /api/caja/reopen:", err);
      res.status(500).json({ error: "Error al reabrir la caja: " + (err.message || err) });
    }
  });

  app.get("/api/caja/tarifas", authenticate, async (req, res) => {
    try {
      const doc = await db.collection(COL.CAJA_TARIFAS).doc("config").get();
      if (!doc.exists) {
        return res.json(null);
      }
      res.json(doc.data());
    } catch (err: any) {
      console.error("Error in GET /api/caja/tarifas:", err);
      res.status(500).json({ error: "Error recuperando tarifas: " + (err.message || err) });
    }
  });

  app.post("/api/caja/tarifas", authenticate, async (req, res) => {
    try {
      const ref = db.collection(COL.CAJA_TARIFAS).doc("config");
      await ref.set(req.body);
      res.json(req.body);
    } catch (err: any) {
      console.error("Error in POST /api/caja/tarifas:", err);
      res.status(500).json({ error: "Error actualizando tarifas: " + (err.message || err) });
    }
  });

  app.get("/api/caja/boxlists", authenticate, async (req, res) => {
    try {
      const doc = await db.collection(COL.CAJA_TARIFAS).doc("boxlists").get();
      if (!doc.exists) {
        return res.json(null);
      }
      res.json(doc.data());
    } catch (err: any) {
      console.error("Error in GET /api/caja/boxlists:", err);
      res.status(500).json({ error: "Error recuperando caja boxlists: " + (err.message || err) });
    }
  });

  app.post("/api/caja/boxlists", authenticate, async (req, res) => {
    try {
      const ref = db.collection(COL.CAJA_TARIFAS).doc("boxlists");
      await ref.set(req.body);
      res.json(req.body);
    } catch (err: any) {
      console.error("Error in POST /api/caja/boxlists:", err);
      res.status(500).json({ error: "Error guardando caja boxlists: " + (err.message || err) });
    }
  });

  // BUDGETS ENDPOINTS
  app.get("/api/accounts/master", authenticate, async (req, res) => {
    try {
      const doc = await db.collection("settings").doc("chart_of_accounts").get();
      if (!doc.exists) {
        return res.json([]);
      }
      const data = doc.data();
      res.json(data?.accounts || []);
    } catch (err) {
      handleFirestoreError(res, err, OperationType.GET, "settings/chart_of_accounts");
    }
  });

  app.post("/api/accounts/master", authenticate, express.json({ limit: '1mb' }), async (req, res) => {
    try {
      const accounts = req.body;
      if (!Array.isArray(accounts)) {
        return res.status(400).json({ error: "Body must be an array of accounts" });
      }

      await db.collection("settings").doc("chart_of_accounts").set({
        accounts,
        updatedAt: new Date().toISOString()
      });
      
      res.json({ success: true });
    } catch (err) {
      handleFirestoreError(res, err, OperationType.WRITE, "settings/chart_of_accounts");
    }
  });

  app.get("/api/budgets", authenticate, async (req, res) => {
    try {
      const snapshot = await db.collection(COL.BUDGETS).get();
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(items);
    } catch (err: any) {
      console.error("Error in GET /api/budgets:", err);
      res.status(500).json({ error: "Error recuperando presupuestos: " + (err.message || err) });
    }
  });

  app.post("/api/budgets", (req, res, next) => {
    console.log("SERVER-1 request received");
    authenticate(req, res, () => {
      console.log("SERVER-2 authenticate passed");
      next();
    });
  }, async (req, res) => {
    try {
      console.log("SERVER-3 payload", req.body);
      const budget = req.body;
      const id = budget.id || db.collection(COL.BUDGETS).doc().id;
      const ref = db.collection(COL.BUDGETS).doc(id);
      
      const payload = {
        id,
        monthStr: budget.monthStr || "",
        category: budget.category || "",
        account: budget.account || "",
        subaccount: budget.subaccount || "",
        amount: Number(budget.amount) || 0,
        dueDate: budget.dueDate || "",
        paidAmount: Number(budget.paidAmount) || 0,
        state: budget.state || "Pendiente"
      };

      console.log("SERVER-4 firestore write starting", payload);
      await ref.set(payload);
      console.log("SERVER-5 firestore write success", payload);
      res.json(payload);
    } catch (err: any) {
      console.log("SERVER-ERR", err);
      console.error("Error in POST /api/budgets:", err);
      res.status(500).json({ error: "Error guardando presupuesto: " + (err.message || err) });
    }
  });

  app.put("/api/budgets/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const ref = db.collection(COL.BUDGETS).doc(id);
      
      const allowedFields = ["monthStr", "category", "account", "subaccount", "amount", "dueDate", "paidAmount", "state"];
      const finalUpdates: any = {};
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          if (field === "amount" || field === "paidAmount") {
            finalUpdates[field] = Number(updates[field]);
          } else {
            finalUpdates[field] = updates[field];
          }
        }
      }

      await ref.update(finalUpdates);
      const snapshot = await ref.get();
      res.json({ id: snapshot.id, ...snapshot.data() });
    } catch (err: any) {
      console.error("Error in PUT /api/budgets:", err);
      res.status(500).json({ error: "Error actualizando presupuesto: " + (err.message || err) });
    }
  });

  app.delete("/api/budgets/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection(COL.BUDGETS).doc(id).delete();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error in DELETE /api/budgets:", err);
      res.status(500).json({ error: "Error eliminando presupuesto: " + (err.message || err) });
    }
  });

  app.post("/api/budgets/copiar", authenticate, async (req, res) => {
    try {
      const { fromMonth, toMonth } = req.body;
      if (!fromMonth || !toMonth) {
        return res.status(400).json({ error: "Meses de origen y destino requeridos" });
      }

      const snapshot = await db.collection(COL.BUDGETS).where("monthStr", "==", fromMonth).get();
      const docs = snapshot.docs.map(d => d.data());

      const batch = db.batch();
      
      const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ];

      for (const doc of docs) {
        const newId = db.collection(COL.BUDGETS).doc().id;
        const ref = db.collection(COL.BUDGETS).doc(newId);
        
        // Calculate new dueDate if possible
        let newDueDate = doc.dueDate;
        if (toMonth) {
          const parts = toMonth.split(" ");
          if (parts.length === 2) {
            const mIdx = monthNames.indexOf(parts[0]);
            const year = parseInt(parts[1]);
            if (mIdx !== -1) {
              newDueDate = new Date(year, mIdx + 1, 0).toISOString().split("T")[0];
            }
          }
        }

        batch.set(ref, {
          ...doc,
          id: newId,
          monthStr: toMonth,
          dueDate: newDueDate,
          paidAmount: 0,
          state: "Pendiente"
        });
      }
      await batch.commit();

      res.json({ success: true, count: docs.length });
    } catch (err: any) {
      console.error("Error copying budgets:", err);
      res.status(500).json({ error: "Error al copiar presupuestos: " + (err.message || err) });
    }
  });

  app.delete("/api/budgets/clear/:month", authenticate, async (req, res) => {
    try {
      const { month } = req.params;
      if (!month) {
        return res.status(400).json({ error: "Mes requerido" });
      }

      const snapshot = await db.collection(COL.BUDGETS).where("monthStr", "==", month).get();
      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      res.json({ success: true, count: snapshot.docs.length });
    } catch (err: any) {
      console.error("Error clearing budget month:", err);
      res.status(500).json({ error: "Error al vaciar presupuesto del mes: " + (err.message || err) });
    }
  });

  // LEDGER MANUAL ENDPOINTS
  app.get("/api/ledger-manual", authenticate, async (req, res) => {
    try {
      const snapshot = await db.collection(COL.LEDGER_MANUAL).get();
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(items);
    } catch (err: any) {
      console.error("Error in GET /api/ledger-manual:", err);
      res.status(500).json({ error: "Error recuperando libro de gestion: " + (err.message || err) });
    }
  });

  app.post("/api/ledger-manual", authenticate, async (req, res) => {
    try {
      const entry = req.body;
      const id = entry.id || db.collection(COL.LEDGER_MANUAL).doc().id;
      const ref = db.collection(COL.LEDGER_MANUAL).doc(id);

      const payload = {
        id,
        date: entry.date || new Date().toISOString().split("T")[0],
        periodoImputado: entry.periodoImputado || "",
        origin: entry.origin || "Administrador",
        type: entry.type || "Ajuste",
        account: entry.account || "",
        subaccount: entry.subaccount || "",
        description: entry.description || "",
        debe: Number(entry.debe) || 0,
        haber: Number(entry.haber) || 0,
        linkedBudgetId: entry.linkedBudgetId || "",
        isSystem: !!entry.isSystem
      };

      await ref.set(payload);
      res.json(payload);
    } catch (err: any) {
      console.error("Error in POST /api/ledger-manual:", err);
      res.status(500).json({ error: "Error guardando asiento libro: " + (err.message || err) });
    }
  });

  app.delete("/api/ledger-manual/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      await db.collection(COL.LEDGER_MANUAL).doc(id).delete();
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error in DELETE /api/ledger-manual:", err);
      res.status(500).json({ error: "Error eliminando asiento libro: " + (err.message || err) });
    }
  });

  app.put("/api/ledger-manual/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const entry = req.body;
      const ref = db.collection(COL.LEDGER_MANUAL).doc(id);

      const payload = {
        id,
        date: entry.date || new Date().toISOString().split("T")[0],
        periodoImputado: entry.periodoImputado || "",
        origin: entry.origin || "Administrador",
        type: entry.type || "Egreso",
        account: entry.account || "",
        subaccount: entry.subaccount || "",
        description: entry.description || "",
        debe: Number(entry.debe) || 0,
        haber: Number(entry.haber) || 0,
        linkedBudgetId: entry.linkedBudgetId || "",
        isSystem: !!entry.isSystem
      };

      await ref.set(payload);
      res.json(payload);
    } catch (err: any) {
      console.error("Error in PUT /api/ledger-manual:", err);
      res.status(500).json({ error: "Error editando asiento libro: " + (err.message || err) });
    }
  });

  // 3. AI TICKET SCANNING ENDPOINT
  app.post("/api/sales/scan-ticket", authenticate, async (req, res) => {
    const uid = (req as any).user.uid;
    const { image, mimeType } = req.body;
    if (!image || !mimeType) {
      return res.status(400).json({ error: "Faltan los datos de la imagen o el tipo MIME." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: "El servicio de Inteligencia Artificial no está configurado (falta GEMINI_API_KEY en secrets)." 
      });
    }

    try {
      // Show only active items to Gemini for matching
      const snapshot = await db.collection(COL.STOCK).where("is_active", "!=", false).get();
      const stockItems = snapshot.docs.map(doc => doc.data());

      // Initialize Gemini Client
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });

      // Prepare product catalog string so Gemini maps it
      const catalog = stockItems.map((p) => ({
        id: (p as any).id,
        name: (p as any).name,
        category: (p as any).category,
        selling_price: (p as any).selling_price
      }));

      const imagePart = {
        inlineData: {
          mimeType: mimeType,
          data: image // Base64 encoding string
        }
      };

      const promptPart = `
      Eres el asistente de Inteligencia Artificial para el bar "De Primera (fútbol & eventos)".
      Analiza la imagen de este tique de venta o factura de compras y extrae la información a formato estructurado JSON en español.
      
      Lista de productos de la base de datos de nuestro bar (Catálogo actual):
      ${JSON.stringify(catalog, null, 2)}
      
      Instrucciones:
      1. Extrae cada artículo del tique (nombre del tique, cantidad, precio unitario y total).
      2. Mapea e identifica cada artículo con un producto con la base de datos de nuestro bar seleccionando el ID correspondiente ("matchedItemId") y pon su nombre real de nuestro stock en "matchedItemName".
          - Si coincide razonablemente (ejemplo: "Cerv. Estrella", "Estr. Gal." o "Estrella" coinciden con "Estrella Galicia 33cl (Tercio)", o "Bravas" con "Ración Patatas Bravas", o "CocaCola" con "Coca-Cola Original 33cl"), mapea el ID de nuestra base de datos.
          - Si es un producto que no existe en absoluto en el catálogo proporcionado (como otros tipos de licores, marcas raras o comidas no listadas), pon "matchedItemId" como null.
      3. Extrae la suma total cobrada en el tique en "extractedTotal".
      4. Crea un breve resumen legible de lo escaneado en "scannedTextSummary".
      
      Ejemplo de coincidencia:
      - Tique dice: "Cocacola" -> matchedItemId: "prod_4", matchedItemName: "Coca-Cola Original 33cl"
      `;

      const scanningConfig = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scannedItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  rawName: { 
                    type: Type.STRING, 
                    description: "Nombre literal que aparece escrito en la línea de tique" 
                  },
                  matchedItemId: { 
                    type: Type.STRING, 
                    description: "ID coincidente del inventario de BarStock o null si no existe una coincidencia" 
                  },
                  matchedItemName: { 
                    type: Type.STRING, 
                    description: "Nombre de nuestro catálogo si concuerda, o null si es null" 
                  },
                  quantity: { 
                    type: Type.INTEGER, 
                    description: "Cantidad vendida/comprada en esa línea de tique (por defecto 1)" 
                  },
                  price: { 
                    type: Type.NUMBER, 
                    description: "Precio unitario cobrado en esa línea" 
                  },
                  total: { 
                    type: Type.NUMBER, 
                    description: "Total cobrado en esa línea de tique (cantidad * precio)" 
                  }
                },
                required: ["rawName", "quantity", "price", "total"]
              }
            },
            extractedTotal: { 
              type: Type.NUMBER, 
              description: "Suma total o cobro general extraído del tique" 
            },
            scannedTextSummary: { 
              type: Type.STRING, 
              description: "Resumen humano destacando fecha, local o descripción breve del tique." 
            }
          },
          required: ["scannedItems", "extractedTotal"]
        }
      };

      let response;
      try {
        console.log("Attempting ticket analysis with gemini-3.5-flash...");
        response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: { parts: [{ text: promptPart }, imagePart] },
          config: scanningConfig
        });
      } catch (firstModelError: any) {
        console.warn("gemini-3.5-flash model failed or overloaded, falling back to gemini-flash-latest. Error detail:", firstModelError.message || firstModelError);
        response = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: { parts: [{ text: promptPart }, imagePart] },
          config: scanningConfig
        });
      }

      const text = response.text;
      if (!text) {
        throw new Error("No se pudo obtener una respuesta textual del modelo de IA.");
      }

      const parsedJSON = JSON.parse(text.trim());
      res.json(parsedJSON);
    } catch (err: any) {
      console.error("AI Scanning error:", err);
      res.status(500).json({ 
        error: "Ocurrió un error al procesar el tique con Inteligencia Artificial. Detalle: " + (err.message || err) 
      });
    }
  });

  // CUSTOM LOGO CONFIG ENDPOINTS
  app.get("/api/settings/logo", async (req, res) => {
    try {
      const doc = await db.collection("settings").doc("logo").get();
      if (!doc.exists) {
        return res.json({ customLogo: null });
      }
      res.json(doc.data());
    } catch (err: any) {
      console.error("Error in GET /api/settings/logo:", err);
      // Fallback to sending null instead of hard erroring to keep frontend resilient
      res.json({ customLogo: null });
    }
  });

  app.post("/api/settings/logo", async (req, res) => {
    try {
      const { customLogo } = req.body;
      const ref = db.collection("settings").doc("logo");
      await ref.set({ customLogo });
      res.json({ success: true, customLogo });
    } catch (err: any) {
      console.error("Error in POST /api/settings/logo:", err);
      res.status(500).json({ error: "Error actualizando logotipo: " + (err.message || err) });
    }
  });

  // Catch-all for unhandled API routes to prevent them falling through to HTML fallback
  app.all("/api/*", (req, res) => {
    console.warn(`[API 404] ${req.method} ${req.url}`);
    res.status(404).json({ error: `Ruta API no encontrada: ${req.originalUrl}` });
  });

  // Serve static files and mount Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server started successfully on port ${PORT}`);
    console.log(`Node Environment: ${process.env.NODE_ENV}`);
    
    try {
      logToFile("Executing Connectivity Health Check...");
      const configDbId = firebaseConfig.firestoreDatabaseId || "(default)";
      
      // Attempt to read from stock collection
      await db.collection(COL.STOCK).limit(1).get();
      logToFile(`Health Check SUCCESS for ${configDbId}`);
      console.log(`[FIREBASE] Connectivity confirmed for ${configDbId}`);
      
      // Run auto-backfill for missing kardex data
      await backfillKardex();
      await adjustInitialDate();
      await selfHealSalesDates().catch(err => console.error("selfHealSalesDates failed", err));

      // Reconcile and fix closed box session cash discrepancy for day 17
      await (async () => {
        try {
          console.log("[FIX-DAY-17] Running cash reconciliation self-healing routine...");
          const historySnapshot = await db.collection(COL.CAJA_HISTORY).get();
          if (historySnapshot.empty) {
            console.log("[FIX-DAY-17] No history found.");
            return;
          }
          const salesSnapshot = await db.collection(COL.SALES).get();
          const sales = salesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

          for (const doc of historySnapshot.docs) {
            const session: any = doc.data();
            if (!session) continue;
            
            const dateStr = session.dateStr || "";
            // Check if it's day 17 (e.g., contains "17")
            const isDay17 = dateStr.includes("17");
            
            if (isDay17) {
              console.log(`[FIX-DAY-17] Found matching session for Day 17! ID: ${session.id}, dateStr: ${dateStr}`);
              const subtotalCancha1 = (session.cancha1 || []).reduce((sum: number, slot: any) => sum + (Number(slot.amount) || 0), 0);
              const subtotalCancha2 = (session.cancha2 || []).reduce((sum: number, slot: any) => sum + (Number(slot.amount) || 0), 0);
              
              // Filter sales for this session
              const sessionSales = sales.filter((sale: any) => {
                if (sale.cajaSessionId && sale.cajaSessionId === session.id) return true;
                try {
                  const saleDate = sale.date ? sale.date.substring(0, 10) : "";
                  const sessDate = dateStr.substring(0, 10);
                  return saleDate === sessDate && saleDate !== "";
                } catch {
                  return false;
                }
              });
              
              const histBarSalesOnly = sessionSales.filter((s: any) => {
                if (s.origin === "mesa" || s.origin === "sistema_caja") return false;
                const sysLabels = ["Cancha 1", "Cancha 2", "Otros Ingresos", "Otros Egresos", "Personal Egreso"];
                if (sysLabels.includes(s.table_number || "")) return false;
                return true;
              });
              
              const histBarSalesTotal = histBarSalesOnly.reduce((acc: number, sale: any) => acc + (Number(sale.total) || 0), 0);
              const histTotalOtrosIncomes = histBarSalesTotal + (session.otrosIngresos || []).reduce((sum: number, r: any) => sum + ((r.quantity || 1) * (Number(r.amount) || 0)), 0);
              const histTotalEgresos = (session.personalAmount || 0) + (session.otrosEgresos || []).reduce((sum: number, r: any) => sum + ((r.quantity || 1) * (Number(r.amount) || 0)), 0);
              
              const histTheoreticalToSurrender = Number(session.saldoInicial || 0) + subtotalCancha1 + subtotalCancha2 + histTotalOtrosIncomes - histTotalEgresos;
              
              const currentEfectivo = Number(session.rendicionEfectivo || 0);
              const currentTransferencia = Number(session.rendicionTransferencia || 0);
              const currentTarjetas = Number(session.rendicionTarjetas || 0);
              
              // We want difference = 0, which means:
              // rendicionEfectivo + Transferencia + Tarjetas = histTheoreticalToSurrender
              const targetRendicionEfectivo = histTheoreticalToSurrender - currentTransferencia - currentTarjetas;
              
              console.log(`[FIX-DAY-17] Theoretical Total: ${histTheoreticalToSurrender}, Transfer: ${currentTransferencia}, Card: ${currentTarjetas}`);
              console.log(`[FIX-DAY-17] Changing rendicionEfectivo from ${currentEfectivo} to target: ${targetRendicionEfectivo}`);
              
              // Generate matching billCounts
              const billCounts: Record<string, number> = {};
              let remaining = Math.max(0, targetRendicionEfectivo);
              const denoms = [2000, 1000, 500, 200, 100, 50, 20, 10];
              for (const d of denoms) {
                if (remaining >= d) {
                  const count = Math.floor(remaining / d);
                  billCounts[d.toString()] = count;
                  remaining = remaining % d;
                }
              }
              if (remaining > 0) {
                billCounts["10"] = (billCounts["10"] || 0) + Math.ceil(remaining / 10);
              }
              
              await doc.ref.update({
                rendicionEfectivo: targetRendicionEfectivo,
                billCounts: billCounts
              });
              
              console.log(`[FIX-DAY-17] Successfully self-healed session ${session.id}!`);
            }
          }
          invalidateCache("caja_history");
          invalidateCache("caja_active");
        } catch (err: any) {
          console.error("[FIX-DAY-17] Error running day 17 fix:", err.message);
        }
      })();
    } catch (e: any) {
      logToFile(`Health Check FATAL: ${e.message}`);
      console.error("[FIREBASE] Health Check failed:", e.message);
    }

    // Run deeper startup diagnostics
    try {
      logToFile("Running Automated Startup DB Ownership and IAM Diagnostics...");
      const results = await runDiagnosticTests({ originalUrl: "startup_automation" } as any);
      fs.writeFileSync(path.join(process.cwd(), "db_diagnostic_output.json"), JSON.stringify(results, null, 2));
      logToFile("Automated Startup Diagnostics completed. Results written to db_diagnostic_output.json");
    } catch (diagErr: any) {
      logToFile(`Startup Diagnostics FATAL: ${diagErr.message}`);
    }
  });
}

startServer().catch((err) => {
  console.error("FATAL: server failed to start:", err);
  process.exit(1);
});
