const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const pool = require('../db/pool')
const { authenticate } = require('../middleware/auth')

const VALID_ROLES = ['shipper', 'driver']

function signToken(user) {
  return jwt.sign(
    { user_id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// Register a new user
router.post('/register', async (req, res) => {
  const { first_name, last_name, email, password, role } = req.body

  if (!first_name || !last_name || !email || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Role must be shipper or driver' })
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  try {
    // Hash the password before storing — never store plain text
    const password_hash = await bcrypt.hash(password, 10)

    const result = await pool.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role`,
      [first_name, last_name, email.toLowerCase(), password_hash, role]
    )

    const user = result.rows[0]
    const token = signToken(user)

    res.status(201).json({ token })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' })
    }

    console.error(err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// Login an existing user
router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    const user = result.rows[0]

    // Don't reveal whether email or password was wrong — just say invalid credentials
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) return res.status(401).json({ error: 'Invalid credentials' })

    const token = signToken(user)

    res.status(200).json({ token })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Login failed' })
  }
})

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, first_name, last_name, email, role, drivers_license, created_at
       FROM users
       WHERE id = $1`,
      [req.user.user_id]
    )

    const user = result.rows[0]
    if (!user) return res.status(404).json({ error: 'User not found' })

    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load user' })
  }
})

module.exports = router
