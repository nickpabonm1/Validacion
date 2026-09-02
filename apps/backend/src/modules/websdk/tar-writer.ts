/**
 * Escritor de archivos .TAR (formato ustar), sin dependencias externas.
 *
 * Puerto a Node/Buffer del escritor usado en el proyecto de referencia
 * (`fad-demo-v1/src/app/utils/tar-writer.ts`, verificado contra UATHA) — el servicio
 * `saveValidationData` requiere empaquetar en un .TAR los archivos (imágenes, `data.json`, etc.)
 * antes de cifrarlos a `.FAD` (ver `websdk-crypto.ts`).
 */

export interface TarEntry {
  /** Nombre del archivo dentro del TAR (p.ej. "data.json", "selfie.png"). */
  name: string;
  /** Contenido binario. */
  content: Buffer;
}

const BLOCK = 512;

export function buildTar(entries: TarEntry[]): Buffer {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    chunks.push(header(entry.name, entry.content.length));
    chunks.push(entry.content);
    const remainder = entry.content.length % BLOCK;
    if (remainder !== 0) {
      chunks.push(Buffer.alloc(BLOCK - remainder));
    }
  }
  // Fin del archivo: dos bloques de ceros.
  chunks.push(Buffer.alloc(BLOCK * 2));
  return Buffer.concat(chunks);
}

function header(name: string, size: number): Buffer {
  const buf = Buffer.alloc(BLOCK);

  writeString(buf, name, 0, 100);
  writeOctal(buf, 0o644, 100, 8); // mode
  writeOctal(buf, 0, 108, 8); // uid
  writeOctal(buf, 0, 116, 8); // gid
  writeOctal(buf, size, 124, 12); // size
  writeOctal(buf, Math.floor(Date.now() / 1000), 136, 12); // mtime
  // checksum (148..156) se rellena luego; por ahora espacios
  buf.fill(0x20, 148, 156);
  buf[156] = "0".charCodeAt(0); // typeflag: archivo normal
  writeString(buf, "ustar", 257, 6); // magic
  buf[263] = "0".charCodeAt(0); // version
  buf[264] = "0".charCodeAt(0);

  // checksum = suma de todos los bytes del header (con el campo checksum en blanco, como arriba)
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += buf[i]!;
  const checksum = (sum & 0o777777).toString(8).padStart(6, "0");
  writeString(buf, checksum, 148, 6);
  buf[154] = 0; // null
  buf[155] = 0x20; // space

  return buf;
}

function writeString(buf: Buffer, str: string, offset: number, len: number): void {
  const bytes = Buffer.from(str, "utf8");
  for (let i = 0; i < len; i++) {
    buf[offset + i] = i < bytes.length ? bytes[i]! : 0;
  }
}

function writeOctal(buf: Buffer, value: number, offset: number, len: number): void {
  // longitud - 1 dígitos octales + null final
  const str = value.toString(8).padStart(len - 1, "0") + "\0";
  writeString(buf, str, offset, len);
}
