import { Store } from '@tanstack/react-store'

/** State UI global ringan (TanStack Store) — tidak disimpan di server. */
export const uiStore = new Store({
  unreadNotifications: 0,
  notificationsOpen: false,
})

export function setUnreadNotifications(count: number) {
  uiStore.setState((state) => ({ ...state, unreadNotifications: count }))
}

export function setNotificationsOpen(open: boolean) {
  uiStore.setState((state) => ({ ...state, notificationsOpen: open }))
}
