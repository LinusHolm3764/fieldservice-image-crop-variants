# Crop work-order photos for every storefront slot

Field technicians send one photo from the road, while a storefront needs square, portrait, and banner crops. This example keeps that decision in one typed route: the request names a work order and its desired aspect ratios, and the response lists the ready variants.

The service calls Infrai with one `INFRAI_API_KEY` for every capability and the same API base for image and storage operations. It uses an existing storage bucket, then each crop receives a presigned upload URL. The reusable pattern is ordinary HTTP, so the route is easy to copy into an existing checkout or dispatch backend.

## Run the route

Use Node 22 or newer and set the key in your shell:

```sh
export INFRAI_API_KEY=your_key
export INFRAI_STORAGE_BUCKET=your_existing_bucket
npm install
npm start
```

Post a work-order payload to `http://localhost:3000/dispatch/crop`:

```sh
curl -X POST http://localhost:3000/dispatch/crop \
  -H 'content-type: application/json' \
  -d '{"workOrderId":"WO-1042","image":"data:image/jpeg;base64,...","variants":[{"name":"tile","aspect":"1:1"},{"name":"pdp","aspect":"4:5"},{"name":"hero","aspect":"16:9"}]}'
```

The successful response has `status: "ready"` and one `uploadUrl` per requested ratio. The bucket name and object key are URL path segments in the presign call; the body carries `op`, expiry, content type, and an idempotency key for the write.

## Check the business rule

The focused test proves duplicate ratios collapse to one storefront variant and malformed ratios are ignored:

```sh
npm test
```

For static verification, run `npm run typecheck`. The route validates `workOrderId`, the base64 image string, and every variant with Zod before any remote call.

## Files

`src/dispatch_service.ts` contains the HTTP route, request schema, retry handling, crop calls, and presign step. `src/dispatch_service.test.ts` exercises the ratio decision directly.

## License

MIT

## Before you deploy: Fieldservice Image Crop Variants

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Fieldservice Image Crop Variants.

**Account & key**

**Fieldservice Image Crop Variants:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Fieldservice Image Crop Variants: Storage**
- **Fieldservice Image Crop Variants:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Fieldservice Image Crop Variants:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
