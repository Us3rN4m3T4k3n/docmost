import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Table, Badge, Button, Text, Anchor } from '@mantine/core';
import { modals } from '@mantine/modals';
import { SettingsTitle } from '@/components/settings/settings-title';
import useUserRole from '@/hooks/use-user-role.tsx';
import { getAppName } from '@/lib/config';
import api from '@/lib/api-client';

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  gateway: 'stripe' | 'kiwify';
  status: 'active' | 'locked' | 'cancelled';
  stripeCustomerId: string | null;
}

export default function Subscribers() {
  const { isAdmin } = useUserRole();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubscribers = async () => {
    try {
      const res = await api.get('/billing/admin/subscribers');
      setSubscribers(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchSubscribers();
    }
  }, [isAdmin]);

  if (!isAdmin) return null;

  const handleRevoke = (subscriber: Subscriber) => {
    modals.openConfirmModal({
      title: 'Revoke Access',
      children: (
        <Text size="sm">
          Revoke access for {subscriber.email}? They will immediately lose
          access to the client space.
        </Text>
      ),
      labels: { confirm: 'Revoke Access', cancel: 'Keep Access' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        await api.post('/billing/admin/revoke', { userId: subscriber.id });
        fetchSubscribers();
      },
    });
  };

  const handleRestore = async (subscriber: Subscriber) => {
    await api.post('/billing/admin/restore', { userId: subscriber.id });
    fetchSubscribers();
  };

  const statusBadge = (status: string) => {
    const color =
      status === 'active' ? 'green' : status === 'locked' ? 'orange' : 'red';
    return <Badge color={color}>{status}</Badge>;
  };

  return (
    <>
      <Helmet>
        <title>Subscribers - {getAppName()}</title>
      </Helmet>
      <SettingsTitle title="Subscribers" />
      <Text c="dimmed" mb="lg">
        View and manage client subscribers and their access status.
      </Text>

      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th fw={500}>Email</Table.Th>
            <Table.Th fw={500}>Name</Table.Th>
            <Table.Th fw={500}>Gateway</Table.Th>
            <Table.Th fw={500}>Status</Table.Th>
            <Table.Th fw={500}>Stripe Customer</Table.Th>
            <Table.Th fw={500}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {loading && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed">Loading...</Text>
              </Table.Td>
            </Table.Tr>
          )}
          {!loading && subscribers.length === 0 && (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed">No subscribers found.</Text>
              </Table.Td>
            </Table.Tr>
          )}
          {!loading &&
            subscribers.map((sub) => (
              <Table.Tr key={sub.id}>
                <Table.Td>{sub.email}</Table.Td>
                <Table.Td>{sub.name || '—'}</Table.Td>
                <Table.Td>
                  {sub.gateway === 'stripe' ? 'Stripe' : 'Kiwify'}
                </Table.Td>
                <Table.Td>{statusBadge(sub.status)}</Table.Td>
                <Table.Td>
                  {sub.stripeCustomerId ? (
                    <Anchor
                      href={`https://dashboard.stripe.com/customers/${sub.stripeCustomerId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View in Stripe
                    </Anchor>
                  ) : (
                    '—'
                  )}
                </Table.Td>
                <Table.Td>
                  {sub.status === 'active' ? (
                    <Button
                      size="xs"
                      variant="outline"
                      color="red"
                      onClick={() => handleRevoke(sub)}
                    >
                      Revoke Access
                    </Button>
                  ) : (
                    <Button
                      size="xs"
                      variant="filled"
                      onClick={() => handleRestore(sub)}
                    >
                      Restore Access
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
        </Table.Tbody>
      </Table>
    </>
  );
}
