import { Container, Title, Text, Button, Stack } from '@mantine/core';
import { Helmet } from 'react-helmet-async';
import { useState } from 'react';
import { getAppName } from '@/lib/config';
import api from '@/lib/api-client';
import classes from '@/features/auth/components/auth.module.css';

export default function BillingLocked() {
  const [loading, setLoading] = useState(false);

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const response = await api.get('/billing/portal');
      window.location.href = (response as any).url;
    } catch {
      setLoading(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Payment Failed - {getAppName()}</title>
      </Helmet>
      <Container size={480} className={classes.container}>
        <Stack align="center" p="xl">
          <Title order={3} fw={500}>
            Subscription Payment Failed
          </Title>
          <Text c="dimmed" ta="center">
            Your subscription payment failed. Update your payment method to
            restore access.
          </Text>
          <Button onClick={handleManageSubscription} loading={loading}>
            Manage Subscription
          </Button>
          <Text size="sm" c="dimmed" ta="center">
            If you purchased via Kiwify, please contact support to resolve your
            subscription.
          </Text>
        </Stack>
      </Container>
    </>
  );
}
