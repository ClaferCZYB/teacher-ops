import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { QuickRecordDrawer } from './components/QuickRecordDrawer'
import { SearchPalette } from './components/SearchPalette'
import { ToastHub } from './components/Toast'

import { DashboardPage } from './pages/DashboardPage'
import { ClassesPage } from './pages/ClassesPage'
import { StudentsPage } from './pages/StudentsPage'
import { StudentDetailPage } from './pages/StudentDetailPage'
import { TasksPage } from './pages/TasksPage'
import { AttendancePage } from './pages/AttendancePage'
import { BehaviorPage } from './pages/BehaviorPage'
import { ClassAffairsPage } from './pages/ClassAffairsPage'
import { CommunicationsPage } from './pages/CommunicationsPage'
import { GradesPage } from './pages/GradesPage'
import { AssignmentsPage } from './pages/AssignmentsPage'
import { ReflectionsPage } from './pages/ReflectionsPage'
import { SchedulesPage } from './pages/SchedulesPage'
import { SeatingPage } from './pages/SeatingPage'
import { GroupsPage } from './pages/GroupsPage'
import { TrashPage } from './pages/TrashPage'
import { SettingsPage } from './pages/SettingsPage'
import { MorePage } from './pages/MorePage'

export default function App() {
  return (
    <>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/students/:id" element={<StudentDetailPage />} />
          <Route path="/seating" element={<SeatingPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/behavior" element={<BehaviorPage />} />
          <Route path="/class-affairs" element={<ClassAffairsPage />} />
          <Route path="/communications" element={<CommunicationsPage />} />
          <Route path="/grades" element={<GradesPage />} />
          <Route path="/assignments" element={<AssignmentsPage />} />
          <Route path="/reflections" element={<ReflectionsPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/trash" element={<TrashPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/more" element={<MorePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
      <QuickRecordDrawer />
      <SearchPalette />
      <ToastHub />
    </>
  )
}
