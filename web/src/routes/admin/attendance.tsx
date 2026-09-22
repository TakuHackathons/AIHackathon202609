import { createFileRoute } from '@tanstack/react-router';
import AttendancePage from '../../admin/pages/AttendancePage';
export const Route = createFileRoute('/admin/attendance')({ component: AttendancePage });
