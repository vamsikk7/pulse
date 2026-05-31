import * as net from "node:net";

const HOST = process.env.CLAMAV_HOST ?? "clamav";
const PORT = Number(process.env.CLAMAV_PORT ?? 3310);
const TIMEOUT_MS = Number(process.env.CLAMAV_TIMEOUT_MS ?? 30_000);
export const CLAMAV_ENABLED =
  (process.env.CLAMAV_ENABLED ?? "true").toLowerCase() !== "false";

export interface ScanResult {
  clean: boolean;
  signature?: string;
  raw: string;
  durationMs: number;
}

/**
 * Stream the given buffer to clamd over the INSTREAM protocol and return
 * the verdict. clamd protocol:
 *   - send "zINSTREAM\0"
 *   - then chunks of <4-byte big-endian length><bytes>
 *   - finish with a zero-length chunk
 *   - read the reply
 */
export async function scanBuffer(buf: Buffer): Promise<ScanResult> {
  if (!CLAMAV_ENABLED) {
    return { clean: true, raw: "ClamAV disabled", durationMs: 0 };
  }

  const start = Date.now();
  return await new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(TIMEOUT_MS);
    let response = "";

    socket.on("error", (err) => reject(err));
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`ClamAV timed out after ${TIMEOUT_MS}ms`));
    });
    socket.on("data", (chunk) => {
      response += chunk.toString();
    });
    socket.on("end", () => {
      const raw = response.trim().replace(/\0$/, "");
      const durationMs = Date.now() - start;
      // Examples:
      //   "stream: OK"
      //   "stream: Win.Test.EICAR_HDB-1 FOUND"
      //   "stream: Heuristics.Phishing.Email FOUND"
      const found = /FOUND$/i.test(raw);
      const sigMatch = raw.match(/:\s*(\S+)\s+FOUND/i);
      resolve({
        clean: !found,
        signature: sigMatch?.[1],
        raw,
        durationMs,
      });
    });

    socket.connect(PORT, HOST, () => {
      socket.write("zINSTREAM\0");
      const CHUNK = 64 * 1024;
      for (let i = 0; i < buf.length; i += CHUNK) {
        const slice = buf.subarray(i, Math.min(i + CHUNK, buf.length));
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(slice.length, 0);
        socket.write(lenBuf);
        socket.write(slice);
      }
      // Zero-length chunk = end of stream
      const term = Buffer.alloc(4);
      term.writeUInt32BE(0, 0);
      socket.write(term);
    });
  });
}

/**
 * Liveness check used at API boot to know whether ClamAV is reachable.
 * Returns the PONG string or throws.
 */
export async function ping(): Promise<string> {
  if (!CLAMAV_ENABLED) return "disabled";
  return await new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);
    let response = "";
    socket.on("data", (c) => (response += c.toString()));
    socket.on("end", () => resolve(response.trim().replace(/\0$/, "")));
    socket.on("error", (err) => reject(err));
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("ClamAV ping timeout"));
    });
    socket.connect(PORT, HOST, () => socket.write("zPING\0"));
  });
}
