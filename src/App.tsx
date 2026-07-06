import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { Toaster } from "sonner";

import { Login } from "./pages/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import UpdatePassword from "./pages/auth/UpdatePassword";
import { Patients } from "./pages/Patients";
import { ImplantCases } from "./pages/ImplantCases";
import DashboardLayout from "./layouts/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Appointments from "./pages/dashboard/Appointments";
import Payments from "./pages/dashboard/Payments";
import PatientProfile from "./pages/dashboard/PatientProfile";
import FollowUps from "./pages/dashboard/FollowUps";
import Inventory from "./pages/Inventory";
import Reports from "./pages/dashboard/Reports";
import Settings from "./pages/dashboard/Settings";
import AuditLogs from "./pages/dashboard/AuditLogs";
import Notifications from "./pages/dashboard/Notifications";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <LanguageProvider>
      <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="patients" element={<Patients />} />
            <Route path="patients/:id/profile" element={<PatientProfile />} />
            <Route path="cases" element={<ImplantCases />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="follow-ups" element={<FollowUps />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="logs" element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <AuditLogs />
              </ProtectedRoute>
            } />
            <Route path="payments" element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager', 'Doctor', 'Receptionist']}>
                <Payments />
              </ProtectedRoute>
            } />
            <Route path="reports" element={
              <ProtectedRoute allowedRoles={['Admin', 'Doctor']}>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={
              <ProtectedRoute allowedRoles={['Admin']}>
                <Settings />
              </ProtectedRoute>
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </AuthProvider>
      </LanguageProvider>
      </ThemeProvider>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}