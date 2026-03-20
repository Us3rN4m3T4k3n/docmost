import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config.ts";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import {
  Badge,
  Button,
  Table,
  Text,
} from "@mantine/core";
import React, { useEffect, useState } from "react";
import useUserRole from "@/hooks/use-user-role.tsx";
import api from "@/lib/api-client";

interface ViolationRecord {
  userId: string;
  email: string;
  attemptCount: number;
  lastAttempt: string | null;
  suspendedAt: string | null;
}

export default function ContentSecurity() {
  const { isAdmin } = useUserRole();
  const [violations, setViolations] = useState<ViolationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  if (!isAdmin) {
    return null;
  }

  const fetchViolations = async () => {
    setLoading(true);
    try {
      const data = await api.get("/api/security/violations");
      setViolations(data as unknown as ViolationRecord[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViolations();
  }, []);

  const handleReinstate = async (userId: string) => {
    await api.post(`/api/security/reinstate/${userId}`);
    await fetchViolations();
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString();
  };

  return (
    <>
      <Helmet>
        <title>Content Security - {getAppName()}</title>
      </Helmet>
      <SettingsTitle title="Content Security" />
      <Text c="dimmed" mb="lg">
        View screenshot attempts and manage suspended accounts.
      </Text>

      {loading ? (
        <Text c="dimmed">Loading...</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Email</Table.Th>
              <Table.Th>Strike Count</Table.Th>
              <Table.Th>Last Attempt</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {violations.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed">No violations recorded.</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              violations.map((record) => (
                <Table.Tr key={record.userId}>
                  <Table.Td>{record.email}</Table.Td>
                  <Table.Td>{record.attemptCount}</Table.Td>
                  <Table.Td>{formatDate(record.lastAttempt)}</Table.Td>
                  <Table.Td>
                    {record.suspendedAt ? (
                      <Badge color="red">Locked</Badge>
                    ) : (
                      <Badge color="green">Active</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleReinstate(record.userId)}
                    >
                      Reinstate
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
