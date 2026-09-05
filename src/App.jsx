import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import { AppProvider, useStore } from './store/useStore.jsx'
import { ADMIN_CONTROL_PERMISSIONS, hasAnyPermission, hasPermission, isAdminUser } from './lib/permissions.js'
import Layout from './components/layout'
import { Notifications } from './components/ui'
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const MemberHome = lazy(() => import('./pages/MemberHome'))
const Services = lazy(() => import('./pages/Services'))
const ServiceDetail = lazy(() => import('./pages/ServiceDetail'))
const Songs = lazy(() => import('./pages/Songs'))
const SongDetail = lazy(() => import('./pages/SongDetail'))
const People = lazy(() => import('./pages/People'))
const Schedule = lazy(() => import('./pages/Schedule'))
const Reports = lazy(() => import('./pages/Reports'))
const Announcements = lazy(() => import('./pages/Announcements'))
const Settings = lazy(() => import('./pages/Settings'))
const Profile = lazy(() => import('./pages/Profile'))
const Invitations = lazy(() => import('./pages/Invitations'))
const Attendance = lazy(() => import('./pages/Attendance'))
const Events = lazy(() => import('./pages/Events'))
const WhatsAppBulk = lazy(() => import('./pages/WhatsAppBulk'))
const Requests = lazy(() => import('./pages/Requests'))
const AdminControl = lazy(() => import('./pages/AdminControl'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

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

function ConfigurationError() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white flex items-center justify-center">
      <section className="w-full max-w-lg rounded-2xl border border-red-400/30 bg-slate-900 p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-red-300">Configuration required</p>
        <h1 className="mt-2 text-2xl font-bold">KDEC Worship cannot start safely.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Configure valid <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> values,
          then restart the application to connect to the live database.
        </p>
      </section>
    </main>
  )
}

function AdminOnly({ children }) {
  const { currentUser } = useStore()
  return isAdminUser(currentUser) ? children : <Navigate to="/" replace />
}

function PermissionOnly({ permission, children }) {
  const { currentUser } = useStore()
  return hasPermission(currentUser,permission) ? children : <Navigate to="/" replace />
}

function PermissionOnlyAny({ permissions, children }) {
  const { currentUser } = useStore()
  return hasAnyPermission(currentUser,permissions) ? children : <Navigate to="/" replace />
}

function AuthGate() {
  const { currentUser, authLoading, configurationError, isPasswordRecovery, notifications } = useStore()
  const inviteCode = new URLSearchParams(window.location.search).get('invite')

  let content
  if (authLoading) content = <Spinner/>
  else if (configurationError) content = <ConfigurationError/>

  // Password recovery link clicked — show "set new password" screen
  // regardless of whether Supabase created a temporary session
  else if (isPasswordRecovery) content = <Suspense fallback={<Spinner/>}><ResetPassword/></Suspense>
  else if (!currentUser) content = <Suspense fallback={<Spinner/>}><Login inviteCode={inviteCode}/></Suspense>
  else {
    const isAdmin = isAdminUser(currentUser)
    content = (
      <Layout>
        <Suspense fallback={<Spinner/>}><Routes>
          <Route path="/"              element={isAdmin ? <Dashboard/> : <MemberHome/>}/>
          <Route path="/dashboard"     element={<AdminOnly><Dashboard/></AdminOnly>}/>
          <Route path="/home"          element={<MemberHome/>}/>
          <Route path="/services"      element={<Services/>}/>
          <Route path="/services/:id"  element={<ServiceDetail/>}/>
          <Route path="/songs"         element={<Songs/>}/>
          <Route path="/songs/:id"     element={<SongDetail/>}/>
          <Route path="/people"        element={<PermissionOnly permission="users.view"><People/></PermissionOnly>}/>
          <Route path="/schedule"      element={<Schedule/>}/>
          <Route path="/reports"       element={<PermissionOnly permission="reports.view"><Reports/></PermissionOnly>}/>
          <Route path="/announcements" element={<Announcements/>}/>
          <Route path="/attendance"    element={<Attendance/>}/>
          <Route path="/checkin/:token" element={<Attendance/>}/>
          <Route path="/events"        element={<Events/>}/>
          <Route path="/requests"      element={<Requests/>}/>
          <Route path="/settings"      element={<Settings/>}/>
          <Route path="/profile"       element={<Profile/>}/>
          <Route path="/invitations"   element={<PermissionOnly permission="invitations.manage"><Invitations/></PermissionOnly>}/>
          <Route path="/whatsapp"      element={<PermissionOnly permission="users.view"><WhatsAppBulk/></PermissionOnly>}/>
          <Route path="/admin/settings" element={<PermissionOnlyAny permissions={ADMIN_CONTROL_PERMISSIONS}><AdminControl/></PermissionOnlyAny>}/>
          <Route path="*"              element={<Navigate to="/" replace/>}/>
        </Routes></Suspense>
      </Layout>
    )
  }

  return <>{content}<Notifications items={notifications}/></>
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
