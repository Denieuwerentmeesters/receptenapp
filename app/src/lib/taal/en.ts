import { EN_ALGEMEEN } from './en.algemeen'
import { EN_A } from './en.a'
import { EN_B } from './en.b'
import { EN_C } from './en.c'
import { EN_D } from './en.boodschappen'
import { EN_E } from './en.e'
import { EN_GELIJK } from './en.gelijk'

/** Nederlands → Engels. Elke schermgroep heeft een eigen bestand. */
export const EN: Record<string, string> = {
  ...EN_ALGEMEEN, ...EN_A, ...EN_B, ...EN_C, ...EN_D, ...EN_E, ...EN_GELIJK,
}
