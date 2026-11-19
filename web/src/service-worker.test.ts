import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { afterEach, describe, expect, it, vi } from 'vitest'

type WorkerEventHandler = (event: Record<string, unknown>) => void
type WorkerClient = { url: string; focus: () => Promise<unknown> }

const workerSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')

const loadWorker = () => {
  const handlers = new Map<string, WorkerEventHandler>()
  const showNotification = vi.fn(() => Promise.resolve())
  const matchAll = vi.fn<() => Promise<WorkerClient[]>>(() => Promise.resolve([]))
  const openWindow = vi.fn(() => Promise.resolve(undefined))
  const worker = {
    location: new URL('https://move-well.example.test/'),
    registration: {
      scope: 'https://move-well.example.test/',
      showNotification,
    },
    clients: { matchAll, openWindow },
    addEventListener: (name: string, handler: WorkerEventHandler) => handlers.set(name, handler),
  }

  runInNewContext(workerSource, {
    URL,
    self: worker,
    console,
    Promise,
    Set,
  })

  return { handlers, matchAll, openWindow, showNotification }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('service-worker push handling', () => {
  it('displays a defensive notification for a JSON push payload', async () => {
    const { handlers, showNotification } = loadWorker()
    const waitUntil = vi.fn((promise: Promise<unknown>) => promise)
    const pushHandler = handlers.get('push')!

    pushHandler({
      data: { json: () => ({ title: 'Move well', body: 'Start your routine.', url: './?view=Schedule' }) },
      waitUntil,
    })
    await waitUntil.mock.results[0]?.value

    expect(showNotification).toHaveBeenCalledWith('Move well', expect.objectContaining({
      body: 'Start your routine.',
      tag: 'move-well-workout',
      data: { url: 'https://move-well.example.test/?view=Schedule' },
    }))
  })

  it('uses a safe fallback when a push payload is not valid JSON', async () => {
    const { handlers, showNotification } = loadWorker()
    const waitUntil = vi.fn((promise: Promise<unknown>) => promise)
    const pushHandler = handlers.get('push')!

    pushHandler({
      data: {
        json: () => { throw new Error('invalid payload') },
        text: () => 'A plain-text workout reminder.',
      },
      waitUntil,
    })
    await waitUntil.mock.results[0]?.value

    expect(showNotification).toHaveBeenCalledWith('Workout reminder', expect.objectContaining({
      body: 'A plain-text workout reminder.',
    }))
  })

  it('focuses an existing app client when a notification is clicked', async () => {
    const { handlers, matchAll, openWindow } = loadWorker()
    const focus = vi.fn(() => Promise.resolve(undefined))
    matchAll.mockResolvedValue([{ url: 'https://move-well.example.test/', focus }])
    const waitUntil = vi.fn((promise: Promise<unknown>) => promise)
    const close = vi.fn()

    handlers.get('notificationclick')!({
      notification: { close, data: { url: 'https://move-well.example.test/?view=Schedule' } },
      waitUntil,
    })
    await waitUntil.mock.results[0]?.value

    expect(close).toHaveBeenCalledOnce()
    expect(focus).toHaveBeenCalledOnce()
    expect(openWindow).not.toHaveBeenCalled()
  })
})
