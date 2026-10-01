// apps/web/src/routes/admin/settings.tsx
// 系统设置（Admin_Console · System Settings,R26/R2）：
// 通过 GET /api/admin/config 拉取 `{configs, settings, groups, tabs}`,
// 按 tab 切换、按 group 分卡渲染所有平台级开关与凭证项,本地编辑后批量提交。

import { Button } from "@openstarter/ui-web/components/button";
import { Card, CardContent, CardHeader } from "@openstarter/ui-web/components/card";
import { Input } from "@openstarter/ui-web/components/input";
import { Label } from "@openstarter/ui-web/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstarter/ui-web/components/select";
import { Textarea } from "@openstarter/ui-web/components/textarea";
import { cn } from "@openstarter/ui-web/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminHeader, StatusText } from "@/components/admin/list";
import { admin } from "@/modules/admin/lib/api";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/admin/settings")({
  loader: ({ context: { queryClient } }) => queryClient.prefetchQuery(admin.queries.config()),
  component: AdminSettingsPage,
});

interface SettingField {
  defaultValue?: string;
  group: string;
  name: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
  tab: string;
  tip?: string;
  title: string;
  type: "text" | "password" | "textarea" | "number" | "switch" | "select";
}

const MASK_PREFIX = "••••••••";

const isMasked = (value: string): boolean => value.startsWith(MASK_PREFIX);

function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, string>>({});

  const configQuery = useQuery({ ...admin.queries.config() });

  const { data } = configQuery;
  const configs = data?.configs ?? {};
  const settings = data?.settings ?? [];
  const groups = data?.groups ?? [];
  const tabs = data?.tabs ?? [];

  const saveMutation = useMutation({
    ...admin.mutations.saveConfig(),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: admin.queries.config().queryKey });
      toast.success(m["admin.settings.save_success"]());
    },
  });

  useEffect(() => {
    if (data && activeTab === null && tabs.length > 0) {
      setActiveTab(tabs.at(0)?.name ?? null);
      setPending({ ...configs });
    }
  }, [data, activeTab, tabs, configs]);

  if (configQuery.isPending || !data) {
    return (
      <div>
        <AdminHeader
          description={m["admin.settings.description"]()}
          title={m["admin.settings.title"]()}
        />
        <StatusText empty emptyLabel="" error={null} loading />
      </div>
    );
  }

  if (configQuery.error) {
    return (
      <div>
        <AdminHeader
          description={m["admin.settings.description"]()}
          title={m["admin.settings.title"]()}
        />
        <p className="text-destructive text-sm">{(configQuery.error as Error).message}</p>
      </div>
    );
  }

  const currentTabName = activeTab ?? tabs.at(0)?.name ?? "";
  const tabGroups = groups.filter((group) => group.tab === currentTabName);
  const tabFields = settings.filter((field) => field.tab === currentTabName);
  const fieldsByGroup = new Map<string, SettingField[]>();
  for (const field of tabFields) {
    const list = fieldsByGroup.get(field.group) ?? [];
    list.push(field);
    fieldsByGroup.set(field.group, list);
  }

  const dirtyCount = Object.entries(pending).filter(
    ([name, value]) => configs[name] !== value && !isMasked(value),
  ).length;
  const dirtyEntries = Object.entries(pending).filter(([name, value]) => configs[name] !== value);

  const onFieldChange = (name: string, value: string) => {
    setPending((prev) => ({ ...prev, [name]: value }));
  };

  const onSave = () => {
    const toSave: Record<string, string> = {};
    for (const [name, value] of dirtyEntries) {
      if (isMasked(value)) {
        continue;
      }
      toSave[name] = value;
    }
    if (Object.keys(toSave).length === 0) {
      toast.info(m["admin.settings.nothing_to_save"]());
      return;
    }
    saveMutation.mutate(toSave);
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        action={
          <Button
            disabled={saveMutation.isPending || dirtyCount === 0}
            onClick={onSave}
            size="sm"
            type="button"
          >
            {saveMutation.isPending
              ? m["admin.settings.saving"]()
              : m["admin.settings.save_changes"]()}
          </Button>
        }
        description={m["admin.settings.description"]()}
        title={m["admin.settings.title"]()}
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        <nav
          aria-label={m["admin.settings.title"]()}
          className="flex shrink-0 flex-row gap-1 overflow-x-auto lg:w-48 lg:flex-col lg:overflow-visible"
        >
          {tabs.map((tab) => {
            const tabDirtyCount = settings.filter(
              (field) =>
                field.tab === tab.name &&
                pending[field.name] !== configs[field.name] &&
                !isMasked(pending[field.name] ?? ""),
            ).length;
            const active = tab.name === currentTabName;
            return (
              <button
                className={cn(
                  "flex items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                type="button"
              >
                <span>{tab.title}</span>
                {tabDirtyCount > 0 ? (
                  <span className="rounded-full bg-primary px-1.5 text-primary-foreground text-xs">
                    {tabDirtyCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
          {tabGroups.map((group) => {
            const groupFields = fieldsByGroup.get(group.name) ?? [];
            if (groupFields.length === 0) {
              return null;
            }
            return (
              <Card key={group.name}>
                <CardHeader>
                  <h2 className="font-semibold">{group.title}</h2>
                  {group.description ? (
                    <p className="text-muted-foreground text-xs">{group.description}</p>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  {groupFields.map((field) => (
                    <FieldRow
                      field={field}
                      key={field.name}
                      onChange={onFieldChange}
                      value={pending[field.name] ?? ""}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
          {tabGroups.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {m["admin.settings.no_settings_for_section"]()}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: SettingField;
  value: string;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`setting-${field.name}`}>{field.title}</Label>
      {field.tip ? <p className="text-muted-foreground text-xs">{field.tip}</p> : null}
      {renderControl(field, value, onChange)}
    </div>
  );
}

function renderControl(
  field: SettingField,
  value: string,
  onChange: (name: string, value: string) => void,
) {
  const inputId = `setting-${field.name}`;
  const handleText = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange(field.name, e.target.value);

  switch (field.type) {
    case "switch":
      return (
        <SwitchField
          checked={value === "true"}
          id={inputId}
          onChange={(checked) => onChange(field.name, checked ? "true" : "false")}
        />
      );
    case "textarea":
      return (
        <Textarea
          id={inputId}
          onChange={handleText}
          placeholder={field.placeholder}
          value={value}
        />
      );
    case "select":
      return (
        <FieldSelect
          field={field}
          id={inputId}
          onChange={(newValue) => onChange(field.name, newValue)}
          value={value}
        />
      );
    case "number":
      return (
        <Input
          id={inputId}
          inputMode="numeric"
          onChange={handleText}
          placeholder={field.placeholder}
          type="text"
          value={value}
        />
      );
    case "password":
      return (
        <Input
          autoComplete="off"
          id={inputId}
          onChange={handleText}
          placeholder={field.placeholder}
          type="password"
          value={value}
        />
      );
    default:
      return (
        <Input
          id={inputId}
          onChange={handleText}
          placeholder={field.placeholder}
          type="text"
          value={value}
        />
      );
  }
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

function FieldSelect({
  field,
  value,
  onChange,
  id,
}: {
  field: SettingField;
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  const options = field.options ?? [];
  const handleValue = (nextVal: unknown) => {
    if (typeof nextVal === "string") {
      onChange(nextVal);
    }
  };
  return (
    <Select onValueChange={handleValue} value={value}>
      <SelectTrigger className="w-full" id={id}>
        <SelectValue placeholder={field.placeholder ?? m["common.select_placeholder"]()} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
