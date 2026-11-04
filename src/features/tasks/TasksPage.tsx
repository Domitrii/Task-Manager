import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  ArrowDown,
  ArrowUp,
  ChevronUp,
  ClipboardList,
  FolderPlus,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  SearchX,
} from 'lucide-react'
import { useStore } from '@/data/store'
import {
  byPriority,
  isCurrentTask,
  NO_SECTION,
  NO_SECTION_NAME,
  orderedSections,
  orderedTasks,
  sectionKey,
} from '@/data/tasks'
import type { ID, Task, TaskSection } from '@/data/types'
import { useNow } from '@/lib/useNow'
import { cn } from '@/lib/utils'
import { Banner } from '@/components/ui/Banner'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Menu, MenuItem } from '@/components/ui/Menu'
import { ChipTabs } from '@/components/ui/Tabs'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/shared/PageHeader'
import { SearchField } from '@/components/shared/SearchField'
import { SortMenu, type SortOrder } from '@/components/shared/SortMenu'
import { useHeaderProgress } from '@/components/layout/headerProgress'
import { useSync } from '@/features/account/sync'
import { NewTaskModal } from './NewTaskModal'
import { DeleteSectionDialog, GroupSheet } from './SectionDialogs'
import { TaskRunModal } from './TaskRunModal'
import { EditableTaskRow, needsRunning, ReorderTaskRow, TaskRow } from './TaskRow'
import { moveBy, moveOnto, useDragReorder } from './useDragReorder'

/** Everything of mine, one section, what's finished, or what other people have on. */
type View = 'mine' | 'completed' | 'team' | ID
type Mode = 'list' | 'edit' | 'reorder'

interface Group {
  key: string
  name: string
  section?: TaskSection
  tasks: Task[]
}

const SECTIONS_SCOPE = 'sections'

const count = (value: number, word = 'task') => `${value} ${word}${value === 1 ? '' : 's'}`

/** The list everyone works from: the day's tasks, grouped into named sections. */
export function TasksPage() {
  const now = useNow()
  const { data, activeStaff, activeStaffId, updateTask, deleteTask, reorderTasks, reorderTaskSections } = useStore()
  const sync = useSync()
  const toast = useToast()
  const [chosen, setView] = useState<View>('mine')
  const [mode, setMode] = useState<Mode>('list')
  const [sort, setSort] = useState<SortOrder>('recent')
  const [query, setQuery] = useState('')
  const [folded, setFolded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [naming, setNaming] = useState<{ section?: TaskSection } | null>(null)
  const [deleting, setDeleting] = useState<TaskSection | null>(null)
  // By id, so the sheet always shows the task as it is in the store.
  const [runningId, setRunningId] = useState<ID | null>(null)
  const running = data.tasks.find((task) => task.id === runningId)
  // The order being put together, until it's saved.
  const [order, setOrder] = useState<Record<string, string[]>>({})

  const sections = useMemo(() => orderedSections(data.taskSections), [data.taskSections])
  const hasLoose = useMemo(
    () => data.tasks.some((task) => isCurrentTask(task, now) && sectionKey(task, sections) === NO_SECTION),
    [data.tasks, sections, now],
  )

  const sectionOf = (key: string) => sections.find((section) => section.id === key)
  // A section can go while it's open: deleted here, or on someone else's device.
  const view: View =
    ['mine', 'completed', 'team'].includes(chosen) || sectionOf(chosen) || (chosen === NO_SECTION && hasLoose)
      ? chosen
      : 'mine'
  const search = query.trim().toLowerCase()

  const inView = useMemo(() => {
    const current = data.tasks.filter((task) => isCurrentTask(task, now))
    if (view === 'mine') return current.filter((task) => task.assigneeId === activeStaffId)
    if (view === 'team') return current.filter((task) => task.assigneeId !== activeStaffId)
    if (view === 'completed') {
      return data.tasks
        .filter((task) => task.status === 'done')
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    }
    return current.filter((task) => sectionKey(task, sections) === view)
  }, [data.tasks, view, activeStaffId, sections, now])

  const visible = useMemo(
    () =>
      search
        ? inView.filter((task) => `${task.title} ${task.description ?? ''}`.toLowerCase().includes(search))
        : inView,
    [inView, search],
  )

  const groups = useMemo<Group[]>(() => {
    const sorted = view === 'completed' ? (list: Task[]) => list : sort === 'priority' ? byPriority : orderedTasks
    const list: Group[] = sections.map((section) => ({ key: section.id, name: section.name, section, tasks: [] }))
    const loose: Group = { key: NO_SECTION, name: NO_SECTION_NAME, tasks: [] }
    for (const task of visible) {
      const key = sectionKey(task, sections)
      ;(list.find((group) => group.key === key) ?? loose).tasks.push(task)
    }
    return [...list, loose]
      .map((group) => ({ ...group, tasks: sorted(group.tasks) }))
      // A chosen section stays on screen when it's empty, so it can be renamed or deleted.
      .filter((group) => group.tasks.length > 0 || (group.key === view && !search))
  }, [visible, sections, sort, view, search])

  const done = visible.filter((task) => task.status === 'done').length
  const headerLabel = search
    ? 'Search results'
    : view === 'mine'
      ? `${activeStaff.name.split(' ')[0]}’s tasks`
      : view === 'completed'
        ? 'Completed'
        : view === 'team'
          ? 'Tasks for other people'
          : view === NO_SECTION
            ? NO_SECTION_NAME
            : (sectionOf(view)?.name ?? 'Tasks')
  useHeaderProgress(`${headerLabel} · ${done} of ${visible.length} complete`, done, visible.length)

  const countLine = search
    ? `${count(visible.length, 'result')} for “${query.trim()}”`
    : view === 'mine'
      ? `${activeStaff.name} · ${count(visible.length)}`
      : view === 'team'
        ? `Team · ${count(visible.length)}`
        : count(visible.length)

  function toggle(task: Task) {
    if (task.status === 'done') updateTask(task.id, { status: 'todo', completedAt: undefined })
    // Questions and photos come first, so ticking one of those opens it.
    else if (needsRunning(task)) setRunningId(task.id)
    else updateTask(task.id, { status: 'done', completedAt: new Date().toISOString() })
  }

  function startReorder() {
    setSort('recent')
    const next: Record<string, string[]> = { [SECTIONS_SCOPE]: groups.map((group) => group.key) }
    for (const group of groups) next[group.key] = orderedTasks(group.tasks).map((task) => task.id)
    setOrder(next)
    setMode('reorder')
  }

  const drag = useDragReorder((scope, id, overId) =>
    setOrder((current) => ({ ...current, [scope]: moveOnto(current[scope], id, overId) })),
  )

  function saveOrder() {
    reorderTaskSections(
      // Sections on another view keep their places, after these.
      [...order[SECTIONS_SCOPE], ...sections.map((section) => section.id)].filter(
        (key, index, list) => key !== NO_SECTION && list.indexOf(key) === index,
      ),
    )
    const positions = new Map<ID, number>()
    for (const group of groups) {
      // Only what's on screen moves; anything else in the section keeps its slot.
      const shown = order[group.key] ?? []
      const slots = new Set(shown)
      let next = 0
      orderedTasks(data.tasks.filter((task) => sectionKey(task, sections) === group.key)).forEach((task, index) => {
        positions.set(slots.has(task.id) ? shown[next++] : task.id, index)
      })
    }
    reorderTasks(positions)
    setMode('list')
    toast.success('Order saved')
  }

  const orderedGroups =
    mode === 'reorder'
      ? (order[SECTIONS_SCOPE] ?? [])
          .map((key) => groups.find((group) => group.key === key))
          .filter((group): group is Group => Boolean(group))
      : groups

  const chips = [
    { value: 'mine', label: 'All my tasks' },
    ...sections.map((section) => ({ value: section.id, label: section.name })),
    ...(hasLoose ? [{ value: NO_SECTION, label: NO_SECTION_NAME }] : []),
    { value: 'completed', label: 'Completed' },
    { value: 'team', label: 'Team' },
  ]

  return (
    <div className="space-y-3.5">
      <PageHeader title="Checklist" description={`${data.settings.venueName} · ${format(now, 'EEE d MMM yyyy')}`} />

      {sync?.status.state === 'offline' && sync.status.pending > 0 ? (
        <Banner tone="warn" title="Changes waiting to sync">
          You’re offline. Changes will sync when you reconnect.
        </Banner>
      ) : null}

      {mode === 'list' ? (
        <div className="flex items-center gap-2">
          <SearchField value={query} onChange={setQuery} placeholder="Search task" />
          <IconButton label="New task" variant="primary" onClick={() => setAdding(true)} className="shrink-0">
            <Plus className="size-5" />
          </IconButton>
          <Menu
            width="w-52"
            trigger={({ toggle: toggleMenu }) => (
              <IconButton label="More actions" variant="secondary" onClick={toggleMenu} className="shrink-0">
                <MoreHorizontal className="size-5" />
              </IconButton>
            )}
          >
            {({ close }) => (
              <>
                <MenuItem
                  icon={<Pencil className="size-4" />}
                  onClick={() => {
                    setMode('edit')
                    close()
                  }}
                >
                  Edit
                </MenuItem>
                <MenuItem
                  icon={<FolderPlus className="size-4" />}
                  onClick={() => {
                    setNaming({})
                    close()
                  }}
                >
                  Create new group
                </MenuItem>
                <MenuItem
                  icon={<GripVertical className="size-4" />}
                  onClick={() => {
                    startReorder()
                    close()
                  }}
                >
                  Reorder
                </MenuItem>
              </>
            )}
          </Menu>
        </div>
      ) : mode === 'edit' ? (
        <Button variant="primary" size="lg" block onClick={() => setMode('list')}>
          Finish editing
        </Button>
      ) : (
        <Button variant="primary" size="lg" block onClick={saveOrder}>
          Save order
        </Button>
      )}

      <ChipTabs
        label="Show tasks"
        options={chips}
        value={view}
        onChange={(next) => {
          // The order being put together belongs to what's on screen.
          if (mode === 'reorder') setMode('list')
          setView(next)
        }}
      />

      {mode === 'reorder' ? (
        <p className="text-ink-muted text-[13px]">Drag a section or task, or use the up and down controls.</p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-ink-muted min-w-0 truncate text-[13px]">{countLine}</p>
          {view === 'completed' ? null : (
            <SortMenu value={sort} onChange={setSort} />
          )}
        </div>
      )}

      {orderedGroups.length === 0 ? (
        search ? (
          <EmptyState
            icon={<SearchX className="size-5" />}
            title="No matching tasks"
            description={`No results for “${query.trim()}”. Try another task name.`}
          />
        ) : (
          <EmptyState
            icon={<ClipboardList className="size-5" />}
            title={view === 'completed' ? 'Nothing completed yet' : view === 'team' ? 'Nothing for other people' : 'No tasks yet'}
            description={
              view === 'completed'
                ? 'Finished tasks will show up here.'
                : view === 'team'
                  ? 'Tasks assigned to the rest of the team will show up here.'
                  : 'Create your first task to organise the kitchen’s day.'
            }
          />
        )
      ) : (
        <div className="space-y-3">
          {orderedGroups.map((group) => (
            <section
              key={group.key}
              data-drag={mode === 'reorder' ? SECTIONS_SCOPE : undefined}
              data-drag-id={group.key}
              aria-label={group.name}
              className="bg-surface shadow-card rounded-card p-3"
            >
              <header className="flex items-start gap-1 px-1 pb-1">
                {mode === 'reorder' ? (
                  <span
                    {...drag(SECTIONS_SCOPE, group.key)}
                    className="text-ink-subtle -ml-1 flex size-9 cursor-grab touch-none items-center justify-center"
                    aria-hidden
                  >
                    <GripVertical className="size-5" />
                  </span>
                ) : null}
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 className="font-display text-ink text-[17px] leading-6 font-bold">{group.name}</h2>
                  <p className="text-ink-muted text-xs">
                    {group.tasks.filter((task) => task.status === 'done').length} of {group.tasks.length} completed
                  </p>
                </div>
                {mode === 'reorder' ? (
                  <>
                    <IconButton
                      label={`Move ${group.name} up`}
                      size="sm"
                      onClick={() =>
                        setOrder((current) => ({
                          ...current,
                          [SECTIONS_SCOPE]: moveBy(current[SECTIONS_SCOPE], group.key, -1),
                        }))
                      }
                    >
                      <ArrowUp className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Move ${group.name} down`}
                      size="sm"
                      onClick={() =>
                        setOrder((current) => ({
                          ...current,
                          [SECTIONS_SCOPE]: moveBy(current[SECTIONS_SCOPE], group.key, 1),
                        }))
                      }
                    >
                      <ArrowDown className="size-4" />
                    </IconButton>
                  </>
                ) : (
                  <>
                    {group.section && mode === 'list' ? (
                      <IconButton label={`Edit ${group.name}`} size="sm" onClick={() => setMode('edit')}>
                        <Pencil className="size-4" />
                      </IconButton>
                    ) : null}
                    <IconButton
                      label={folded.has(group.key) ? `Show ${group.name}` : `Hide ${group.name}`}
                      size="sm"
                      onClick={() =>
                        setFolded((current) => {
                          const next = new Set(current)
                          if (!next.delete(group.key)) next.add(group.key)
                          return next
                        })
                      }
                    >
                      <ChevronUp className={cn('size-4 transition-transform', folded.has(group.key) && 'rotate-180')} />
                    </IconButton>
                  </>
                )}
              </header>

              {mode === 'edit' && group.section ? (
                <div className="flex gap-2 px-1 py-1.5">
                  <Button size="sm" className="flex-1" onClick={() => setNaming({ section: group.section })}>
                    Rename
                  </Button>
                  <Button size="sm" className="flex-1" onClick={() => setDeleting(group.section ?? null)}>
                    Delete section
                  </Button>
                </div>
              ) : null}

              {folded.has(group.key) && mode !== 'reorder' ? null : group.tasks.length === 0 ? (
                <p className="text-ink-muted px-1 py-2 text-[13px]">No tasks in this section yet.</p>
              ) : (
                <ul className="space-y-1">
                  {mode === 'reorder'
                    ? (order[group.key] ?? [])
                        .map((id) => group.tasks.find((task) => task.id === id))
                        .filter((task): task is Task => Boolean(task))
                        .map((task) => (
                          <ReorderTaskRow
                            key={task.id}
                            task={task}
                            now={now}
                            scope={group.key}
                            drag={drag(group.key, task.id)}
                            onMove={(step) =>
                              setOrder((current) => ({
                                ...current,
                                [group.key]: moveBy(current[group.key], task.id, step),
                              }))
                            }
                          />
                        ))
                    : group.tasks.map((task) =>
                        mode === 'edit' ? (
                          <EditableTaskRow key={task.id} task={task} now={now} onRemove={() => deleteTask(task.id)} />
                        ) : (
                          <TaskRow
                            key={task.id}
                            task={task}
                            now={now}
                            onToggle={() => toggle(task)}
                            onRun={() => setRunningId(task.id)}
                          />
                        ),
                      )}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {adding ? (
        <NewTaskModal
          onClose={() => setAdding(false)}
          defaultSectionId={view === NO_SECTION || sectionOf(view) ? view : undefined}
        />
      ) : null}
      {naming ? <GroupSheet section={naming.section} onClose={() => setNaming(null)} onCreated={setView} /> : null}
      {deleting ? <DeleteSectionDialog section={deleting} onClose={() => setDeleting(null)} /> : null}
      {running ? <TaskRunModal key={running.id} task={running} onClose={() => setRunningId(null)} /> : null}
    </div>
  )
}
