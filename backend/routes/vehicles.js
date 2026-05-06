const express = require('express')
const pool = require('../db/pool')
const { authenticate, authorize } = require('../middleware/auth')

const router = express.Router()
const VALID_STATUSES = ['available', 'in_transit', 'out_of_service']

function toPositiveInteger(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

router.use(authenticate)

router.get('/me', authorize(['driver']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, carrier_id, driver_id, status, capacity_lbs, oversized, created_at, updated_at
       FROM vehicles
       WHERE driver_id = $1
       ORDER BY created_at DESC`,
      [req.user.user_id]
    )

    res.json({ vehicles: result.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load vehicles' })
  }
})

router.post('/', authorize(['driver']), async (req, res) => {
  const capacityLbs = toPositiveInteger(req.body.capacity_lbs)
  const oversized = Boolean(req.body.oversized)
  const status = req.body.status || 'available'

  if (!capacityLbs) {
    return res.status(400).json({ error: 'capacity_lbs must be a positive integer' })
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid vehicle status' })
  }

  try {
    const result = await pool.query(
      `INSERT INTO vehicles (carrier_id, driver_id, status, capacity_lbs, oversized)
       VALUES ($1, $1, $2, $3, $4)
       RETURNING id, carrier_id, driver_id, status, capacity_lbs, oversized, created_at, updated_at`,
      [req.user.user_id, status, capacityLbs, oversized]
    )

    res.status(201).json({ vehicle: result.rows[0] })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not create vehicle' })
  }
})

module.exports = router
