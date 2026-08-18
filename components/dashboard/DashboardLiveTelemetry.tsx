"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ReactNode } from "react";
import { HelpCircle, Power, Refrigerator, Tv, Wind } from "lucide-react";
import AddApplianceTile from "@/components/ui/AddApplianceTile";
import RelayToggle from "@/components/ui/RelayToggle";
import { ApplianceType } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

type LiveDevice = {
  id: string;
  macAddress: string;
  name: string;
  applianceType: string | null;
  watts: number;
  volts: number;
  amps: number;
  isOnline: boolean;
  relayState: boolean;
  recordedAt: string | null;
  budgetStatus: string | null;
};

type EnergyLogPayload = {
  device_id?: string | null;
  average_watts?: number | string | null;
  voltage_v?: number | string | null;
  current_a?: number | string | null;
  recorded_at?: string | null;
};

type DashboardLiveTelemetryProps = {
  initialDevices: LiveDevice[];
  canManageDevices?: boolean;
  children?: ReactNode;
};

const ACTIVE_READING_WINDOW_MS = 20 * 1000;

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isFresh(recordedAt: string | null): boolean {
  if (!recordedAt) {
    return false;
  }

  const timestamp = new Date(recordedAt).getTime();
  return !Number.isNaN(timestamp) && Date.now() - timestamp <= ACTIVE_READING_WINDOW_MS;
}

function getDeviceIcon(applianceType: string | null, deviceName: string) {
  if (applianceType) {
    switch (applianceType) {
      case ApplianceType.Aircon:
        return Wind;
      case ApplianceType.Refrigerator:
        return Refrigerator;
      case ApplianceType.Tv:
        return Tv;
      default:
        return HelpCircle;
    }
  }

  const label = deviceName.toLowerCase();
  if (label.includes("aircon") || label.includes("ac") || label.includes("fan")) {
    return Wind;
  }

  if (label.includes("fridge") || label.includes("freezer") || label.includes("ref")) {
    return Refrigerator;
  }

  return Tv;
}

function sanitizeChannelKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
}

export default function DashboardLiveTelemetry({
  initialDevices,
  canManageDevices = true,
  children,
}: DashboardLiveTelemetryProps) {
  const [devices, setDevices] = useState(initialDevices);

  useEffect(() => {
    setDevices(initialDevices);
  }, [initialDevices]);

  useEffect(() => {
    if (initialDevices.length === 0) {
      return;
    }

    const supabase = createClient();
    const keyToDeviceId = new Map<string, string>();

    for (const device of initialDevices) {
      keyToDeviceId.set(device.id, device.id);
      keyToDeviceId.set(device.macAddress, device.id);
    }

    const channels = Array.from(keyToDeviceId.keys()).map((key, index) =>
      supabase
        .channel(`dashboard-live-${sanitizeChannelKey(key)}-${index}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "energy_logs",
            filter: `device_id=eq.${key}`,
          },
          (payload) => {
            const row = payload.new as EnergyLogPayload;
            const targetDeviceId = row.device_id
              ? keyToDeviceId.get(row.device_id)
              : undefined;

            if (!targetDeviceId) {
              return;
            }

            setDevices((currentDevices) =>
              currentDevices.map((device) => {
                if (device.id !== targetDeviceId) {
                  return device;
                }

                const watts = Math.max(0, Math.round(toNumber(row.average_watts)));
                const volts = Math.max(0, Math.round(toNumber(row.voltage_v)));
                const derivedVolts = volts > 0 ? volts : 230;
                const amps = toNumber(row.current_a);
                const derivedAmps =
                  derivedVolts > 0 ? Number((watts / derivedVolts).toFixed(1)) : 0;

                return {
                  ...device,
                  watts,
                  volts: derivedVolts,
                  amps: Number(Math.max(0, amps || derivedAmps).toFixed(1)),
                  isOnline: true,
                  recordedAt: row.recorded_at ?? new Date().toISOString(),
                };
              })
            );
          }
        )
        .subscribe()
    );

    const freshnessTimer = setInterval(() => {
      setDevices((currentDevices) =>
        currentDevices.map((device) =>
          isFresh(device.recordedAt)
            ? device
            : { ...device, watts: 0, volts: 0, amps: 0, isOnline: false }
        )
      );
    }, 5000);

    return () => {
      clearInterval(freshnessTimer);
      for (const channel of channels) {
        void supabase.removeChannel(channel);
      }
    };
  }, [initialDevices]);

  const totalWatts = devices.reduce((sum, device) => sum + device.watts, 0);
  const onlineDeviceCount = devices.filter((device) => device.isOnline).length;

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-white/5 bg-surface p-5">
        <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-mint/60" />
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-white/50">
            Total Live Wattage
          </p>
          <p className="text-5xl font-bold tracking-tight text-white">
            {totalWatts.toLocaleString()}
            <span className="ml-1 text-lg font-medium text-white/50">W</span>
          </p>
          <div className="mt-2 text-sm text-bida">
            <span className="font-medium">{onlineDeviceCount} device(s) online live</span>
          </div>
        </div>
      </div>

      {children}

      <section className="mt-2">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/50">
          Connected Units
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {devices.map((device) => {
            const Icon = getDeviceIcon(device.applianceType, device.name);

            return (
              <Link
                key={device.id}
                href={`/dashboard/${device.id}`}
                className="relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-xl border border-white/5 bg-surface p-4 transition-colors hover:border-mint/20"
              >
                <div className="absolute inset-y-0 left-0 w-1 rounded-r-full bg-mint/50" />
                <div className="flex items-start justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint/10">
                    <Icon className="h-4 w-4 text-mint" />
                  </div>
                  {canManageDevices ? (
                    <RelayToggle
                      deviceId={device.id}
                      initialRelayState={device.relayState}
                      variant="compact"
                    />
                  ) : null}
                </div>
                <div className="mt-3">
                  <p className="mb-1 line-clamp-2 text-sm font-semibold leading-tight">
                    {device.name}
                  </p>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex items-center gap-1">
                      <Power className={`h-3 w-3 ${device.relayState ? "text-mint" : "text-white/30"}`} />
                      <span className={device.relayState ? "font-semibold text-mint" : "text-white/40"}>
                        {device.relayState ? "ON" : "OFF"}
                      </span>
                      <span className="text-white/20">•</span>
                      <span className={device.isOnline ? "text-bida" : "text-white/40"}>
                        {device.isOnline ? "LIVE" : "IDLE"}
                      </span>
                    </div>
                    {device.budgetStatus === "approval_required" ? (
                      <p className="font-semibold text-naku">
                        100% reached: power remains on
                      </p>
                    ) : device.budgetStatus === "auto_cutoff" ? (
                      <p className="font-semibold text-danger">
                        Auto cutoff active
                      </p>
                    ) : null}
                    <div className="grid grid-cols-3 gap-1 text-white/55">
                      <span>{device.watts}W</span>
                      <span>{device.volts}V</span>
                      <span>{device.amps.toFixed(1)}A</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {canManageDevices ? <AddApplianceTile /> : null}
        </div>
      </section>
    </>
  );
}
