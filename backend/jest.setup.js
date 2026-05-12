// Prevents any test from opening a real MongoDB connection.
// Tests that need to assert on Mongo calls should re-mock specific
// service functions (see __tests__/pings.test.js for an example).
jest.mock('./db/mongo', () => ({
  getMongoDb: jest.fn(),
  getPingCollection: jest.fn(),
  closeMongo: jest.fn(),
}))
