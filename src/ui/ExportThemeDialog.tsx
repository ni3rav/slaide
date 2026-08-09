import { useEffect, useId, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { DeckTheme } from '../storage/deck-repository.ts'

type ExportFormat = 'slaide' | 'pdf'

type ExportThemeDialogProps = {
  format: ExportFormat | null
  defaultTheme: DeckTheme
  onCancel: () => void
  onConfirm: (theme: DeckTheme) => void
}

const FORMAT_LABEL: Record<ExportFormat, string> = {
  slaide: '.slaide file',
  pdf: 'PDF',
}

export function ExportThemeDialog({
  format,
  defaultTheme,
  onCancel,
  onConfirm,
}: ExportThemeDialogProps) {
  const open = format !== null
  const lightId = useId()
  const darkId = useId()
  const [selected, setSelected] = useState<DeckTheme>(defaultTheme)

  useEffect(() => {
    if (open) setSelected(defaultTheme)
  }, [open, defaultTheme])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
    >
      <DialogContent data-testid="export-theme-dialog">
        <DialogHeader>
          <DialogTitle>
            Export as {format ? FORMAT_LABEL[format] : ''}
          </DialogTitle>
          <DialogDescription>
            Choose the theme applied to the exported file.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={selected}
          onValueChange={(value) => setSelected(value as DeckTheme)}
          aria-label="Export theme"
        >
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <RadioGroupItem id={lightId} value="light" />
            <Label htmlFor={lightId} className="flex items-center gap-2 font-normal">
              <Sun className="size-4" aria-hidden="true" />
              Light Mode
            </Label>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <RadioGroupItem id={darkId} value="dark" />
            <Label htmlFor={darkId} className="flex items-center gap-2 font-normal">
              <Moon className="size-4" aria-hidden="true" />
              Dark Mode
            </Label>
          </div>
        </RadioGroup>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={() => onConfirm(selected)}>
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
