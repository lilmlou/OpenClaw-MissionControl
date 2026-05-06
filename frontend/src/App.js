import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import HomePage from "@/pages/HomePage";
import DashboardPage from "@/pages/DashboardPage";
import JobsPage from "@/pages/JobsPage";
import EventsPage from "@/pages/EventsPage";
import ApprovalsPage from "@/pages/ApprovalsPage";
import AgentsPage from "@/pages/AgentsPage";
import SpacesPage from "@/pages/SpacesPage";
import QudosPage from "@/pages/QudosPage";
import CodePage from "@/pages/CodePage";
import SessionsPage from "@/pages/SessionsPage";
import SettingsPage from "@/pages/SettingsPage";
import CustomizePage from "@/pages/CustomizePage";
import DesignPage from "@/pages/DesignPage";
import SystemPage from "@/pages/SystemPage";
import CronPage from "@/pages/CronPage";
import ActivitiesPage from "@/pages/ActivitiesPage";
import { Toaster } from "@/components/ui/toaster";
import { HealthToastBridge } from "@/components/HealthToastBridge";
import "./App.css";

function App() {
  return (
    <Layout>
      <Toaster />
      <HealthToastBridge />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/projects" element={<SpacesPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/system" element={<SystemPage />} />
        <Route path="/cron" element={<CronPage />} />
        <Route path="/activity" element={<ActivitiesPage />} />
        <Route path="/activities" element={<Navigate to="/activity" replace />} />
        <Route path="/qudos" element={<QudosPage />} />
        <Route path="/cowork" element={<Navigate to="/qudos" replace />} />
        <Route path="/code" element={<CodePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/customize" element={<CustomizePage />} />
        <Route path="/design" element={<DesignPage />} />
        <Route path="/spaces" element={<Navigate to="/projects" replace />} />
        <Route path="/agent" element={<Navigate to="/design" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
