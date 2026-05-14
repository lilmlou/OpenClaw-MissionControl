import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import HomePage from "@/pages/HomePage";
import DashboardPage from "@/pages/DashboardPage";
import JobsPage from "@/pages/JobsPage";
import EventsPage from "@/pages/EventsPage";
import ApprovalsPage from "@/pages/ApprovalsPage";
import AgentsPage from "@/pages/AgentsPage";
import AgentLiveViewPage from "@/pages/AgentLiveViewPage";
import BrainLogPage from "@/pages/BrainLogPage";
import BrainPageLegacy from "@/pages/BrainPage.legacy";
import InsightsPage from "@/pages/InsightsPage";
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
import CostsPage from "@/pages/CostsPage";
import StandupPage from "@/pages/StandupPage";
import AuditPage from "@/pages/AuditPage";
import SecurityPage from "@/pages/SecurityPage";
import FilesPage from "@/pages/FilesPage";
import SchemaFormDemoPage from "@/pages/SchemaFormDemoPage";
import ModelChromePreviewPage from "@/pages/ModelChromePreviewPage";
import InspectorPreviewPage from "@/pages/InspectorPreviewPage";
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
        <Route path="/agents/live" element={<AgentLiveViewPage />} />
        <Route path="/brain" element={<BrainLogPage />} />
        <Route path="/brain/:turnId" element={<BrainLogPage />} />
        <Route path="/brain/legacy" element={<BrainPageLegacy />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/system" element={<SystemPage />} />
        <Route path="/cron" element={<CronPage />} />
        <Route path="/activity" element={<ActivitiesPage />} />
        <Route path="/activities" element={<Navigate to="/activity" replace />} />
        <Route path="/costs" element={<CostsPage />} />
        <Route path="/standup" element={<StandupPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/files" element={<FilesPage />} />
        <Route path="/qudos" element={<QudosPage />} />
        <Route path="/cowork" element={<Navigate to="/qudos" replace />} />
        <Route path="/code" element={<CodePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/customize" element={<CustomizePage />} />
        <Route path="/design" element={<DesignPage />} />
        <Route path="/dev/schema-form-demo" element={<SchemaFormDemoPage />} />
        <Route path="/dev/model-chrome" element={<ModelChromePreviewPage />} />
        <Route path="/dev/inspector" element={<InspectorPreviewPage />} />
        <Route path="/spaces" element={<Navigate to="/projects" replace />} />
        <Route path="/agent" element={<Navigate to="/design" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
