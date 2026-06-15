import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AppProvider, useStore } from './store/useStore.jsx'
import Layout from './components/layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import MemberHome from './pages/MemberHome'
import Services from './pages/Services'
import ServiceDetail from './pages/ServiceDetail'
import Songs from './pages/Songs'
import People from './pages/People'
import Schedule from './pages/Schedule'
import Reports from './pages/Reports'
import Announcements from './pages/Announcements'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import Invitations from './pages/Invitations'
import Attendance from './pages/Attendance'
import Events from './pages/Events'
import WhatsAppBulk from './pages/WhatsAppBulk'

function Spinner() {
  return (
    <div className="flex items-center justify-center h-screen flex-col gap-4">
      <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full"
        style={{ borderWidth:'3px', animation:'spin 0.7s linear infinite' }}/>
      <p className="text-slate-400 text-sm">Loading KDEC Worship...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function AuthGate() {
  const { currentUser, authLoading } = useStore()
  const [inviteCode, setInviteCode] = useState(null)

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('invite')
    if (code) setInviteCode(code)
  }, [])

  if (authLoading) return <Spinner/>
  if (!currentUser)  return <Login inviteCode={inviteCode}/>

  const isAdmin = currentUser?.isAdmin || currentUser?.is_admin

  return (
    <Layout>
      <Routes>
        <Route path="/"              element={isAdmin ? <Dashboard/> : <MemberHome/>}/>
        <Route path="/dashboard"     element={<Dashboard/>}/>
        <Route path="/home"          element={<MemberHome/>}/>
        <Route path="/services"      element={<Services/>}/>
        <Route path="/services/:id"  element={<ServiceDetail/>}/>
        <Route path="/songs"         element={<Songs/>}/>
        <Route path="/people"        element={<People/>}/>
        <Route path="/schedule"      element={<Schedule/>}/>
        <Route path="/reports"       element={<Reports/>}/>
        <Route path="/announcements" element={<Announcements/>}/>
        <Route path="/attendance"    element={<Attendance/>}/>
        <Route path="/events"        element={<Events/>}/>
        <Route path="/settings"      element={<Settings/>}/>
        <Route path="/profile"       element={<Profile/>}/>
        <Route path="/invitations"   element={<Invitations/>}/>
        <Route path="/whatsapp"      element={<WhatsAppBulk/>}/>
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AuthGate/>
      </BrowserRouter>
    </AppProvider>
  )
}
