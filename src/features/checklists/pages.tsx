import { ChecklistSection } from './ChecklistSection'

export function CleaningPage() {
  return (
    <ChecklistSection
      title="Cleaning"
      description="Scheduled cleaning schedules by area. Each signed-off record is part of your due-diligence file."
      types={['cleaning']}
    />
  )
}

export function OpeningClosingPage() {
  return (
    <ChecklistSection
      title="Opening & closing checks"
      description="The start and end of every trading day, recorded by the person who carried them out."
      types={['opening', 'closing']}
    />
  )
}
