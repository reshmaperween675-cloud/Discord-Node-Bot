/**
 * Hand-written hooks for endpoints added after the initial OpenAPI codegen.
 * These live here so we don't modify the generated file.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";
import type { EmbedEntry, EmbedData } from "./generated/api.schemas";
import { getListEmbedsQueryKey } from "./generated/api";

// ── Create embed ──────────────────────────────────────────────────────────────

export type CreateEmbedInput = {
  id: string;
  module: string;
} & Partial<EmbedData>;

export const createEmbed = async (data: CreateEmbedInput): Promise<EmbedEntry> => {
  return customFetch<EmbedEntry>(`/api/dashboard/embeds`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
};

export const useCreateEmbed = () => {
  const qc = useQueryClient();
  return useMutation<EmbedEntry, Error, CreateEmbedInput>({
    mutationFn: (data) => createEmbed(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListEmbedsQueryKey() });
    },
  });
};

// ── Custom modules ────────────────────────────────────────────────────────────

export const createCustomModule = async (name: string): Promise<{ ok: boolean }> => {
  return customFetch<{ ok: boolean }>(`/api/dashboard/embeds/custom-modules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
};

export const useCreateCustomModule = () => {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (name) => createCustomModule(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListEmbedsQueryKey() });
    },
  });
};
