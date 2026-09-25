import { bakeryPack } from './bakery'
import { cafePack } from './cafe'
import { pubPack } from './pub'
import { restaurantPack } from './restaurant'
import { takeawayPack } from './takeaway'
import type { SetupPack, SetupPackId } from './types'

export type * from './types'

/** In the order the setup picker shows them. */
export const SETUP_PACKS: SetupPack[] = [restaurantPack, cafePack, pubPack, takeawayPack, bakeryPack]

export function getSetupPack(id: SetupPackId): SetupPack {
  return SETUP_PACKS.find((pack) => pack.id === id) ?? restaurantPack
}
