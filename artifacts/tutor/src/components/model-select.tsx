import { Cpu } from "lucide-react";
import { useListModels, type ModelOption } from "@workspace/api-client-react";
import { AUTO_MODEL } from "@/lib/model-preference";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";

// The list of models the student can pick from, shared by the chat bar and
// the Settings page so the two can never drift apart.
//
// The server already orders the catalogue (tested models first, then by
// provider name A→Z), so the groups here are rendered in the order they
// arrive. "Auto" always leads: it is the only option that survives a model
// being retired upstream.

export interface ModelListState {
  models: ModelOption[];
  selected?: ModelOption;
  /** The order the server actually tries models in on Auto. */
  autoOrder: string[];
  locked: boolean;
  isLoading: boolean;
  /** A saved pick upstream no longer offers. */
  missing: boolean;
}

export function useModelList(model: string): ModelListState {
  const { data, isLoading } = useListModels();
  const models = data?.models ?? [];
  const selected = models.find((m) => m.id === model);
  return {
    models,
    selected,
    autoOrder: data?.autoOrder ?? [],
    locked: Boolean(data?.locked),
    isLoading,
    missing: model !== AUTO_MODEL && !selected && !isLoading,
  };
}

interface ModelSelectProps {
  value: string;
  onChange: (model: string) => void;
  models: ModelOption[];
  disabled?: boolean;
  isLoading?: boolean;
  /** Chat-bar styling: small, unobtrusive, shows just the model's name. */
  compact?: boolean;
  className?: string;
}

export function ModelSelect({
  value,
  onChange,
  models,
  disabled,
  isLoading,
  compact = false,
  className,
}: ModelSelectProps) {
  const recommended = models.filter((m) => m.recommended);
  const others = models.filter((m) => !m.recommended);
  const selected = models.find((m) => m.id === value);
  const label = value === AUTO_MODEL ? "Auto" : (selected?.name ?? value);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger
        aria-label="Choose AI model"
        className={cn(
          compact
            ? "h-8 w-auto max-w-[55vw] justify-start gap-1.5 rounded-lg border-0 bg-muted/70 px-2.5 text-xs font-medium text-muted-foreground shadow-none hover:bg-muted focus:ring-1 focus:ring-ring sm:max-w-[16rem]"
            : "w-full",
          className,
        )}
      >
        {compact && <Cpu className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />}
        <span className="truncate">{isLoading ? "Loading models…" : label}</span>
      </SelectTrigger>
      <SelectContent className={compact ? "max-h-80" : undefined}>
        <SelectItem value={AUTO_MODEL}>Auto (recommended)</SelectItem>
        {recommended.length > 0 && (
          <SelectGroup>
            <SelectLabel>Tested with this tutor</SelectLabel>
            {recommended.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
                {m.note && !compact ? ` — ${m.note}` : ""}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {others.length > 0 && (
          <SelectGroup>
            <SelectLabel>Other free models (untested)</SelectLabel>
            {others.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
