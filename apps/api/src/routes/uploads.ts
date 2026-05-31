import { Router } from "express";
import asyncHandler from "express-async-handler";
import { randomUUID } from "node:crypto";
import { PresignUploadSchema } from "@pulse/shared";
import { presignUpload } from "../services/minio.js";
import { getUserId } from "../middleware/clerk.js";
import { CaseModel } from "../models/index.js";

export const uploadsRouter = Router();

/**
 * @openapi
 * /uploads/presign:
 *   post:
 *     tags: [Uploads]
 *     summary: Get a presigned URL for file upload
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [caseId, filename, contentType]
 *             properties:
 *               caseId:
 *                 type: string
 *               filename:
 *                 type: string
 *               contentType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Presigned URL and file key
 */
uploadsRouter.post(
  "/presign",
  asyncHandler(async (req, res) => {
    const userId = getUserId(req);
    const body = PresignUploadSchema.parse(req.body);

    const owns = await CaseModel.exists({ _id: body.caseId, userId });
    if (!owns) {
      res.status(404).json({ error: "case not found" });
      return;
    }


    const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const fileKey = `${userId}/${body.caseId}/${randomUUID()}-${safeName}`;
    const { url } = await presignUpload(fileKey, body.contentType);
    res.json({ url, fileKey });
  }),
);
