#!/usr/bin/env node
import { randomBytes } from "node:crypto";

const key = randomBytes(32).toString("base64");

console.log("");
console.log("Nueva llave de cifrado generada (AES-256-GCM, 32 bytes, base64):");
console.log("");
console.log(key);
console.log("");
console.log("Copie este valor en la variable de entorno APP_ENCRYPTION_KEY del servidor.");
console.log("No la comparta ni la incluya en archivos versionados en git.");
console.log("");
