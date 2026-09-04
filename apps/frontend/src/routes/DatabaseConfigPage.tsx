import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { DATABASE_ENGINES, FUNCTIONAL_DATABASE_ENGINES, type DatabaseEngine } from "@fad-console/shared-types";
import {
  useDatabaseConnectionConfig,
  useTestDatabaseConnection,
  useUpdateDatabaseConnectionConfig,
} from "../features/database-connection/useDatabaseConnection";
import { PageHeader, Skeleton } from "../components/ui/misc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Field, InlineSwitchField } from "../builder/editors/Field";
import { useToast } from "../components/ui/toast";

const ENGINE_LABELS: Record<DatabaseEngine, string> = {
  SQLITE: "SQLite",
  POSTGRESQL: "PostgreSQL",
  MONGODB: "MongoDB",
  GRAPH_NEO4J: "Grafos (Neo4j)",
};

function isFunctional(engine: DatabaseEngine): boolean {
  return FUNCTIONAL_DATABASE_ENGINES.includes(engine);
}

/**
 * Pestaña "Base de datos": documenta el motor OBJETIVO y sus datos de conexión, y permite
 * probar la conexión de verdad antes de aplicar el cambio. Guardar aquí NUNCA cambia en caliente
 * la base de datos que esta instancia usa — Prisma fija el motor al generar el cliente, así que
 * pasar de motor siempre requiere el proceso manual descrito abajo. SQLite y PostgreSQL son los
 * únicos con soporte funcional real hoy; MongoDB y Grafos (Neo4j) se pueden guardar como
 * preferencia, pero "Probar conexión" nunca finge un resultado para ellos.
 */
export function DatabaseConfigPage() {
  const { data: config, isLoading } = useDatabaseConnectionConfig();
  const updateConfig = useUpdateDatabaseConnectionConfig();
  const testConnection = useTestDatabaseConnection();
  const { notify } = useToast();

  const [engine, setEngine] = useState<DatabaseEngine>("SQLITE");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [databaseName, setDatabaseName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ssl, setSsl] = useState(true);
  const [connectionUri, setConnectionUri] = useState("");

  useEffect(() => {
    if (!config) return;
    setEngine(config.targetEngine);
    setHost(config.host ?? "");
    setPort(config.port === null ? "" : String(config.port));
    setDatabaseName(config.databaseName ?? "");
    setUsername(config.username ?? "");
    setPassword("");
    setSsl(config.ssl);
    setConnectionUri(config.connectionUri ?? "");
  }, [config]);

  function currentInput() {
    return {
      targetEngine: engine,
      host: host || undefined,
      port: port ? Number(port) : undefined,
      databaseName: databaseName || undefined,
      username: username || undefined,
      password: password || undefined,
      ssl,
      connectionUri: connectionUri || undefined,
    };
  }

  async function handleSave() {
    try {
      await updateConfig.mutateAsync(currentInput());
      notify({ title: "Configuración de base de datos guardada", tone: "success" });
    } catch (error) {
      notify({ title: "Error al guardar", description: (error as Error).message, tone: "error" });
    }
  }

  async function handleTest() {
    try {
      await testConnection.mutateAsync(currentInput());
    } catch (error) {
      notify({ title: "Error al probar la conexión", description: (error as Error).message, tone: "error" });
    }
  }

  const result = testConnection.data;
  const usesHostFields = engine === "POSTGRESQL" || engine === "MONGODB";
  const usesUriField = engine === "GRAPH_NEO4J";
  const functional = isFunctional(engine);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Base de datos"
        description="Motor de base de datos objetivo y datos de conexión — guardar aquí no cambia en caliente la base activa (ver instrucciones abajo)."
      />

      {isLoading || !config ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">Motor activo ahora mismo</p>
                <p className="text-sm font-medium">{ENGINE_LABELS[config.activeEngine]}</p>
              </div>
              <Badge tone="info">En uso</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Motor objetivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Motor de base de datos" htmlFor="db-engine">
                <Select id="db-engine" value={engine} onChange={(e) => setEngine(e.target.value as DatabaseEngine)}>
                  {DATABASE_ENGINES.map((e) => (
                    <option key={e} value={e}>
                      {ENGINE_LABELS[e]}
                      {isFunctional(e) ? "" : " (sin soporte funcional todavía)"}
                    </option>
                  ))}
                </Select>
              </Field>

              {!functional ? (
                <p className="rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                  {ENGINE_LABELS[engine]} no tiene una capa de acceso a datos implementada en esta consola todavía
                  (requiere un modelo de datos y un cliente distintos a Prisma+SQL, no un simple cambio de conexión).
                  Puedes guardar los datos de conexión como referencia, pero &ldquo;Probar conexión&rdquo; no intentará
                  conectarse de verdad.
                </p>
              ) : null}

              {engine === "SQLITE" ? (
                <p className="text-xs text-muted-foreground">
                  SQLite es un archivo local (<code>prisma/dev.db</code> en desarrollo) — no requiere host, puerto ni
                  credenciales.
                </p>
              ) : usesHostFields ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Host" htmlFor="db-host">
                    <Input id="db-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="db.ejemplo.com" />
                  </Field>
                  <Field label="Puerto" htmlFor="db-port">
                    <Input id="db-port" type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder={engine === "POSTGRESQL" ? "5432" : "27017"} />
                  </Field>
                  <Field label="Nombre de la base de datos" htmlFor="db-name">
                    <Input id="db-name" value={databaseName} onChange={(e) => setDatabaseName(e.target.value)} />
                  </Field>
                  <Field label="Usuario" htmlFor="db-username">
                    <Input id="db-username" value={username} onChange={(e) => setUsername(e.target.value)} />
                  </Field>
                  <Field label="Contraseña" htmlFor="db-password" hint={config.passwordConfigured ? "Ya hay una contraseña guardada — deja vacío para no cambiarla." : undefined}>
                    <Input id="db-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </Field>
                  <div className="flex items-end pb-2">
                    <InlineSwitchField label="Usar SSL" checked={ssl} onChange={setSsl} />
                  </div>
                </div>
              ) : usesUriField ? (
                <Field label="URI de conexión" htmlFor="db-uri" hint="Por ejemplo: bolt://host:7687">
                  <Input id="db-uri" value={connectionUri} onChange={(e) => setConnectionUri(e.target.value)} placeholder="bolt://host:7687" />
                </Field>
              ) : null}

              {engine !== "SQLITE" ? (
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" onClick={() => void handleTest()} disabled={testConnection.isPending}>
                    {testConnection.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    Probar conexión
                  </Button>
                  {result ? (
                    <div className={`flex items-center gap-1.5 text-xs ${result.ok ? "text-success" : "text-destructive"}`}>
                      {result.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      <span>
                        {result.message}
                        {result.durationMs !== null ? ` (${result.durationMs} ms)` : ""}
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {engine === "SQLITE" ? null : (
            <Card>
              <CardHeader>
                <CardTitle>Cómo aplicar un cambio de motor</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Guardar esta pantalla NO cambia la base de datos activa — Prisma fija el motor al generar el
                  cliente.{" "}
                  {engine === "POSTGRESQL"
                    ? "Para aplicar un cambio real a PostgreSQL:"
                    : "Para que este motor deje de ser solo referencia y la conexión se vuelva real:"}
                </p>
                {engine === "POSTGRESQL" ? (
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                    <li>
                      Actualiza <code>DATABASE_URL</code> en el entorno del servidor con la cadena de conexión real.
                    </li>
                    <li>
                      Genera el esquema de Postgres una vez: <code>npm run db:postgresql:build</code>.
                    </li>
                    <li>
                      Aplica las migraciones: <code>npx prisma migrate deploy --schema prisma/postgresql/schema.prisma</code>.
                    </li>
                    <li>Reinicia el servidor backend.</li>
                  </ol>
                ) : engine === "MONGODB" ? (
                  <>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                      <li>
                        Diseña el modelo de datos como colecciones/documentos equivalentes a las tablas actuales de{" "}
                        <code>prisma/schema.prisma</code> — Mongo no tiene filas ni relaciones de la misma forma, así
                        que no es un cambio de cadena de conexión, es un modelo de datos nuevo.
                      </li>
                      <li>
                        Implementa esa capa de acceso a datos: cada llamado a{" "}
                        <code>prisma.&lt;modelo&gt;.findX/create/update/delete</code> en{" "}
                        <code>apps/backend/src/modules/**</code> debe reemplazarse por su equivalente contra Mongo,
                        ya sea con el driver oficial <code>mongodb</code> (ya es dependencia del backend — ver{" "}
                        <code>client-database-connection.service.ts</code>, donde hoy solo se usa para probar
                        conexión) o adoptando el conector <code>mongodb</code> de Prisma (con limitaciones: IDs como{" "}
                        <code>ObjectId</code>, sin claves foráneas reales, sin <code>migrate dev</code> con SQL).
                      </li>
                      <li>
                        Una vez esa capa exista, los datos guardados arriba (host, puerto, usuario, contraseña, base)
                        pasan a ser la conexión real que use el backend, y &ldquo;Probar conexión&rdquo; empezará a
                        intentar una conexión genuina en vez de solo documentarla.
                      </li>
                      <li>
                        Actualiza <code>DATABASE_URL</code> (o la variable que defina esa nueva capa) en el entorno
                        del servidor y reinícialo.
                      </li>
                    </ol>
                    <p className="mt-2 text-xs text-muted-foreground">
                      En resumen: esto es un desarrollo a encargar a tu equipo técnico, no un cambio de
                      configuración — el ahorro es que, una vez construida esa capa, esta pantalla ya tiene el
                      formulario y la prueba de conexión listos para usarla.
                    </p>
                  </>
                ) : (
                  <>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                      <li>
                        Modela el dominio como nodos y relaciones (grafo) en vez de tablas — no existe un ORM tipo
                        Prisma para Neo4j en este proyecto, así que tampoco aquí es un simple cambio de conexión.
                      </li>
                      <li>
                        Implementa esa capa de acceso a datos reemplazando cada llamado a{" "}
                        <code>prisma.&lt;modelo&gt;.findX/create/update/delete</code> en{" "}
                        <code>apps/backend/src/modules/**</code> por consultas Cypher usando el driver oficial{" "}
                        <code>neo4j-driver</code> (ya es dependencia del backend — ver{" "}
                        <code>client-database-connection.service.ts</code>, donde hoy solo se usa para probar
                        conexión).
                      </li>
                      <li>
                        Una vez esa capa exista, la URI guardada arriba (<code>bolt://host:puerto</code>) pasa a ser
                        la conexión real que use el backend, y &ldquo;Probar conexión&rdquo; empezará a intentar una
                        conexión genuina en vez de solo documentarla.
                      </li>
                      <li>Actualiza la variable de entorno correspondiente en el servidor y reinícialo.</li>
                    </ol>
                    <p className="mt-2 text-xs text-muted-foreground">
                      En resumen: esto es un desarrollo a encargar a tu equipo técnico, no un cambio de
                      configuración — el ahorro es que, una vez construida esa capa, esta pantalla ya tiene el
                      formulario y la prueba de conexión listos para usarla.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={() => void handleSave()} disabled={updateConfig.isPending}>
              Guardar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
