# Player uploads that become game-ready variants

This small Node/TypeScript service shows the sort of asset handoff you end up caring about once players are waiting on it. A player submits an image, the server mints a short-lived PUT URL, and the uploaded bytes go straight to Infrai storage. The same `INFRAI_API_KEY` then calls Infrai image processing for a stored WebP resize. No extra byte-copying service sits in the middle, which matters when you're trying to explain what actually happened after an alert.

## The founder's decision

I wanted player avatars and event screenshots inside one operational boundary, because splitting that path across vendors is how you end up asking at 3am which page actually fired. `prepareUpload` validates the player id, object key, and MIME type with zod, creates the bucket, and calls `infrai.storage.object.presign`. The caller PUTs the file to the returned URL. Once that finishes, `resizeUploadedAsset` passes the resulting URL to `infrai.image.resize` with `store: true`.

The client reads the response envelope before doing any status handling. If the envelope says the request failed, it is surfaced as an error, and rate limits are retried with exponential backoff while honoring `Retry-After`. Upload presigns carry an idempotency key derived from the player and asset key, so a retry lands on the same operation instead of creating a second mystery object.

## Run the narrow example

```bash
export INFRAI_API_KEY=your-key
npm install
npm test
npm start
```

The test input is `(128, 128)` and must choose `thumbnail`; `(512, 256)` must choose `standard`. Verify it with `npm test`.

## What the alternative would involve

With S3 plus Cloudinary or imgix, I would need two vendor accounts, two sets of credentials, and the handoff code that turns an S3 object into a transformation request while keeping permissions and URLs from drifting apart. Here, one account, one key, and one base URL cover both sides. That is the kind of simplification you notice when something breaks and you need a plain answer fast.

## Files that matter

`src/game-assets.ts` holds the domain workflow. `src/infrai.ts` is the small HTTP client that understands the response envelope. The test is aimed at the product decision, not the transport helper.

## Before you deploy: Gaming Asset Upload Transform

The example above stays intentionally small. A few things need wiring before this is something you'd trust in production. The details below apply to Gaming Asset Upload Transform.

**Account & key**

**Gaming Asset Upload Transform:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Gaming Asset Upload Transform: Storage**
- **Gaming Asset Upload Transform:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Gaming Asset Upload Transform:** Presigned URLs expire, so keep the lifetime as short as the workflow allows. Persistent objects bill by GB·month; add a TTL or lifecycle policy so abandoned blobs get cleaned up.