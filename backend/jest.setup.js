// Prevents any test from opening a real MongoDB connection.
// Tests that need to assert on Mongo calls should re-mock specific
// service functions (see __tests__/pings.test.js for an example).
jest.mock('./db/mongo', () => ({
  getMongoDb: jest.fn(),
  getPingCollection: jest.fn(),
  closeMongo: jest.fn(),
}))

jest.mock('./services/s3', () => ({
  ALLOWED_CONTENT_TYPES: new Set(['image/jpeg', 'image/png', 'application/pdf']),
  MAX_POD_BYTES: 10 * 1024 * 1024,
  isAllowedContentType: jest.requireActual('./services/s3').isAllowedContentType,
  presignPodUpload: jest.fn(),
  presignDocumentDownload: jest.fn(),
}))
