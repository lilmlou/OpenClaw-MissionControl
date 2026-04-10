import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import HomePage from "@/pages/HomePage";
import DashboardPage from "@/pages/DashboardPage";
import JobsPage from "@/pages/JobsPage";
import ApprovalsPage from "@/pages/ApprovalsPage";
import SpacesPage from "@/pages/SpacesPage";
import CoworkPage from "@/pages/CoworkPage";
import CodePage from "@/pages/CodePage";
import SettingsPage from "@/pages/SettingsPage";
import CustomizePage from "@/pages/CustomizePage";
import AgentPage from "@/pages/AgentPage";
import "./App.css";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/spaces" element={<SpacesPage />} />
        <Route path="/cowork" element={<CoworkPage />} />
        <Route path="/code" element={<CodePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/customize" element={<CustomizePage />} />
        <Route path="/agent" element={<AgentPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
