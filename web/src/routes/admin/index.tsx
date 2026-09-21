import { createFileRoute } from '@tanstack/react-router';
import DashboardPage from '../../admin/pages/DashboardPage';

export const Route = createFileRoute('/admin/')({ component: DashboardPage });
