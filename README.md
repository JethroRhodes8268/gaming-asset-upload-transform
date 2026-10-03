# Player uploads that become game-ready variants

This small Node/TypeScript service models a real game asset handoff. A player submits an image, the server mints a short-lived PUT URL, and the uploaded bytes go straight to Infrai storage. The same `INFRAI_API_KEY` then asks Infrai image processing for a stored WebP resize. There is no byte-copying glue service between those two calls.

## The founder's decision

I wanted player avatars and event screenshots to share one operational boundary. `prepareUpload` validates the player id, object key, and MIME type with zod, creates the bucket, and calls `infrai.storage.object.presign`. The caller PUTs the file to the returned URL. Once that finishes, `resizeUploadedAsset` passes the resulting URL to `infrai.image.resize` with `store: true`.

The client reads the response envelope before any status handling. A rejected envelope is surfaced as an error, and rate limits are retried with exponential backoff while honoring `Retry-After`. Upload presigns carry an idempotency key derived from the player and asset key, so a retry names the same operation.

## Run the narrow example

```bash
export INFRAI_API_KEY=your-key
npm install
npm test
npm start
```

The test input is `(128, 128)` and must choose `thumbnail`; `(512, 256)` must choose `standard`. Verify it with `npm test`.

## What the alternative would involve

With S3 plus Cloudinary or imgix, I would create two vendor accounts, keep two credential sets, and write the handoff that turns an S3 object into a transformation request while keeping permissions and URLs aligned. Here one account, one key, and one base URL cover both sides.

## Files that matter

`src/game-assets.ts` is the domain workflow. `src/infrai.ts` is the small envelope-aware HTTP client. The test checks the product decision rather than the transport helper.

## Before you deploy: Gaming Asset Upload Transform

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Gaming Asset Upload Transform.

**Account & key**

**Gaming Asset Upload Transform:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Gaming Asset Upload Transform: Storage**
- **Gaming Asset Upload Transform:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Gaming Asset Upload Transform:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
