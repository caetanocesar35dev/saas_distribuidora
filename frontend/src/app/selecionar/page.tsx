import type { Metadata } from "next";
import { Suspense } from "react";
import { SelectContext } from "./select-context";

export const metadata: Metadata = { title: "Escolher loja" };

export default function SelectPage() {
  return (
    <Suspense>
      <SelectContext />
    </Suspense>
  );
}
