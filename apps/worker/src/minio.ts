import { Client } from "minio";

const endpoint = process.env.MINIO_ENDPOINT ?? "minio";
const port = Number(process.env.MINIO_PORT ?? 9000);
const useSSL = process.env.MINIO_USE_SSL === "true";
const accessKey = process.env.MINIO_ACCESS_KEY ?? "minio";
const secretKey = process.env.MINIO_SECRET_KEY ?? "minio12345";

export const BUCKET = process.env.MINIO_BUCKET ?? "petitions";

export const minio = new Client({
  endPoint: endpoint,
  port,
  useSSL,
  accessKey,
  secretKey,
});

export async function fetchObject(fileKey: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const stream = await minio.getObject(BUCKET, fileKey);
  return await new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
