export interface Repo {
  url: string
  name: string
  description: string
  why: string
  stars: number
  lang: string
  temperature: 'boss' | 'hot' | 'warm' | 'cold'
  temperatures: string[]
}

export interface GraphData {
  repos: Repo[]
  languages: string[]
  weekLabels: string[]
}

export const TEMP_COLORS: Record<string, string> = {
  boss: '#f59e0b',
  hot: '#10b981',
  warm: '#3b82f6',
  cold: '#475569',
}

export const TEMP_GLOW: Record<string, string> = {
  boss: 'rgba(245, 158, 11, 0.4)',
  hot: 'rgba(16, 185, 129, 0.3)',
  warm: 'rgba(59, 130, 246, 0.25)',
  cold: 'rgba(71, 85, 105, 0.15)',
}

export const TEMP_SIZE: Record<string, number> = {
  boss: 16,
  hot: 11,
  warm: 8,
  cold: 5,
}

export function getTempColor(temp: string): string {
  return TEMP_COLORS[temp] || TEMP_COLORS.cold
}

export function getTempGlow(temp: string): string {
  return TEMP_GLOW[temp] || TEMP_GLOW.cold
}

export function getTempSize(temp: string): number {
  return TEMP_SIZE[temp] || TEMP_SIZE.cold
}