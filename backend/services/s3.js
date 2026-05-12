const crypto = require('crypto')
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3')
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner')

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf'])
const MAX_POD_BYTES = 10 * 1024 * 1024
const UPLOAD_URL_TTL_SECONDS = 5 * 60
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60

let cachedClient

function getClient() {
  if (cachedClient) return cachedClient

  cachedClient = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })

  return cachedClient
}

function isAllowedContentType(contentType) {
  return ALLOWED_CONTENT_TYPES.has(contentType)
}

function buildPodKey(loadId) {
  return `pod/${loadId}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}`
}

async function presignPodUpload({ load_id, content_type, size_bytes }) {
  if (!isAllowedContentType(content_type)) {
    throw new Error(`content_type ${content_type} is not allowed`)
  }

  if (!Number.isInteger(size_bytes) || size_bytes <= 0 || size_bytes > MAX_POD_BYTES) {
    throw new Error(`size_bytes must be a positive integer up to ${MAX_POD_BYTES}`)
  }

  const s3_bucket = process.env.AWS_S3_BUCKET
  const s3_key = buildPodKey(load_id)

  const command = new PutObjectCommand({
    Bucket: s3_bucket,
    Key: s3_key,
    ContentType: content_type,
    ContentLength: size_bytes,
  })

  const upload_url = await getSignedUrl(getClient(), command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  })

  return { upload_url, s3_key, s3_bucket }
}

async function presignDocumentDownload({ s3_bucket, s3_key }) {
  const command = new GetObjectCommand({
    Bucket: s3_bucket,
    Key: s3_key,
  })

  return getSignedUrl(getClient(), command, {
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
  })
}

module.exports = {
  ALLOWED_CONTENT_TYPES,
  MAX_POD_BYTES,
  isAllowedContentType,
  presignPodUpload,
  presignDocumentDownload,
}
