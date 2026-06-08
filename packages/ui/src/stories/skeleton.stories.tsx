import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Skeleton } from '../components/ui/skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'UI/Skeleton',
  component: Skeleton,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Default: Story = {
  args: { style: { width: '200px', height: '16px' } },
};

export const TextBlock: Story = {
  render: () => (
    <div className="space-y-2 w-72">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  ),
};

export const ProductCard: Story = {
  render: () => (
    <div className="w-56 space-y-3">
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="space-y-2 px-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    </div>
  ),
};

export const ProfileRow: Story = {
  render: () => (
    <div className="flex items-center gap-3 w-64">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  ),
};

export const KpiGrid: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 w-full max-w-lg">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-xl border p-4">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  ),
};
