/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useTranslation } from 'react-i18next'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import {
  formatCacheHitRate,
  getCacheHitRateSummary,
  type CacheHitRateTone,
} from '../lib/format'
import type { LogOtherData } from '../types'

const TONE_CLASS: Record<CacheHitRateTone, string> = {
  none: 'bg-muted/40 text-muted-foreground',
  zero: 'bg-slate-200/80 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200',
  low: 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200',
  high: 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-200',
  excellent:
    'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/80 dark:text-emerald-100',
}

interface CacheHitRateCellProps {
  promptTokens: number
  other: LogOtherData | null
}

export function CacheHitRateCell({
  promptTokens,
  other,
}: CacheHitRateCellProps) {
  const { t } = useTranslation()
  const summary = getCacheHitRateSummary(promptTokens, other)
  const label = formatCacheHitRate(summary.percent)

  if (summary.tone === 'none') {
    return <span className='text-muted-foreground text-xs'>-</span>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={cn(
                'inline-flex h-6 min-w-12 items-center justify-center rounded-md px-2 font-mono text-xs font-semibold tabular-nums',
                TONE_CLASS[summary.tone]
              )}
            >
              {label}
            </span>
          }
        />
        <TooltipContent>
          {t('Cached {{cached}} / input {{prompt}}', {
            cached: summary.cacheReadTokens.toLocaleString(),
            prompt: summary.inputTokens.toLocaleString(),
          })}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
