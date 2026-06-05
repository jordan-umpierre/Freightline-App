import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import ErrorBoundary from '../components/ErrorBoundary'

function BrokenComponent() {
  throw new Error('Boom')
}

beforeEach(() => {
  // React logs caught errors to console.error — suppress for cleaner test output
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  console.error.mockRestore()
})

test('renders fallback UI when a child component throws', () => {
  render(
    <ErrorBoundary>
      <BrokenComponent />
    </ErrorBoundary>
  )

  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
})

test('renders children normally when no error occurs', () => {
  render(
    <ErrorBoundary>
      <p>All good</p>
    </ErrorBoundary>
  )

  expect(screen.getByText('All good')).toBeInTheDocument()
})
