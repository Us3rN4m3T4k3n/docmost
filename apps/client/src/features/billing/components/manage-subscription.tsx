import { Group, Text, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import api from '@/lib/api-client';

export default function ManageSubscription() {
  const [loading, setLoading] = useState(false);

  const handlePortalRedirect = async () => {
    setLoading(true);
    try {
      const response = await api.get('/billing/portal');
      window.location.href = (response as any).url;
    } catch {
      notifications.show({
        color: 'red',
        message: 'Failed to open billing portal. Please try again.',
      });
      setLoading(false);
    }
  };

  return (
    <Group justify="space-between" wrap="wrap" gap="xl">
      <div>
        <Text size="md" fw={500}>
          Manage subscription
        </Text>
        <Text size="sm" c="dimmed">
          Manage your subscription, update payment details, and cancel at any
          time.
        </Text>
      </div>
      <Button onClick={handlePortalRedirect} loading={loading}>
        Manage Subscription
      </Button>
    </Group>
  );
}
