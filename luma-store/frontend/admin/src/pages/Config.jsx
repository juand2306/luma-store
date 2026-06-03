import { Settings } from 'lucide-react'
import { EmptyState } from '../components/ui/Misc'

export default function Config() {
  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-teal-50 rounded-2xl flex items-center justify-center flex-shrink-0">
          <Settings size={20} className="text-teal-600" />
        </div>
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="text-[13px] text-luma-muted mt-0.5">Ajustes de la tienda, usuarios y sistema</p>
        </div>
      </div>
      <div className="card">
        <EmptyState icon={Settings} title="Módulo en construcción" description="Las configuraciones del sistema estarán disponibles pronto." />
      </div>
    </div>
  )
}
