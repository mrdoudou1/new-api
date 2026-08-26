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
import { describe, expect, test } from 'vitest'

import { formatCacheHitRate, getCacheHitRateSummary } from '../format'

describe('cache hit rate', () => {
  test('returns none when prompt tokens are missing', () => {
    expect(getCacheHitRateSummary(0, { cache_tokens: 100 })).toMatchObject({
      percent: null,
      tone: 'none',
    })
    expect(formatCacheHitRate(null)).toBe('-')
  })

  test('treats missing cache tokens as a zero hit rate', () => {
    expect(getCacheHitRateSummary(1000, null)).toMatchObject({
      percent: 0,
      tone: 'zero',
    })
    expect(formatCacheHitRate(0)).toBe('0%')
  })

  test('uses cache read tokens over prompt tokens', () => {
    expect(getCacheHitRateSummary(1000, { cache_tokens: 250 })).toMatchObject({
      percent: 25,
      tone: 'low',
    })
    expect(getCacheHitRateSummary(1000, { cache_tokens: 400 })).toMatchObject({
      percent: 40,
      tone: 'low',
    })
    expect(getCacheHitRateSummary(1000, { cache_tokens: 700 })).toMatchObject({
      percent: 70,
      tone: 'medium',
    })
    expect(getCacheHitRateSummary(1000, { cache_tokens: 900 })).toMatchObject({
      percent: 90,
      tone: 'high',
    })
  })

  test('includes separate Claude cache tokens in the input total', () => {
    expect(
      getCacheHitRateSummary(100, {
        claude: true,
        cache_tokens: 900,
      })
    ).toMatchObject({
      cacheReadTokens: 900,
      inputTokens: 1000,
      percent: 90,
      tone: 'high',
    })
    expect(
      getCacheHitRateSummary(95, {
        claude: true,
        cache_tokens: 1805,
      })
    ).toMatchObject({
      percent: 95,
      tone: 'excellent',
    })
  })

  test('includes Claude cache writes without double-counting split windows', () => {
    expect(
      getCacheHitRateSummary(100, {
        usage_semantic: 'anthropic',
        cache_tokens: 400,
        cache_creation_tokens: 900,
        cache_creation_tokens_5m: 200,
        cache_creation_tokens_1h: 300,
      })
    ).toMatchObject({
      cacheWriteTokens: 500,
      inputTokens: 1000,
      percent: 40,
      tone: 'low',
    })
  })

  test('clamps overflow cache tokens at 100%', () => {
    expect(getCacheHitRateSummary(100, { cache_tokens: 150 })).toMatchObject({
      percent: 100,
      tone: 'excellent',
    })
    expect(formatCacheHitRate(100)).toBe('100%')
  })
})
