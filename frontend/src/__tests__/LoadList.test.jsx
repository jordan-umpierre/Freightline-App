import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { LoadList } from '../App'

const postedLoad = {
  id: 'load-1',
  status: 'posted',
  origin_address: 'Kansas City, MO',
  destination_address: 'Dallas, TX',
  weight_lbs: 18000,
  rate_cents: 240000,
}

const assignedLoad = {
  id: 'load-2',
  status: 'assigned',
  origin_address: 'Chicago, IL',
  destination_address: 'Atlanta, GA',
  weight_lbs: 26000,
  rate_cents: 315000,
}

function driverActions(load) {
  if (load.status === 'posted') return <button>Accept</button>
  if (load.status === 'assigned') return <button>Start</button>
  return null
}

describe('LoadList', () => {
  test('renders rows for each load', () => {
    render(
      <LoadList
        title="Available freight"
        loads={[postedLoad, assignedLoad]}
        selectedLoadId=""
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('Available freight')).toBeInTheDocument()
    expect(screen.getByText('Kansas City, MO')).toBeInTheDocument()
    expect(screen.getByText('Atlanta, GA')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  test('renders driver-specific Accept button for posted loads', () => {
    render(
      <LoadList
        title="Available freight"
        loads={[postedLoad]}
        selectedLoadId=""
        onSelect={vi.fn()}
        actions={driverActions}
      />
    )

    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  })

  test('renders driver-specific Start button for assigned loads', () => {
    render(
      <LoadList
        title="Active freight"
        loads={[assignedLoad]}
        selectedLoadId=""
        onSelect={vi.fn()}
        actions={driverActions}
      />
    )

    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  test('renders no action buttons when actions prop is omitted', () => {
    render(
      <LoadList
        title="Posted freight"
        loads={[postedLoad, assignedLoad]}
        selectedLoadId=""
        onSelect={vi.fn()}
      />
    )

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
