export interface BoardTemplateTask {
  title: string
  columnIndex: number
}

export interface BoardTemplate {
  id: string
  title: string
  description: string
  color: string
  tasks: BoardTemplateTask[]
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'marketing-campaign',
    title: 'Marketing-Kampagne',
    description: 'Launch-Checkliste für Kampagnen',
    color: '#8B5CF6',
    tasks: [
      { title: 'Briefing erstellen', columnIndex: 0 },
      { title: 'Zielgruppe definieren', columnIndex: 0 },
      { title: 'Content planen', columnIndex: 1 },
      { title: 'Assets produzieren', columnIndex: 1 },
      { title: 'Kampagne live schalten', columnIndex: 2 },
    ],
  },
  {
    id: 'product-launch',
    title: 'Produkt-Launch',
    description: 'Go-to-Market Vorlage',
    color: '#10B981',
    tasks: [
      { title: 'Feature-Liste finalisieren', columnIndex: 0 },
      { title: 'QA & Testing', columnIndex: 1 },
      { title: 'Launch-Kommunikation', columnIndex: 1 },
      { title: 'Go-Live', columnIndex: 2 },
    ],
  },
]
