import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { NotificationBell } from '../components/ui/notification-bell';

const meta: Meta<typeof NotificationBell> = {
  title: 'UI/NotificationBell',
  component: NotificationBell,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  argTypes: {
    count: { control: 'number' },
  },
};

export default meta;
type Story = StoryObj<typeof NotificationBell>;

export const NoUnread: Story = {
  args: { count: 0 },
};

export const WithUnread: Story = {
  args: { count: 5 },
};

export const ManyUnread: Story = {
  args: { count: 100 },
};

export const AllStates: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <div className="flex flex-col items-center gap-1.5">
        <NotificationBell count={0} />
        <span className="text-xs text-muted-foreground">No unread</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <NotificationBell count={3} />
        <span className="text-xs text-muted-foreground">3 unread</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <NotificationBell count={12} />
        <span className="text-xs text-muted-foreground">12 unread</span>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <NotificationBell count={100} />
        <span className="text-xs text-muted-foreground">99+ unread</span>
      </div>
    </div>
  ),
};
