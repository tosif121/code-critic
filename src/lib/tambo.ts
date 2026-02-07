/**
 * @file tambo.ts
 * @description Central configuration file for Tambo components and tools
 *
 * This file serves as the central place to register your Tambo components.
 * It exports arrays that will be used by the TamboProvider.
 */

import { z } from 'zod';
import type { TamboComponent } from '@tambo-ai/react';
import { TamboTool } from '@tambo-ai/react';

// Import Code Critic Components
import CodeComparison from '@/components/roast/CodeComparison';
import FixSuggestion from '@/components/roast/FixSuggestion';
import { SecurityBomb } from '@/components/roast/SecurityBomb';
import { SpaghettiMeter } from '@/components/roast/SpaghettiMeter';
import { PerformanceTurtle } from '@/components/roast/PerformanceTurtle';
import { GenericRoast } from '@/components/roast/GenericRoast';

/**
 * tools
 *
 * This array contains all the Tambo tools that are registered for use within the application.
 * Currently empty, but can be used for things like "get_roast_data" in the future.
 */
export const tools: TamboTool[] = [];

/**
 * components
 *
 * This array contains all the Tambo components that are registered for use within the application.
 * The AI will choose which component to render based on the conversation context.
 */
export const components: TamboComponent[] = [
  {
    name: 'CodeComparison',
    description: 'Displays a side-by-side comparison of bad code vs fixed code.',
    component: CodeComparison,
    propsSchema: z.object({
      before: z.string().describe('The original code snippet with issues.'),
      after: z.string().describe('The fixed code snippet.'),
      explanation: z.string().describe('A brief explanation of what was fixed.'),
    }),
  },
  {
    name: 'FixSuggestion',
    description: 'Displays a step-by-step guide to fix a specific issue.',
    component: FixSuggestion,
    propsSchema: z.object({
      title: z.string().describe('The title of the fix (e.g. "Refactor Auth Logic").'),
      steps: z.array(z.string()).describe('A list of actionable steps to apply the fix.'),
    }),
  },
  {
    name: 'SecurityBomb',
    description: 'Highlights a critical security vulnerability with a bomb animation.',
    component: SecurityBomb,
    propsSchema: z.object({
      title: z.string(),
      roast: z.string(),
      explanation: z.string(),
      severity: z.string(),
      config: z
        .object({
          explosionSize: z.enum(['big', 'small']).optional(),
        })
        .optional(),
    }),
  },
  {
    name: 'SpaghettiMeter',
    description: 'Visualizes code complexity with a spaghetti meter.',
    component: SpaghettiMeter,
    propsSchema: z.object({
      title: z.string(),
      roast: z.string(),
      explanation: z.string(),
      config: z
        .object({
          complexity: z.number().min(0).max(100).optional(),
        })
        .optional(),
    }),
  },
  {
    name: 'PerformanceTurtle',
    description: 'Mocks slow performance with a racing turtle.',
    component: PerformanceTurtle,
    propsSchema: z.object({
      title: z.string(),
      roast: z.string(),
      explanation: z.string(),
      config: z
        .object({
          speed: z.enum(['slow', 'crawl']).optional(),
        })
        .optional(),
    }),
  },
  {
    name: 'GenericRoast',
    description: 'A generic roast card for general issues.',
    component: GenericRoast,
    propsSchema: z.object({
      title: z.string(),
      roast: z.string(),
      explanation: z.string(),
      severity: z.string(),
      config: z
        .object({
          emoji: z.string().optional(),
        })
        .optional(),
    }),
  },
];
