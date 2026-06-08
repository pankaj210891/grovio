import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Card body content. This is where the main information lives.
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm">Cancel</Button>
        <Button size="sm">Confirm</Button>
      </CardFooter>
    </Card>
  ),
};

export const ContentOnly: Story = {
  render: () => (
    <Card className="w-72">
      <CardContent className="pt-6">
        <p className="text-sm">A simple card with only content — no header or footer.</p>
      </CardContent>
    </Card>
  ),
};

export const WithHeaderOnly: Story = {
  render: () => (
    <Card className="w-72">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Manage your notification preferences.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          You have 3 unread notifications.
        </p>
      </CardContent>
    </Card>
  ),
};

export const ProductCard: Story = {
  render: () => (
    <Card className="w-52 overflow-hidden">
      <div className="h-36 bg-muted flex items-center justify-center text-muted-foreground text-sm">
        Product Image
      </div>
      <CardContent className="p-3">
        <p className="font-medium text-sm leading-tight">Wireless Headphones Pro</p>
        <p className="text-xs text-muted-foreground mt-0.5">Electronics</p>
        <p className="font-bold mt-1.5">₹2,499</p>
      </CardContent>
      <CardFooter className="p-3 pt-0">
        <Button size="sm" className="w-full">Add to Cart</Button>
      </CardFooter>
    </Card>
  ),
};
