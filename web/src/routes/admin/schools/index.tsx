import { createFileRoute } from '@tanstack/react-router';
import SchoolsPage from '../../../admin/pages/SchoolsPage';

export const Route = createFileRoute('/admin/schools/')({ component: SchoolsPage });
