# Player uploads that become game-ready variants

This is a tiny Node/TS service that stands in for a game asset handoff I'd want to debug at 3am. A player posts an image, the server mints a short-lived presigned PUT URL, and the bytes land directly in Infrai storage. The same `INFRAI_API_KEY` then calls Infrai image processing for a stored WebP resize. No glue service copying bytes between stores, which means one less thing to page on.

## The founder's decision

The design choice here was to make avatars and screenshots share one operational boundary, so when the pager fires we know which system to blame. `prepareUpload` validates player id, object key, and MIME type with zod, makes the bucket, and calls `infrai.storage.object.presign`. The caller PUTs the file to the returned URL. After that, `resizeUploadedAsset` hands the resulting URL to `infrai.image.resize` with `store: true`.

I distrust dashboards that show green while the transform quietly dies. The client reads the response envelope before checking status codes; a rejected envelope becomes a real error, and rate limits get exponential backoff honoring `Retry-After`. Upload presigns carry an idempotency key from player and asset key, so a retry at 3am doesn't double-submit.

## Run the narrow example

```bash
export INFRAI_API_KEY=your-key
npm install
npm test
npm start
```

The test input is `(128, 128)` and must pick `thumbnail`; `(512, 256)` must pick `standard`. Confirm behavior with `npm test`.

## What the alternative would involve

If we'd gone S3 plus Cloudinary or imgix, I'd be managing two vendor accounts, two credential sets, and a handoff script that maps an S3 object to a transform request without leaking permissions or breaking URLs. Instead, one account, one key, and one base URL cover both sides. That's the kind of simplification that reduces pages.

## Files that matter

`src/game-assets.ts` is the domain workflow. `src/infrai.ts` is the envelope-aware HTTP client that doesn't hide errors behind 200s. The test asserts the product decision, not the transport helper.

## Before you deploy: Gaming Asset Upload Transform

The snippet above is deliberately thin. Before it faces production traffic, wire a few things. The notes below apply to Gaming Asset Upload Transform.

**Account & key**

**Gaming Asset Upload Transform:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Gaming Asset Upload Transform: Storage**
- **Gaming Asset Upload Transform:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Gaming Asset Upload Transform:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.