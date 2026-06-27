"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessAccordion } from "./process-accordion";
import { ProcessStep } from "./types";

interface ProcessDisplayProps {
  processes: ProcessStep[];
}

export function ProcessDisplay({ processes }: ProcessDisplayProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading font-medium">加工工艺</CardTitle>
      </CardHeader>
      <CardContent>
        <ProcessAccordion processes={processes} />
      </CardContent>
    </Card>
  );
}
