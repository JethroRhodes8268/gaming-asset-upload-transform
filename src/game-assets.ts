import { z } from "zod";
import { infrai } from "./infrai.ts";

const BUCKET = "game-player-assets";
const uploadBody = z.object({ playerId: z.string().min(1), assetKey: z.string().min(1), contentType: z.string().min(1) });
const resizeBody = z.object({ sourceUrl: z.string().url(), width: z.number().int().positive().max(2048), height: z.number().int().positive().max(2048) });

export type UploadRequest = z.infer<typeof uploadBody>;
export type ResizeRequest = z.infer<typeof resizeBody>;

export function chooseVariant(width: number, height: number): "thumbnail" | "standard" {
  return Math.max(width, height) <= 256 ? "thumbnail" : "standard";
}

export async function prepareUpload(input: unknown) {
  const request = uploadBody.parse(input);
  await infrai.storage.bucket.create({ name: BUCKET });
  return infrai.storage.object.presign(BUCKET, `${request.playerId}/${request.assetKey}`, {
    op: "put", expires_seconds: 900, content_type: request.contentType, idempotency_key: `${request.playerId}:${request.assetKey}`,
  });
}

export async function resizeUploadedAsset(input: unknown) {
  const request = resizeBody.parse(input);
  const variant = chooseVariant(request.width, request.height);
  return { variant, result: await infrai.image.resize({ image: request.sourceUrl, width: request.width, height: request.height, fit: "cover", enlarge: false, format: "webp", store: true }) };
}

if (process.argv[1]?.endsWith("game-assets.ts")) {
  console.log("POST /assets/upload with { playerId, assetKey, contentType }; then pass the returned URL to resizeUploadedAsset.");
}
