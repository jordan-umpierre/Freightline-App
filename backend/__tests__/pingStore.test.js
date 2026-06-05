const { getPingCollection } = require('../db/mongo')
const { getLatestPingsByLoadIds } = require('../services/pingStore')

// db/mongo is globally mocked in jest.setup.js

function makePingDoc(overrides = {}) {
  return {
    _id: 'ping-1',
    load_id: 'load-1',
    latitude: 39.5,
    longitude: -94.5,
    speed_mph: 60,
    heading_degrees: 180,
    recorded_at: new Date('2026-05-01T12:00:00Z'),
    created_at: new Date('2026-05-01T12:00:01Z'),
    source: 'driver_api',
    ...overrides,
  }
}

function mockCollection(aggregateResults) {
  return {
    createIndexes: jest.fn().mockResolvedValue(true),
    aggregate: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue(aggregateResults),
    }),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('getLatestPingsByLoadIds', () => {
  test('returns an empty Map when no load IDs are provided', async () => {
    const result = await getLatestPingsByLoadIds([])
    expect(result).toBeInstanceOf(Map)
    expect(result.size).toBe(0)
  })

  test('uses MongoDB aggregation ($group) to return one ping per load', async () => {
    const ping = makePingDoc()
    const coll = mockCollection([{ _id: 'load-1', ping }])
    getPingCollection.mockResolvedValue(coll)

    const result = await getLatestPingsByLoadIds(['load-1'])

    expect(coll.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ $match: { load_id: { $in: ['load-1'] } } }),
        expect.objectContaining({ $group: expect.objectContaining({ _id: '$load_id' }) }),
      ])
    )
    expect(result.get('load-1')).toMatchObject({ load_id: 'load-1', latitude: 39.5 })
  })

  test('returns serialized pings keyed by load_id for multiple loads', async () => {
    const ping1 = makePingDoc({ _id: 'p1', load_id: 'load-a', latitude: 38 })
    const ping2 = makePingDoc({ _id: 'p2', load_id: 'load-b', latitude: 40 })
    const coll = mockCollection([
      { _id: 'load-a', ping: ping1 },
      { _id: 'load-b', ping: ping2 },
    ])
    getPingCollection.mockResolvedValue(coll)

    const result = await getLatestPingsByLoadIds(['load-a', 'load-b'])

    expect(result.size).toBe(2)
    expect(result.get('load-a')).toMatchObject({ load_id: 'load-a', id: 'p1' })
    expect(result.get('load-b')).toMatchObject({ load_id: 'load-b', id: 'p2' })
  })
})
