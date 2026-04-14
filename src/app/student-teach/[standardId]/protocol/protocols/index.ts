export { ThemeConceptBuilding } from './ELA9R12Protocols'
export { ThemeHuntingStrategy } from './ELA9R12Protocols'
export { ConnotativeLanguage } from './ELA9R12Protocols'
export { AbstractionLadder } from './ELA9R12Protocols'
export { ThemeEvidenceMapping } from './ELA9R12Protocols'
export { LiteraryAnalysisParagraph } from './ELA9R12Protocols'

export const ELA9R12_PROTOCOLS = {
  ThemeConceptBuilding: () => import('./ELA9R12Protocols').then(m => m.ThemeConceptBuilding),
  ThemeHuntingStrategy: () => import('./ELA9R12Protocols').then(m => m.ThemeHuntingStrategy),
  ConnotativeLanguage:  () => import('./ELA9R12Protocols').then(m => m.ConnotativeLanguage),
  AbstractionLadder:    () => import('./ELA9R12Protocols').then(m => m.AbstractionLadder),
  ThemeEvidenceMapping: () => import('./ELA9R12Protocols').then(m => m.ThemeEvidenceMapping),
  LiteraryAnalysisParagraph: () => import('./ELA9R12Protocols').then(m => m.LiteraryAnalysisParagraph),
}
