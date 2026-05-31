import { Client } from "minio";

const internalEndpoint = process.env.MINIO_ENDPOINT ?? "minio";
const internalPort = Number(process.env.MINIO_PORT ?? 9000);
const useSSL = process.env.MINIO_USE_SSL === "true";
const accessKey = process.env.MINIO_ACCESS_KEY ?? "minio";
const secretKey = process.env.MINIO_SECRET_KEY ?? "minio12345";

export const BUCKET = process.env.MINIO_BUCKET ?? "petitions";

const PUBLIC_URL = new URL(process.env.MINIO_PUBLIC_URL ?? "http://localhost:9000");

/**
 * Internal client — used for direct ops from the API/worker.
 * Connects over the docker network to the `minio` service.
 */
export const minio = new Client({
  endPoint: internalEndpoint,
  port: internalPort,
  useSSL,
  accessKey,
  secretKey,
  region: "us-east-1",
});

/**
 * Presign client — used ONLY to sign URLs that the browser will hit directly.
 * Configured with the PUBLIC host so the signature is valid against that hostname.
 * Never used for direct ops (the public host isn't reachable from inside containers
 * via this name).
 */
const presignClient = new Client({
  endPoint: PUBLIC_URL.hostname,
  port: PUBLIC_URL.port
    ? Number(PUBLIC_URL.port)
    : PUBLIC_URL.protocol === "https:"
      ? 443
      : 80,
  useSSL: PUBLIC_URL.protocol === "https:",
  accessKey,
  secretKey,
  region: "us-east-1",
});

export async function presignUpload(
  fileKey: string,
  _contentType: string,
  expiresSeconds = 60 * 10,
): Promise<{ url: string; fileKey: string }> {
  const url = await presignClient.presignedPutObject(BUCKET, fileKey, expiresSeconds);
  return { url, fileKey };
}

export async function presignDownload(
  fileKey: string,
  expiresSeconds = 60 * 30,
): Promise<string> {
  return presignClient.presignedGetObject(BUCKET, fileKey, expiresSeconds);
}

export async function ensureBucket(): Promise<void> {
  const exists = await minio.bucketExists(BUCKET).catch(() => false);
  if (!exists) await minio.makeBucket(BUCKET);
}
