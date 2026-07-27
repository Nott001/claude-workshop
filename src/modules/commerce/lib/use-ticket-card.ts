"use client";

import { useEffect, useState } from "react";
import type { PaymentInfo } from "./use-tickets";

export function useTicketCard(paymentId: number) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [payment, setPayment] = useState<PaymentInfo | null>(null);

  useEffect(() => {
    async function load() {
      setQrLoading(true);
      const res = await fetch(`/api/tickets/${paymentId}`);
      if (res.ok) {
        const data = await res.json();
        setQrUrl(data.qr_data_url);
        const p = data.PAYMENTS;
        setPayment(Array.isArray(p) ? (p[0] ?? null) : p);
      }
      setQrLoading(false);
    }
    load();
  }, [paymentId]);

  return { qrUrl, qrLoading, payment };
}
