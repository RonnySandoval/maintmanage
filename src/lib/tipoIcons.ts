import {
  ClipboardCheck,
  Droplets,
  Fan,
  GraduationCap,
  Hammer,
  Leaf,
  Lightbulb,
  Paintbrush,
  Plug,
  Shapes,
  ShoppingCart,
  Sparkles,
  Tag,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { tipoActividadOf } from '../db/types'

const BY_ID: Record<string, LucideIcon> = {
  inspeccion: ClipboardCheck,
  reparacion: Wrench,
  compra: ShoppingCart,
  limpieza: Sparkles,
  capacitacion: GraduationCap,
  otro: Tag,
}

const FALLBACKS: LucideIcon[] = [
  Tag,
  Paintbrush,
  Leaf,
  Hammer,
  Plug,
  Droplets,
  Fan,
  Lightbulb,
  Shapes,
]

export function tipoActividadIcon(tipo?: string | null): LucideIcon {
  const id = tipoActividadOf(tipo)
  const known = BY_ID[id]
  if (known) return known
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return FALLBACKS[Math.abs(hash) % FALLBACKS.length]
}
