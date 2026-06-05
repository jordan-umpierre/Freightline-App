import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { LoadList } from '../App'
import {
  canFetchSelectedLoadData,
  createLoadTooltipContent,
  getBoardLoads,
} from '../lib/loadVisibility'

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

const inTransitLoad = {
  id: 'load-3',
  status: 'in_transit',
  origin_address: 'Overland Park, KS',
  destination_address: 'Nashville, TN',
  weight_lbs: 22000,
  rate_cents: 275000,
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

  test('driver board keeps assigned freight visible so it can be started', () => {
    const deliveredLoad = { ...postedLoad, id: 'load-4', status: 'delivered' }
    const cancelledLoad = { ...postedLoad, id: 'load-5', status: 'cancelled' }

    expect(
      getBoardLoads({ role: 'driver' }, [
        postedLoad,
        assignedLoad,
        inTransitLoad,
        deliveredLoad,
        cancelledLoad,
      ]).map((load) => load.id)
    ).toEqual(['load-1', 'load-2', 'load-3'])
  })

  test('driver skips private data fetches until the load is assigned', () => {
    expect(canFetchSelectedLoadData({ role: 'driver' }, postedLoad)).toBe(false)
    expect(canFetchSelectedLoadData({ role: 'driver' }, assignedLoad)).toBe(true)
    expect(canFetchSelectedLoadData({ role: 'driver' }, inTransitLoad)).toBe(true)
    expect(canFetchSelectedLoadData({ role: 'shipper' }, postedLoad)).toBe(true)
  })

  test('map tooltip content treats addresses as text, not HTML', () => {
    const tooltip = createLoadTooltipContent(
      {
        ...postedLoad,
        origin_address: '<img src=x onerror=alert(1)>',
      },
      null
    )

    expect(tooltip).toBeInstanceOf(HTMLElement)
    expect(tooltip.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(tooltip.innerHTML).not.toContain('<img')
  })
})
