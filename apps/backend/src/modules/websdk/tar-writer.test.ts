import { describe, expect, it } from "vitest";
import { buildTar } from "./tar-writer";

const BLOCK = 512;

/** Parser mínimo e independiente de un header ustar, usado solo para verificar el TAR generado. */
function parseHeader(block: Buffer) {
  const name = block.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
  const sizeOctal = block.subarray(124, 136).toString("utf8").replace(/\0.*$/, "").trim();
  const size = parseInt(sizeOctal, 8);
  const magic = block.subarray(257, 263).toString("utf8");
  const storedChecksum = parseInt(block.subarray(148, 154).toString("utf8").replace(/\0.*$/, "").trim(), 8);

  const checkBuf = Buffer.from(block);
  checkBuf.fill(0x20, 148, 156);
  let sum = 0;
  for (const byte of checkBuf) sum += byte;

  return { name, size, magic, storedChecksum, computedChecksum: sum };
}

describe("buildTar", () => {
  it("genera un header ustar válido (magic, checksum, tamaño) para una sola entrada", () => {
    const content = Buffer.from("hola mundo");
    const tar = buildTar([{ name: "data.json", content }]);

    const parsed = parseHeader(tar.subarray(0, BLOCK));
    expect(parsed.name).toBe("data.json");
    expect(parsed.size).toBe(content.length);
    expect(parsed.magic).toBe("ustar\0");
    expect(parsed.storedChecksum).toBe(parsed.computedChecksum);

    // El contenido va justo después del header.
    const storedContent = tar.subarray(BLOCK, BLOCK + content.length);
    expect(storedContent.equals(content)).toBe(true);
  });

  it("rellena cada entrada a múltiplos de 512 bytes y termina con dos bloques de ceros", () => {
    const content = Buffer.from("x".repeat(10)); // mucho menor que 512
    const tar = buildTar([{ name: "foto.png", content }]);

    // header (512) + contenido relleno a 512 + 2 bloques finales de ceros (1024) = 2048
    expect(tar.length).toBe(BLOCK + BLOCK + BLOCK * 2);
    expect(tar.length % BLOCK).toBe(0);

    const finalBlocks = tar.subarray(tar.length - BLOCK * 2);
    expect(finalBlocks.every((b) => b === 0)).toBe(true);
  });

  it("concatena múltiples entradas en orden, cada una con su propio header", () => {
    const entries = [
      { name: "data.json", content: Buffer.from('{"a":1}') },
      { name: "selfie.png", content: Buffer.from([1, 2, 3, 4, 5]) },
    ];
    const tar = buildTar(entries);

    let offset = 0;
    for (const entry of entries) {
      const parsed = parseHeader(tar.subarray(offset, offset + BLOCK));
      expect(parsed.name).toBe(entry.name);
      expect(parsed.size).toBe(entry.content.length);
      offset += BLOCK;
      const stored = tar.subarray(offset, offset + entry.content.length);
      expect(stored.equals(entry.content)).toBe(true);
      const paddedSize = Math.ceil(entry.content.length / BLOCK) * BLOCK;
      offset += paddedSize;
    }
    // Después de la última entrada deben venir los dos bloques finales de ceros.
    expect(tar.subarray(offset).every((b) => b === 0)).toBe(true);
    expect(tar.length - offset).toBe(BLOCK * 2);
  });

  it("maneja contenido cuyo tamaño ya es múltiplo exacto de 512 sin relleno extra", () => {
    const content = Buffer.alloc(BLOCK, 0x41); // exactamente 512 bytes de 'A'
    const tar = buildTar([{ name: "exacto.bin", content }]);
    // header (512) + contenido (512, sin relleno) + 2 bloques finales (1024) = 2048
    expect(tar.length).toBe(BLOCK * 4);
  });
});
