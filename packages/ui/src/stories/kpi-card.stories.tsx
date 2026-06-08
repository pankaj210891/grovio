import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { KpiCard } from '../components/ui/kpi-card';

const meta: Meta<typeof KpiCard> = {
  title: 'UI/KpiCard',
  component: KpiCard,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    trend: {
      control: 'select',
      options: ['up', 'down', 'neutral'],
    },
    accent: { control: 'boolean' },
    delta: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof KpiCard>;

export const Default: Story = {
  args: {
    label: 'Total GMV',
    value: '₹1,24,800',
  },
};

export const TrendUp: Story = {
  args: {
    label: 'Monthly Revenue',
    value: '₹84,200',
    delta: 12,
    trend: 'up',
  },
};

export const TrendDown: Story = {
  args: {
    label: 'Open Returns',
    value: '23',
    delta: 8,
    trend: 'down',
  },
};

export const Accent: Story = {
  args: {
    label: 'Platform Revenue',
    value: '₹9,360',
    delta: 5,
    trend: 'up',
    accent: true,
  },
};

export const AdminDashboardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4 w-full max-w-2xl">
      <KpiCard label="Total GMV" value="₹1,24,800" accent delta={14} trend="up" />
      <KpiCard label="Active Vendors" value="48" delta={3} trend="up" />
      <KpiCard label="Pending Approvals" value="7" delta={2} trend="down" />
      <KpiCard label="Pending Products" value="12" />
      <KpiCard label="Open Returns" value="5" delta={1} trend="down" />
      <KpiCard label="Platform Revenue" value="₹9,360" delta={8} trend="up" />
    </div>
  ),
};
