import { CHECKLIST_VIEWS } from '@/config/navigation'
import type { ChecklistType } from '@/data/types'
import { ViewChips } from '@/components/shared/ViewChips'
import { ChecklistSection } from './ChecklistSection'

type View = 'all' | 'opening-closing' | 'cleaning' | 'food-safety'

const VIEWS: Record<View, { title: string; description: string; types: ChecklistType[] }> = {
  all: {
    title: 'Checklists',
    description: "Today's opening, closing, cleaning and food safety checklists.",
    types: ['opening', 'closing', 'cleaning', 'food_safety'],
  },
  'opening-closing': {
    title: 'Opening and closing',
    description: 'The start and end of every trading day, signed by the person who did them.',
    types: ['opening', 'closing'],
  },
  cleaning: {
    title: 'Cleaning',
    description: 'Cleaning schedules by area. Each signed-off record goes in your due diligence file.',
    types: ['cleaning'],
  },
  'food-safety': {
    title: 'Food safety checks',
    description: 'The daily review a manager signs off: separation, dates, allergens and cooling.',
    types: ['food_safety'],
  },
}

export function ChecklistsPage({ view }: { view: View }) {
  const { title, description, types } = VIEWS[view]
  return (
    <ChecklistSection
      key={view}
      title={title}
      description={description}
      types={types}
      filters={<ViewChips views={CHECKLIST_VIEWS} label="Checklist types" />}
    />
  )
}
