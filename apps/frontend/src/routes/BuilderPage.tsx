import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Download, Upload, Save, RotateCcw } from "lucide-react";
import { ValidationRequestConfigSchema } from "@fad-console/validation-schemas";
import { useBuilderState } from "../builder/useBuilderState";
import { emptyBuilderConfig } from "../builder/defaults";
import { StepCatalogPanel } from "../builder/StepCatalogPanel";
import { StepCanvas } from "../builder/StepCanvas";
import { StepPropertiesTab } from "../builder/StepPropertiesTab";
import { GeneralTab } from "../builder/GeneralTab";
import { ThemeTab } from "../builder/ThemeTab";
import { JsonPreviewTab } from "../builder/JsonPreviewTab";
import { useTemplate, useCreateTemplate, useUpdateTemplate } from "../features/templates/useTemplates";
import { useEnvironments } from "../features/environments/useEnvironments";
import { PageHeader } from "../components/ui/misc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../components/ui/dialog";
import { useToast } from "../components/ui/toast";

export function BuilderPage() {
  const { templateId } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { data: existingTemplate } = useTemplate(templateId);
  const { data: environments = [] } = useEnvironments();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const builder = useBuilderState();
  const [selectedStepKey, setSelectedStepKey] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [templateEnvironmentId, setTemplateEnvironmentId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existingTemplate) {
      builder.loadConfig(existingTemplate.requestConfig);
      setTemplateName(existingTemplate.name);
      setTemplateDescription(existingTemplate.description ?? "");
      setTemplateEnvironmentId(existingTemplate.environmentId ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingTemplate]);

  function handleExport() {
    const blob = new Blob([JSON.stringify(builder.config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${builder.config.processName || "plantilla"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const parsed = ValidationRequestConfigSchema.parse(JSON.parse(text));
      builder.loadConfig(parsed);
      notify({ title: "JSON importado", description: "La configuración se cargó correctamente.", tone: "success" });
    } catch (error) {
      notify({
        title: "No se pudo importar",
        description: error instanceof Error ? error.message : "Archivo inválido",
        tone: "error",
      });
    }
  }

  async function handleSaveTemplate() {
    const input = {
      name: templateName,
      description: templateDescription || undefined,
      environmentId: templateEnvironmentId || null,
      requestConfig: builder.config,
      active: true,
    };
    try {
      if (existingTemplate) {
        await updateTemplate.mutateAsync({ id: existingTemplate.id, input });
        notify({ title: "Plantilla actualizada", tone: "success" });
      } else {
        const res = await createTemplate.mutateAsync(input);
        notify({ title: "Plantilla creada", tone: "success" });
        navigate(`/builder/${res.template.id}`, { replace: true });
      }
      setSaveDialogOpen(false);
    } catch (error) {
      notify({ title: "Error al guardar", description: (error as Error).message, tone: "error" });
    }
  }

  const selectedStep = selectedStepKey ? builder.config.steps[selectedStepKey] : undefined;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <PageHeader
        title="Constructor de validación"
        description={existingTemplate ? `Editando: ${existingTemplate.name}` : "Nueva plantilla sin guardar"}
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={handleImportClick}>
              <Upload className="h-4 w-4" /> Importar JSON
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" /> Exportar JSON
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                builder.loadConfig(emptyBuilderConfig());
                setSelectedStepKey(null);
              }}
            >
              <RotateCcw className="h-4 w-4" /> Restaurar
            </Button>
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Save className="h-4 w-4" /> Guardar como plantilla
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{existingTemplate ? "Actualizar plantilla" : "Guardar como plantilla"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-name">Nombre</Label>
                    <Input id="tpl-name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-desc">Descripción</Label>
                    <Input id="tpl-desc" value={templateDescription} onChange={(e) => setTemplateDescription(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tpl-env">Ambiente (opcional)</Label>
                    <Select id="tpl-env" value={templateEnvironmentId} onChange={(e) => setTemplateEnvironmentId(e.target.value)}>
                      <option value="">Sin ambiente asociado</option>
                      {environments.map((env) => (
                        <option key={env.id} value={env.id}>
                          {env.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleSaveTemplate}
                    disabled={!templateName || createTemplate.isPending || updateTemplate.isPending}
                  >
                    Guardar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr_360px] gap-4">
        <div className="min-h-0 overflow-y-auto rounded-lg border border-border bg-card p-3">
          <StepCatalogPanel addedStepKeys={Object.keys(builder.config.steps)} onAdd={builder.addStep} />
        </div>

        <div className="min-h-0 overflow-y-auto rounded-lg border border-border bg-card p-4">
          <StepCanvas
            orderedStepKeys={builder.orderedStepKeys}
            steps={builder.config.steps}
            selectedStepKey={selectedStepKey}
            onSelect={setSelectedStepKey}
            onToggleShow={builder.toggleShow}
            onRemove={(key) => {
              builder.removeStep(key);
              if (selectedStepKey === key) setSelectedStepKey(null);
            }}
            onReorder={builder.reorderSteps}
          />
        </div>

        <div className="min-h-0 overflow-y-auto rounded-lg border border-border bg-card p-4">
          <Tabs defaultValue="step">
            <TabsList>
              <TabsTrigger value="step">Paso</TabsTrigger>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="theme">Tema</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="step">
              <StepPropertiesTab
                stepKey={selectedStepKey}
                step={selectedStep}
                onChange={(patch) => selectedStepKey && builder.updateStep(selectedStepKey, patch)}
                onReset={() => selectedStepKey && builder.resetStep(selectedStepKey)}
              />
            </TabsContent>
            <TabsContent value="general">
              <GeneralTab
                config={builder.config}
                setMeta={builder.setMeta}
                setClient={builder.setClient}
                setRedirectUrl={builder.setRedirectUrl}
                setNotifications={builder.setNotifications}
              />
            </TabsContent>
            <TabsContent value="theme">
              <ThemeTab
                theme={builder.config.customization.theme}
                header={builder.config.customization.header}
                setTheme={builder.setTheme}
                setHeader={builder.setHeader}
                resetTheme={builder.resetTheme}
              />
            </TabsContent>
            <TabsContent value="json">
              <JsonPreviewTab config={builder.config} onApply={builder.loadConfig} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
