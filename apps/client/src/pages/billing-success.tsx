import { Helmet } from 'react-helmet-async';
import { Container, Box, Title, Text } from '@mantine/core';
import { getAppName } from '@/lib/config';
import classes from '@/features/auth/components/auth.module.css';

export default function BillingSuccess() {
  return (
    <>
      <Helmet>
        <title>Payment Confirmed - {getAppName()}</title>
      </Helmet>
      <Container size={420} className={classes.container}>
        <Box p="xl">
          <Title order={2} ta="center" fw={500} mb="md">
            Payment Confirmed
          </Title>
          <Text ta="center" c="dimmed">
            Payment received. Check your email for your login link.
          </Text>
        </Box>
      </Container>
    </>
  );
}
