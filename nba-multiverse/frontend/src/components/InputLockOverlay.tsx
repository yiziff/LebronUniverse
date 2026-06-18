import { useStore } from '../store'

export default function InputLockOverlay() {
  const inputLocked = useStore((s) => s.inputLocked)

  if (!inputLocked) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        pointerEvents: 'all',
        cursor: 'not-allowed',
      }}
      aria-hidden="true"
    />
  )
}
