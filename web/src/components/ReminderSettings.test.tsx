// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReminderSettings from './ReminderSettings'
import { createDefaultStorageState, createStorageAdapter, type StorageLike } from '../storage'
import type { FitnessStorageState } from '../types'
import type { NotificationApi } from '../notifications'

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const createTestStorage = (changes: Partial<FitnessStorageState['reminders']> = {}) => {
  const storage = new MemoryStorage()
  const adapter = createStorageAdapter(storage)
  const state = createDefaultStorageState()
  adapter.write({ ...state, reminders: { ...state.reminders, ...changes } })
  return adapter
}

const createNotification = (
  permission: NotificationApi['permission'],
  requestPermission = vi.fn(() => Promise.resolve(permission)),
): NotificationApi => ({ permission, requestPermission })

describe('ReminderSettings', () => {
  afterEach(() => cleanup())

  it('shows the unsupported fallback and does not request permission on render', () => {
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    const notificationApi = createNotification('default', requestPermission)

    render(<ReminderSettings notificationApi={null} storageAdapter={createTestStorage()} />)

    expect(screen.getByRole('status')).toHaveTextContent('Reminders remain visible in your schedule')
    expect(screen.getByRole('status')).toHaveTextContent('browser notifications are unavailable')
    expect(screen.queryByRole('button', { name: /enable browser notifications/i })).toBeNull()
    expect(requestPermission).not.toHaveBeenCalled()
    expect(notificationApi.permission).toBe('default')
  })

  it('requests permission only after the explicit action and persists a granted outcome', async () => {
    const user = userEvent.setup()
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    const adapter = createTestStorage()

    render(<ReminderSettings notificationApi={createNotification('default', requestPermission)} storageAdapter={adapter} />)

    expect(requestPermission).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /enable browser notifications/i }))

    expect(requestPermission).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('Notifications ready')
    expect(adapter.read().reminders.notificationCapability).toBe('granted')
  })

  it('renders a clear denied message after a denied permission outcome', async () => {
    const user = userEvent.setup()
    const requestPermission = vi.fn(() => Promise.resolve('denied' as const))

    render(<ReminderSettings notificationApi={createNotification('default', requestPermission)} storageAdapter={createTestStorage()} />)
    await user.click(screen.getByRole('button', { name: /enable browser notifications/i }))

    expect(screen.getByRole('status')).toHaveTextContent('Browser notifications are blocked')
    expect(screen.getByRole('status')).toHaveTextContent('Allow notifications in your browser settings')
  })

  it('persists reminder enabled state and time without requesting permission', async () => {
    const user = userEvent.setup()
    const requestPermission = vi.fn(() => Promise.resolve('granted' as const))
    const adapter = createTestStorage({ notificationCapability: 'unsupported' })

    render(<ReminderSettings notificationApi={null} storageAdapter={adapter} />)
    await user.click(screen.getByRole('checkbox', { name: /enable workout reminders/i }))
    fireEvent.change(screen.getByLabelText('Reminder time'), { target: { value: '07:30' } })

    expect(adapter.read().reminders.enabled).toBe(true)
    expect(adapter.read().reminders.time).toBe('07:30')
    expect(requestPermission).not.toHaveBeenCalled()
  })

  it('shows non-fatal foreground reminder feedback', () => {
    const adapter = createTestStorage()

    render(
      <ReminderSettings
        foregroundError="Your reminder was due, but the browser could not display it."
        storageAdapter={adapter}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('could not display it')
  })
})
