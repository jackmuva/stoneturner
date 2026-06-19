import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { ThemeProvider } from "../providers/theme";
import { Layout } from "@/components/stoneturner/layout";
import { KnowledgeBasePage } from "@/components/stoneturner/knowledge-base/knowledge-base-page";
import { IntegrationDataPage } from "@/components/stoneturner/knowledge-base/integration-data-page";
import { SyncMonitoringPage } from "@/components/stoneturner/sync-monitoring/sync-monitoring-page";
import { TestingPage } from "@/components/stoneturner/integration-dev/testing-page";

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<KnowledgeBasePage />} />
            <Route path="knowledge" element={<KnowledgeBasePage />} />
            <Route path="knowledge/config/:integration" element={<KnowledgeBasePage />} />
            <Route path="knowledge/data/:integration" element={<IntegrationDataPage />} />
            <Route path="monitoring" element={<SyncMonitoringPage />} />
            <Route path="dev/knowledge" element={<KnowledgeBasePage />} />
            <Route path="dev/monitoring" element={<SyncMonitoringPage />} />
            <Route path="dev/testing" element={<TestingPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
