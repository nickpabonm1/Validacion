import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DatabaseConnectionConfigDto, DatabaseConnectionTestResult } from "@fad-console/shared-types";
import type { DatabaseConnectionConfigInput } from "@fad-console/validation-schemas";
import { api } from "../../lib/api-client";

const QUERY_KEY = ["database-connection"];

export function useDatabaseConnectionConfig() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      api
        .get<{ databaseConnectionConfig: DatabaseConnectionConfigDto }>("/database-connection")
        .then((r) => r.databaseConnectionConfig),
  });
}

export function useUpdateDatabaseConnectionConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DatabaseConnectionConfigInput) =>
      api
        .put<{ databaseConnectionConfig: DatabaseConnectionConfigDto }>("/database-connection", input)
        .then((r) => r.databaseConnectionConfig),
    onSuccess: (config) => queryClient.setQueryData(QUERY_KEY, config),
  });
}

export function useTestDatabaseConnection() {
  return useMutation({
    mutationFn: (input: DatabaseConnectionConfigInput) =>
      api.post<{ result: DatabaseConnectionTestResult }>("/database-connection/test", input).then((r) => r.result),
  });
}
