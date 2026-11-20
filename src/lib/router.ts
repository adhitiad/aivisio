import { useRouterState } from '@tanstack/react-router'

/** Pengganti usePathname() dari Next.js. */
export function usePathname(): string {
  return useRouterState({ select: (state) => state.location.pathname })
}
