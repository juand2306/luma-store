import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="main-content flex-1 flex flex-col min-w-0">
        <Header
          mobileOpen={mobileOpen}
          onMenuToggle={() => setMobileOpen(!mobileOpen)}
        />
        <main className="flex-1 p-4 md:p-6 min-w-0 overflow-x-hidden">
          <div className="page-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
