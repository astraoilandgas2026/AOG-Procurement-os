import type {
  VerificationStatus,
  SupplierLifecycle,
  DDStatus,
  Priority,
  FollowUpStatus,
} from '@/types';
import {
  VERIFICATION_LABELS,
  LIFECYCLE_LABELS,
  DD_STATUS_LABELS,
  PRIORITY_LABELS,
  FOLLOWUP_STATUS_LABELS,
} from '@/types';

// ============================================================
// Status-to-color mapping helpers for badges
// ============================================================

type Color = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'teal' | 'purple' | 'slate';

export function verificationColor(status: VerificationStatus): Color {
  switch (status) {
    case 'claimed': return 'amber';
    case 'documented': return 'blue';
    case 'independently_verified': return 'teal';
    case 'physically_verified': return 'green';
  }
}

export function verificationLabel(status: VerificationStatus): string {
  return VERIFICATION_LABELS[status];
}

export function lifecycleColor(status: SupplierLifecycle): Color {
  switch (status) {
    case 'prospect': return 'gray';
    case 'active': return 'blue';
    case 'dd_pending': return 'amber';
    case 'qualified': return 'teal';
    case 'trial': return 'purple';
    case 'recurring': return 'green';
    case 'paused': return 'slate';
    case 'rejected': return 'red';
    case 'archived': return 'gray';
  }
}

export function lifecycleLabel(status: SupplierLifecycle): string {
  return LIFECYCLE_LABELS[status];
}

export function ddStatusColor(status: DDStatus): Color {
  switch (status) {
    case 'pending': return 'gray';
    case 'claimed': return 'amber';
    case 'documented': return 'blue';
    case 'independently_verified': return 'teal';
    case 'physically_verified': return 'green';
    case 'rejected': return 'red';
    case 'not_applicable': return 'slate';
  }
}

export function ddStatusLabel(status: DDStatus): string {
  return DD_STATUS_LABELS[status];
}

export function priorityColor(p: Priority): Color {
  switch (p) {
    case 'low': return 'gray';
    case 'medium': return 'blue';
    case 'high': return 'amber';
    case 'urgent': return 'red';
  }
}

export function priorityLabel(p: Priority): string {
  return PRIORITY_LABELS[p];
}

export function followUpStatusColor(s: FollowUpStatus): Color {
  switch (s) {
    case 'open': return 'blue';
    case 'in_progress': return 'amber';
    case 'completed': return 'green';
    case 'overdue': return 'red';
  }
}

export function followUpStatusLabel(s: FollowUpStatus): string {
  return FOLLOWUP_STATUS_LABELS[s];
}
