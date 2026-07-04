"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ActionIcon, Box, Button, Center, Container, Group, Loader, Paper, Stepper, Text, Title,
} from "@mantine/core";
import { ArrowLeft, Check, IdentificationCard, Tree, CheckCircle } from "@phosphor-icons/react";
import { useLiveQuery } from "dexie-react-hooks";
import SessionGate from "@/providers/SessionGate";
import { db } from "@/lib/db";
import { computeStatus } from "@/lib/status";
import { villageByCode } from "@/lib/villages";
import { StatusChip } from "@/components/StatusBadge";
import BioStep from "@/components/BioStep";
import FarmsStep from "@/components/FarmsStep";

function FarmerInner() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id") || "";
  const [active, setActive] = useState(0);

  const farmer = useLiveQuery(() => db.farmers.get(id), [id]);
  const farmCount = useLiveQuery(() => db.farms.where("farmerId").equals(id).count(), [id]) ?? 0;
  const plotCount = useLiveQuery(() => db.plots.where("farmerId").equals(id).count(), [id]) ?? 0;

  if (farmer === undefined) {
    return <Center h="100dvh"><Loader color="green" /></Center>;
  }
  if (!farmer) {
    return (
      <Center h="100dvh" p="lg">
        <Box ta="center">
          <Text fw={600} mb="sm">Farmer not found</Text>
          <ActionIcon variant="light" onClick={() => router.push("/home")}><ArrowLeft /></ActionIcon>
        </Box>
      </Center>
    );
  }

  const status = computeStatus(farmer, farmCount, plotCount);
  const village = villageByCode(farmer.villageCode);
  const farmsComplete = farmCount > 0 && plotCount > 0;

  return (
    <Box mih="100dvh" style={{ background: "var(--mantine-color-gray-0)" }}>
      <Box
        style={{
          background: "linear-gradient(135deg,#06854f,#013a24)", color: "#fff",
          paddingTop: "max(14px, env(safe-area-inset-top))",
          position: "sticky", top: 0, zIndex: 20,
        }}
      >
        <Container size="sm" pb="md" pt="xs">
          <Group justify="space-between" wrap="nowrap">
            <Group wrap="nowrap" gap="xs" style={{ minWidth: 0 }}>
              <ActionIcon variant="subtle" color="gray.0" size="lg" onClick={() => router.push("/home")} aria-label="Back">
                <ArrowLeft size={22} />
              </ActionIcon>
              <Box style={{ minWidth: 0 }}>
                <Text fw={700} size="lg" truncate>{farmer.firstName} {farmer.lastName}</Text>
                <Text size="xs" c="green.1">{farmer.id} · {village?.name}</Text>
              </Box>
            </Group>
            <StatusChip status={status} />
          </Group>
        </Container>
      </Box>

      <Container size="sm" py="lg">
        <Stepper
          active={active} onStepClick={setActive} allowNextStepsSelect size="sm" color="green" mb="lg"
        >
          <Stepper.Step
            label="Bio Data" description="Personal details"
            icon={<IdentificationCard size={18} />}
            completedIcon={<CheckCircle size={18} weight="fill" />}
            color={farmer.bioComplete ? "teal" : undefined}
          />
          <Stepper.Step
            label="Farms & Plots" description="Land & crops"
            icon={<Tree size={18} />}
            completedIcon={<CheckCircle size={18} weight="fill" />}
            color={farmsComplete ? "teal" : undefined}
          />
        </Stepper>

        <Paper withBorder radius="lg" p="md" shadow="xs">
          {active === 0 ? (
            <BioStep farmer={farmer} onSaved={() => setActive(1)} onContinue={() => setActive(1)} />
          ) : (
            <FarmsStep farmer={farmer} />
          )}
        </Paper>

        {active === 1 && (
          <Group justify="space-between" mt="md">
            <Button variant="default" leftSection={<ArrowLeft size={18} />} onClick={() => setActive(0)}>
              Bio Data
            </Button>
            <Button color="teal" leftSection={<Check size={18} weight="bold" />} onClick={() => router.push("/home")}>
              Done
            </Button>
          </Group>
        )}
      </Container>
    </Box>
  );
}

export default function FarmerPage() {
  return (
    <SessionGate>
      <Suspense fallback={<Center h="100dvh"><Loader color="green" /></Center>}>
        <FarmerInner />
      </Suspense>
    </SessionGate>
  );
}