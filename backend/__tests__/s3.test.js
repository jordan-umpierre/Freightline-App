jest.unmock('../services/s3')

process.env.AWS_REGION = 'us-east-1'
process.env.AWS_S3_BUCKET = 'test-bucket'
process.env.AWS_ACCESS_KEY_ID = 'test-key'
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example/upload'),
}))

const { MAX_POD_BYTES, isAllowedContentType, presignPodUpload } = require('../services/s3')

describe('s3 service validation', () => {
  test('isAllowedContentType accepts image/jpeg, image/png, application/pdf', () => {
    expect(isAllowedContentType('image/jpeg')).toBe(true)
    expect(isAllowedContentType('image/png')).toBe(true)
    expect(isAllowedContentType('application/pdf')).toBe(true)
  })

  test('isAllowedContentType rejects everything else', () => {
    expect(isAllowedContentType('image/gif')).toBe(false)
    expect(isAllowedContentType('text/html')).toBe(false)
    expect(isAllowedContentType('')).toBe(false)
    expect(isAllowedContentType(undefined)).toBe(false)
  })

  test('MAX_POD_BYTES is 10 MB', () => {
    expect(MAX_POD_BYTES).toBe(10 * 1024 * 1024)
  })

  test('presignPodUpload throws on disallowed content type', async () => {
    await expect(presignPodUpload({
      load_id: 'load-1',
      content_type: 'image/gif',
      size_bytes: 1000,
    })).rejects.toThrow(/content_type/)
  })

  test('presignPodUpload throws when size exceeds limit', async () => {
    await expect(presignPodUpload({
      load_id: 'load-1',
      content_type: 'image/jpeg',
      size_bytes: MAX_POD_BYTES + 1,
    })).rejects.toThrow(/size/)
  })

  test('presignPodUpload returns upload_url and s3_key on valid input', async () => {
    const result = await presignPodUpload({
      load_id: 'load-1',
      content_type: 'image/jpeg',
      size_bytes: 1024,
    })

    expect(result.upload_url).toBe('https://signed.example/upload')
    expect(result.s3_bucket).toBe('test-bucket')
    expect(result.s3_key).toMatch(/^pod\/load-1\//)
  })
})
