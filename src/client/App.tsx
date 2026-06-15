import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { KnowledgeLayout } from "@/components/stoneturner/knowledge-base/knowledge-layout";
import { KnowledgeBasePage } from "@/components/stoneturner/knowledge-base/knowledge-base-page";
import { IntegrationDataPage } from "@/components/stoneturner/knowledge-base/integration-data-page";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<KnowledgeLayout/>}>
          <Route path="/" element={<KnowledgeBasePage/>} />
          <Route path="data/:integration" element={<IntegrationDataPage/>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
