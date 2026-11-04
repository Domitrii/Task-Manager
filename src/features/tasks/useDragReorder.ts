import { useRef, type PointerEvent } from 'react'

/**
 * Dragging a row by its handle, by finger or mouse. Rows mark themselves with
 * `data-drag={scope}` and `data-drag-id={id}`; the list moves as the pointer
 * crosses another row in the same scope, so what you see is where it'll land.
 */
export function useDragReorder(onMove: (scope: string, id: string, overId: string) => void) {
  const dragging = useRef<{ scope: string; id: string } | null>(null)

  return (scope: string, id: string) => ({
    onPointerDown(event: PointerEvent<HTMLElement>) {
      event.preventDefault()
      dragging.current = { scope, id }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (!dragging.current) return
      const over = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>(`[data-drag="${dragging.current.scope}"]`)?.dataset.dragId
      if (over && over !== dragging.current.id) onMove(dragging.current.scope, dragging.current.id, over)
    },
    onPointerUp() {
      dragging.current = null
    },
    onPointerCancel() {
      dragging.current = null
    },
  })
}

/** The list with `id` moved to where `overId` is. */
export function moveOnto(list: string[], id: string, overId: string): string[] {
  const without = list.filter((entry) => entry !== id)
  without.splice(list.indexOf(overId), 0, id)
  return without
}

/** The list with `id` moved up or down a place, staying put at either end. */
export function moveBy(list: string[], id: string, step: -1 | 1): string[] {
  const index = list.indexOf(id)
  const target = index + step
  if (target < 0 || target >= list.length) return list
  return moveOnto(list, id, list[target])
}
