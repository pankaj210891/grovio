import type { Meta, StoryObj } from '@storybook/react';
import { Loader2, Mail } from 'lucide-react';
import React from 'react';
import { Button } from '../components/ui/button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'success'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'xl', 'icon', 'icon-sm', 'icon-lg'],
    },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: { children: 'Button' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 items-center">
      <Button variant="default">Default</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="success">Success</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 items-center">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra Large</Button>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 items-center">
      <Button disabled>Default</Button>
      <Button variant="secondary" disabled>Secondary</Button>
      <Button variant="outline" disabled>Outline</Button>
      <Button variant="destructive" disabled>Destructive</Button>
    </div>
  ),
};

export const Loading: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 items-center">
      <Button disabled>
        <Loader2 className="animate-spin" />
        Loading...
      </Button>
      <Button variant="outline" disabled>
        <Loader2 className="animate-spin" />
        Saving
      </Button>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 items-center">
      <Button>
        <Mail />
        Send Email
      </Button>
      <Button variant="outline">
        <Mail />
        Compose
      </Button>
    </div>
  ),
};
