// apps/web/src/routes/admin/ai-models.tsx
// AI 模型目录管理（Task 10）：列表 + Dialog 表单（create/update）+ 删除。

import { Badge } from "@openstarter/ui-web/components/badge";
import { Button } from "@openstarter/ui-web/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openstarter/ui-web/components/dialog";
import { Input } from "@openstarter/ui-web/components/input";
import { Label } from "@openstarter/ui-web/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstarter/ui-web/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstarter/ui-web/components/table";
import { Textarea } from "@openstarter/ui-web/components/textarea";
import { cn } from "@openstarter/ui-web/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AdminHeader, Pagination, StatusText } from "@/components/admin/list";
import { countTotalPages, listSearchParams, LIST_PAGE_SIZE } from "@/lib/list-search";
import { preloadQueries } from "@/lib/preload";
import {
  admin,
  type AiModelMediaType,
  type AiModelRow,
  aiModelsKeys,
  AI_MODEL_MEDIA_TYPES,
} from "@/modules/admin/lib/api";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/admin/ai-models")({
  validateSearch: listSearchParams,
  loaderDeps: ({ search }) => search,
  loader: preloadQueries((deps) => [admin.queries.aiModels(Number(deps.page) || 1)]),
  component: AdminAiModelsPage,
});

type MediaType = AiModelMediaType;

const MEDIA_TYPES = AI_MODEL_MEDIA_TYPES;

interface ModelForm {
  id: string | null;
  provider: string;
  modelId: string;
  displayName: string;
  mediaType: MediaType;
  creditPrice: string;
  maxOutputTokens: string;
  optionsSchema: string;
  metadata: string;
  enabled: boolean;
  sortOrder: string;
}

const EMPTY_FORM: ModelForm = {
  id: null,
  provider: "",
  modelId: "",
  displayName: "",
  mediaType: "image",
  creditPrice: "0",
  maxOutputTokens: "",
  optionsSchema: "",
  metadata: "",
  enabled: true,
  sortOrder: "0",
};

const parseIntOrNull = (value: string): number | null | undefined => {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

function AdminAiModelsPage() {
  const queryClient = useQueryClient();
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [form, setForm] = useState<ModelForm | null>(null);

  const modelsQuery = useQuery(admin.queries.aiModels(page));

  const handlePageChange = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }), replace: true });
  };

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: aiModelsKeys.all });
  };

  const saveMutation = useMutation({
    ...admin.mutations.saveAiModel(),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      setForm(null);
      invalidate();
      toast.success(m["admin.ai_models.saved"]());
    },
  });

  const deleteMutation = useMutation({
    ...admin.mutations.deleteAiModel(),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      invalidate();
      toast.success(m["admin.ai_models.deleted"]());
    },
  });

  const toggleMutation = useMutation({
    ...admin.mutations.toggleAiModel(),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      invalidate();
      toast.success(m["admin.ai_models.updated"]());
    },
  });

  const items: AiModelRow[] = modelsQuery.data?.items ?? [];
  const total = modelsQuery.data?.total ?? 0;
  const totalPages = countTotalPages(total, LIST_PAGE_SIZE);

  const handleSave = () => {
    if (!form) {
      return;
    }
    const creditPrice = Number.parseInt(form.creditPrice, 10);
    const maxOutputTokens = parseIntOrNull(form.maxOutputTokens);
    if (!Number.isFinite(creditPrice) || creditPrice < 0 || maxOutputTokens === undefined) {
      toast.error(m["admin.ai_models.validation_error"]());
      return;
    }
    saveMutation.mutate({
      id: form.id,
      provider: form.provider.trim(),
      modelId: form.modelId.trim(),
      displayName: form.displayName.trim(),
      mediaType: form.mediaType,
      creditPrice,
      maxOutputTokens,
      optionsSchema: form.optionsSchema.trim() === "" ? null : form.optionsSchema.trim(),
      metadata: form.metadata.trim() === "" ? null : form.metadata.trim(),
      enabled: form.enabled,
      sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
    });
  };

  return (
    <div>
      <AdminHeader
        action={
          <Button onClick={() => setForm(EMPTY_FORM)} size="sm" type="button">
            {m["admin.ai_models.new_model"]()}
          </Button>
        }
        description={m["admin.ai_models.description"]()}
        title={m["admin.ai_models.title"]()}
      />

      <StatusText
        empty={items.length === 0}
        emptyLabel={m["admin.ai_models.no_models"]()}
        error={modelsQuery.error as Error | null}
        loading={modelsQuery.isPending}
      />

      {items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m["admin.ai_models.provider_col"]()}</TableHead>
                <TableHead>{m["admin.ai_models.model_col"]()}</TableHead>
                <TableHead>{m["admin.ai_models.display_name_col"]()}</TableHead>
                <TableHead>{m["admin.ai_models.media_type_col"]()}</TableHead>
                <TableHead className="text-right">{m["admin.ai_models.price_col"]()}</TableHead>
                <TableHead>{m["admin.ai_models.enabled_col"]()}</TableHead>
                <TableHead className="text-right">{m["admin.ai_models.actions_col"]()}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((model) => (
                <TableRow key={model.id}>
                  <TableCell className="font-mono text-sm">{model.provider}</TableCell>
                  <TableCell className="font-mono text-sm">{model.modelId}</TableCell>
                  <TableCell>{model.displayName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{model.mediaType}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{model.creditPrice}</TableCell>
                  <TableCell>
                    <SwitchField
                      checked={model.enabled}
                      id={`ai-model-enabled-${model.id}`}
                      onChange={(checked) =>
                        toggleMutation.mutate({ id: model.id, enabled: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button
                      onClick={() =>
                        setForm({
                          id: model.id,
                          provider: model.provider,
                          modelId: model.modelId,
                          displayName: model.displayName,
                          mediaType: (MEDIA_TYPES as readonly string[]).includes(model.mediaType)
                            ? (model.mediaType as MediaType)
                            : "image",
                          creditPrice: String(model.creditPrice),
                          maxOutputTokens:
                            model.maxOutputTokens === null ? "" : String(model.maxOutputTokens),
                          optionsSchema: model.optionsSchema ?? "",
                          metadata: model.metadata ?? "",
                          enabled: model.enabled,
                          sortOrder: String(model.sortOrder),
                        })
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {m["admin.ai_models.edit"]()}
                    </Button>
                    <Button
                      onClick={() => deleteMutation.mutate(model.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {m["admin.ai_models.delete"]()}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Pagination onPageChange={handlePageChange} page={page} totalPages={totalPages} />

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setForm(null);
          }
        }}
        open={form !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form?.id ? m["admin.ai_models.edit_title"]() : m["admin.ai_models.create_title"]()}
            </DialogTitle>
            <DialogDescription>{m["admin.ai_models.dialog_description"]()}</DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-model-provider">{m["admin.ai_models.provider_field"]()}</Label>
                  <Input
                    id="ai-model-provider"
                    onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    placeholder="replicate"
                    value={form.provider}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-model-model-id">{m["admin.ai_models.model_id_field"]()}</Label>
                  <Input
                    id="ai-model-model-id"
                    onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                    placeholder="black-forest-labs/flux-dev"
                    value={form.modelId}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-model-display-name">
                  {m["admin.ai_models.display_name_field"]()}
                </Label>
                <Input
                  id="ai-model-display-name"
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                  placeholder="Flux Dev"
                  value={form.displayName}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-model-media-type">
                    {m["admin.ai_models.media_type_field"]()}
                  </Label>
                  <Select
                    onValueChange={(value) => setForm({ ...form, mediaType: value as MediaType })}
                    value={form.mediaType}
                  >
                    <SelectTrigger className="w-full" id="ai-model-media-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEDIA_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-model-price">
                    {m["admin.ai_models.credit_price_field"]()}
                  </Label>
                  <Input
                    id="ai-model-price"
                    inputMode="numeric"
                    onChange={(e) => setForm({ ...form, creditPrice: e.target.value })}
                    value={form.creditPrice}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-model-max-tokens">
                    {m["admin.ai_models.max_output_tokens_field"]()}
                  </Label>
                  <Input
                    id="ai-model-max-tokens"
                    inputMode="numeric"
                    onChange={(e) => setForm({ ...form, maxOutputTokens: e.target.value })}
                    placeholder={m["admin.ai_models.max_tokens_placeholder"]()}
                    value={form.maxOutputTokens}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-model-sort-order">
                    {m["admin.ai_models.sort_order_field"]()}
                  </Label>
                  <Input
                    id="ai-model-sort-order"
                    inputMode="numeric"
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                    value={form.sortOrder}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-model-options-schema">
                  {m["admin.ai_models.options_schema_field"]()}
                </Label>
                <Textarea
                  id="ai-model-options-schema"
                  onChange={(e) => setForm({ ...form, optionsSchema: e.target.value })}
                  placeholder='{"properties":{"aspect_ratio":{"type":"string","enum":["1:1","16:9"]}}}'
                  rows={4}
                  value={form.optionsSchema}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-model-metadata">{m["admin.ai_models.metadata_field"]()}</Label>
                <Textarea
                  id="ai-model-metadata"
                  onChange={(e) => setForm({ ...form, metadata: e.target.value })}
                  placeholder='{"note":"internal remarks"}'
                  rows={2}
                  value={form.metadata}
                />
              </div>
              <div className="flex items-center gap-2">
                <SwitchField
                  checked={form.enabled}
                  id="ai-model-form-enabled"
                  onChange={(checked) => setForm({ ...form, enabled: checked })}
                />
                <Label htmlFor="ai-model-form-enabled">
                  {m["admin.ai_models.enabled_field"]()}
                </Label>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              disabled={
                !form ||
                form.provider.trim().length === 0 ||
                form.modelId.trim().length === 0 ||
                form.displayName.trim().length === 0 ||
                saveMutation.isPending
              }
              onClick={handleSave}
              type="button"
            >
              {saveMutation.isPending ? m["admin.ai_models.saving"]() : m["admin.ai_models.save"]()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SwitchField({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={id}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors",
        checked ? "bg-primary" : "bg-input",
      )}
      id={id}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background shadow ring-1 ring-foreground/5 transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
