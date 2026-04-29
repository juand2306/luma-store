import { Settings } from 'lucide-react'
import { EmptyState } from '../components/ui/Misc'

export default function Config() {
  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h2 className="page-title">Configuración</h2>
        <p className="text-[13px] text-luma-muted mt-0.5">Ajustes de la tienda, usuarios y sistema</p>
      </div>
      <div className="card">
        <EmptyState icon={Settings} title="Módulo en construcción" description="Las configuraciones del sistema estarán disponibles pronto." />
      </div>
    </div>
  )
}
