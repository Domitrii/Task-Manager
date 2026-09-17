import { TemperatureSection } from './TemperatureSection'

export function AllTemperaturesPage() {
  return (
    <TemperatureSection
      title="Temperature checks"
      description="Every monitored fridge, freezer, hot-holding unit and cooking process in one place."
    />
  )
}

export function FridgeTemperaturesPage() {
  return (
    <TemperatureSection
      title="Fridge temperatures"
      description="Chilled storage and display units. Readings must sit inside each unit's safe range at every scheduled check."
      categories={['fridge', 'display_fridge']}
    />
  )
}

export function FreezerTemperaturesPage() {
  return (
    <TemperatureSection
      title="Freezer temperatures"
      description="Frozen storage. A unit drifting above −18°C needs acting on before stock is affected."
      categories={['freezer']}
    />
  )
}

export function HotHoldingTemperaturesPage() {
  return (
    <TemperatureSection
      title="Hot-holding temperatures"
      description="Food held hot for service must stay at 63°C or above. Record at the start and through each service."
      categories={['hot_holding']}
    />
  )
}

export function CookingTemperaturesPage() {
  return (
    <TemperatureSection
      title="Cooking & cooling"
      description="Core probe readings taken per batch. Cooked food should reach 75°C or above; cooling food must be below 8°C within 90 minutes."
      categories={['cooking', 'cooling']}
      todayLabel="Today's probes"
    />
  )
}
