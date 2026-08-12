import { StatusSOP } from '../../generated/prisma';

export interface StatusDisplay {
  readonly value: string;
  readonly label: string;
}

const SOP_STATUS_LABELS: Record<StatusSOP, string> = {
  [StatusSOP.DRAFT]: 'Draft',
  [StatusSOP.COMPLETED]: 'Selesai',
  [StatusSOP.ARCHIVED]: 'Diarsipkan',
};

export function displayStatusSop(status: StatusSOP | string): StatusDisplay {
  const key = String(status);
  return {
    value: key,
    label: SOP_STATUS_LABELS[key as StatusSOP] ?? 'Status tidak dikenal',
  };
}
