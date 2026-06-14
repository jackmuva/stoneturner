import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import { KnowledgeLayout } from "@/components/stoneturner/layout";
import { KnowledgeBasePage } from "@/components/stoneturner/knowledge-base/knowledge-base-page";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<KnowledgeLayout/>}>
          <Route path="/" element={<KnowledgeBasePage/>} />
          {/* <Route path="data/:integration" element={<IntegrationDataView />} /> */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
