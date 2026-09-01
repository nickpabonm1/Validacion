import { Routes, Route } from "react-router-dom";
import { LoginPage } from "./routes/LoginPage";
import { SetupWizardPage } from "./routes/SetupWizardPage";
import { RequireAuth } from "./components/layout/RequireAuth";
import { RequireRole } from "./components/layout/RequireRole";
import { DashboardPage } from "./routes/DashboardPage";
import { BuilderPage } from "./routes/BuilderPage";
import { TemplatesPage } from "./routes/TemplatesPage";
import { NewExecutionPage } from "./routes/NewExecutionPage";
import { ExecutionsPage } from "./routes/ExecutionsPage";
import { ExecutionDetailPage } from "./routes/ExecutionDetailPage";
import { ResponseDesignerPage } from "./routes/ResponseDesignerPage";
import { WebhooksPage } from "./routes/WebhooksPage";
import { EnvironmentsPage } from "./routes/EnvironmentsPage";
import { CatalogsPage } from "./routes/CatalogsPage";
import { UsersPage } from "./routes/UsersPage";
import { AuditPage } from "./routes/AuditPage";
import { SettingsPage } from "./routes/SettingsPage";
import { NotFoundPage } from "./routes/NotFoundPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupWizardPage />} />

      <Route element={<RequireAuth />}>
        <Route index element={<DashboardPage />} />
        <Route path="builder" element={<BuilderPage />} />
        <Route path="builder/:templateId" element={<BuilderPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="executions/new" element={<NewExecutionPage />} />
        <Route path="executions" element={<ExecutionsPage />} />
        <Route path="executions/:executionId" element={<ExecutionDetailPage />} />
        <Route
          path="response-designer"
          element={
            <RequireRole roles={["ADMIN"]}>
              <ResponseDesignerPage />
            </RequireRole>
          }
        />
        <Route path="webhooks" element={<WebhooksPage />} />
        <Route
          path="environments"
          element={
            <RequireRole roles={["ADMIN"]}>
              <EnvironmentsPage />
            </RequireRole>
          }
        />
        <Route
          path="catalogs"
          element={
            <RequireRole roles={["ADMIN"]}>
              <CatalogsPage />
            </RequireRole>
          }
        />
        <Route
          path="users"
          element={
            <RequireRole roles={["ADMIN"]}>
              <UsersPage />
            </RequireRole>
          }
        />
        <Route
          path="audit"
          element={
            <RequireRole roles={["ADMIN", "AUDITOR"]}>
              <AuditPage />
            </RequireRole>
          }
        />
        <Route
          path="settings"
          element={
            <RequireRole roles={["ADMIN"]}>
              <SettingsPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
