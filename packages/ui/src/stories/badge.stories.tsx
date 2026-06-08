import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Badge } from '../components/ui/badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline', 'success', 'warning', 'muted'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { children: 'Badge' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 items-center">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="outline">Outline</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="muted">Muted</Badge>
    </div>
  ),
};

export const UsageExamples: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 items-center">
      <Badge variant="success">In Stock</Badge>
      <Badge variant="warning">Low Stock</Badge>
      <Badge variant="destructive">Out of Stock</Badge>
      <Badge variant="secondary">Draft</Badge>
      <Badge variant="default">Active</Badge>
      <Badge variant="muted">Archived</Badge>
    </div>
  ),
};
