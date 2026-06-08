import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'search'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { placeholder: 'Enter text...' },
  decorators: [(Story) => <div className="w-72"><Story /></div>],
};

export const WithLabel: Story = {
  render: () => (
    <div className="w-72 space-y-1.5">
      <Label htmlFor="email">Email address</Label>
      <Input id="email" type="email" placeholder="you@example.com" />
    </div>
  ),
};

export const ErrorState: Story = {
  render: () => (
    <div className="w-72 space-y-1.5">
      <Label htmlFor="email-error" className="text-destructive">Email address</Label>
      <Input
        id="email-error"
        type="email"
        placeholder="you@example.com"
        defaultValue="not-an-email"
        className="border-destructive focus-visible:ring-destructive"
        aria-invalid
        aria-describedby="email-error-msg"
      />
      <p id="email-error-msg" className="text-xs text-destructive">
        Please enter a valid email address.
      </p>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-72 space-y-1.5">
      <Label htmlFor="disabled-input">Username</Label>
      <Input id="disabled-input" placeholder="johndoe" disabled />
    </div>
  ),
};

export const AllTypes: Story = {
  render: () => (
    <div className="w-72 space-y-3">
      <Input type="text" placeholder="Text input" />
      <Input type="email" placeholder="Email input" />
      <Input type="password" placeholder="Password input" />
      <Input type="number" placeholder="Number input" />
      <Input type="search" placeholder="Search..." />
    </div>
  ),
};
