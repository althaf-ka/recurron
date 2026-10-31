import { useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 1024
const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

// useSyncExternalStore requires an event-listener callback.
// eslint-disable-next-line promise/prefer-await-to-callbacks
const subscribe = (callback: () => void) => {
  const mediaQuery = window.matchMedia(query)
  mediaQuery.addEventListener('change', callback)
  return () => {
    mediaQuery.removeEventListener('change', callback)
  }
}

const getSnapshot = () => window.matchMedia(query).matches
const getServerSnapshot = () => false

export const useIsMobile = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
